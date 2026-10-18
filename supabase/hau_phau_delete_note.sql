-- ============================================================
-- XOÁ 1 MỐC NHẬT KÝ CHĂM SÓC HẬU PHẪU — chạy trong SQL Editor (chạy lại vẫn an toàn)
--
-- Nhật ký nằm trong customer_appointments.post_op_notes (văn bản nối dần, mỗi mốc bắt đầu bằng
-- "[dd/mm/yyyy hh:mm:ss] …"; xem hau_phau_append_note.sql). Hàm remove_care_note xoá ĐÚNG 1 mốc
-- (dòng tiêu đề + các dòng tiếp theo tới mốc kế) ngay trong database (khoá dòng, không ghi đè
-- mốc khác).
--
-- Quyền: chỉ Admin hoặc Điều dưỡng (role / role_2). SECURITY INVOKER -> RLS sửa ca vẫn áp dụng:
-- ai không sửa được ca đó thì không xoá được (trả 0).
-- Mỗi lần xoá ghi vào Nhật ký hoạt động (audit_log) kèm NỘI DUNG mốc đã xoá -> truy lại được.
-- ============================================================

-- Cho phép log_audit_event ghi loại sự kiện 'delete_care_note' (giữ nguyên các loại cũ)
create or replace function public.log_audit_event(p_action text, p_entity text, p_entity_id text default null, p_details jsonb default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_action not in ('export', 'print', 'view_sensitive', 'impersonate', 'delete_care_note') then
    raise exception 'Loại sự kiện không hợp lệ: %', p_action;
  end if;
  select * into m from public.audit_request_meta();
  insert into public.audit_log (actor_id, action, entity, entity_id, after_data, reason, ip, user_agent)
  values (auth.uid(), p_action, left(p_entity, 80), left(p_entity_id, 120), p_details,
          coalesce(left(nullif(trim(p_reason), ''), 500), m.reason), m.ip, m.user_agent);
end $$;

revoke all on function public.log_audit_event(text, text, text, jsonb, text) from public;
grant execute on function public.log_audit_event(text, text, text, jsonb, text) to authenticated;

-- p_header: nguyên văn DÒNG ĐẦU của mốc cần xoá (app đọc được khi hiển thị nhật ký)
create or replace function public.remove_care_note(p_id uuid, p_header text)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_roles text[];
  v_notes text;
  v_lines text[];
  v_len int;
  s int := 0;
  e int;
  i int;
  n int;
  v_removed text;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select array_remove(array[role::text, role_2::text], null) into v_roles
    from profiles where id = auth.uid() and is_active;
  if not coalesce(v_roles && array['admin', 'dieu_duong'], false) then
    raise exception 'Chỉ Admin hoặc Điều dưỡng được xoá mốc nhật ký hậu phẫu';
  end if;
  if coalesce(trim(p_header), '') = '' then return 0; end if;

  select post_op_notes into v_notes from customer_appointments where id = p_id for update;
  if v_notes is null then return 0; end if;

  v_lines := string_to_array(v_notes, E'\n');
  v_len := coalesce(array_length(v_lines, 1), 0);
  for i in 1..v_len loop
    if v_lines[i] = p_header then s := i; exit; end if;
  end loop;
  if s = 0 then return 0; end if;          -- không thấy mốc (đã bị xoá / đổi) -> không làm gì

  e := v_len + 1;                          -- mốc kéo dài tới dòng tiêu đề của mốc kế tiếp
  for i in s + 1..v_len loop
    if v_lines[i] ~ '^\[\d{1,2}/\d{1,2}/\d{4}' then e := i; exit; end if;
  end loop;

  v_removed := array_to_string(v_lines[s:e - 1], E'\n');
  v_notes := array_to_string(v_lines[1:s - 1] || v_lines[e:v_len], E'\n');

  update customer_appointments set post_op_notes = nullif(v_notes, '') where id = p_id;
  get diagnostics n = row_count;

  if n > 0 then
    perform public.log_audit_event('delete_care_note', 'customer_appointments', p_id::text,
      jsonb_build_object('kind', 'hau_phau', 'deleted_note', v_removed), 'Xoá mốc nhật ký chăm sóc hậu phẫu');
  end if;
  return n;
end
$$;

revoke all on function public.remove_care_note(uuid, text) from public;
grant execute on function public.remove_care_note(uuid, text) to authenticated;

notify pgrst, 'reload schema';
