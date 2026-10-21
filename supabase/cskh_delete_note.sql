-- ============================================================
-- XOÁ 1 MỐC NHẬT KÝ CSKH — chạy trong SQL Editor (chạy lại vẫn an toàn)
--
-- Giống remove_care_note (hau_phau_delete_note.sql) nhưng cho cột customer_appointments.cskh_notes.
-- Xoá ĐÚNG 1 mốc (dòng tiêu đề "[dd/mm/yyyy hh:mm:ss] …" + các dòng tới mốc kế) ngay trong database
-- (khoá dòng, không ghi đè mốc khác).
--
-- Quyền: Admin hoặc CSKH (role / role_2). SECURITY INVOKER -> RLS sửa ca vẫn áp dụng.
-- Mỗi lần xoá ghi vào Nhật ký hoạt động (audit_log) kèm NỘI DUNG mốc đã xoá -> truy lại được.
-- Cần đã chạy hau_phau_delete_note.sql trước (log_audit_event nhận loại 'delete_care_note').
-- ============================================================

create or replace function public.remove_cskh_note(p_id uuid, p_header text)
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
  if not coalesce(v_roles && array['admin', 'cskh'], false) then
    raise exception 'Chỉ Admin hoặc CSKH được xoá mốc nhật ký CSKH';
  end if;
  if coalesce(trim(p_header), '') = '' then return 0; end if;

  select cskh_notes into v_notes from customer_appointments where id = p_id for update;
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

  update customer_appointments set cskh_notes = nullif(v_notes, '') where id = p_id;
  get diagnostics n = row_count;

  if n > 0 then
    perform public.log_audit_event('delete_care_note', 'customer_appointments', p_id::text,
      jsonb_build_object('kind', 'cskh', 'deleted_note', v_removed), 'Xoá mốc nhật ký CSKH');
  end if;
  return n;
end
$$;

revoke all on function public.remove_cskh_note(uuid, text) from public;
grant execute on function public.remove_cskh_note(uuid, text) to authenticated;

notify pgrst, 'reload schema';
