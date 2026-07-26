-- ============================================================
-- Cho phép ĐIỀU DƯỠNG (được phân công ca) tạo LỊCH TÁI KHÁM.
-- Điều dưỡng thường chỉ có quyền SELECT/UPDATE trên customer_appointments,
-- không có quyền INSERT -> khi chọn trạng thái "Tái khám" bị RLS chặn.
-- Dùng RPC SECURITY DEFINER + tự kiểm tra quyền, không mở toang INSERT.
-- Chạy 1 lần, an toàn chạy lại.
-- ============================================================
create or replace function create_recheck_appointment(
  p_parent_id    uuid,
  p_recheck_date date,
  p_recheck_time time,
  p_notes        text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_pos  text;
  par    customer_appointments;
  v_new  uuid;
begin
  select role, position into v_role, v_pos from profiles where id = v_uid;
  select * into par from customer_appointments where id = p_parent_id;
  if par.id is null then
    raise exception 'Không tìm thấy ca gốc để tạo lịch tái khám';
  end if;

  -- Quyền: admin, điều dưỡng trưởng, hoặc điều dưỡng được phân công chính/phụ ca này
  if not (
    v_role = 'admin'
    or (v_role = 'dieu_duong' and v_pos = 'Trưởng bộ phận')
    or (v_role = 'dieu_duong' and (
          par.hau_phau_id = v_uid
          or v_uid = any(coalesce(par.additional_hau_phau_ids, '{}'::uuid[]))
       ))
  ) then
    raise exception 'Bạn không có quyền tạo lịch tái khám cho ca này';
  end if;

  if p_recheck_date is null then
    raise exception 'Thiếu ngày tái khám';
  end if;

  insert into customer_appointments (
    customer_name, phone, appointment_date, appointment_time, service,
    test_status, expected_bill, deposit_amount, telesale_id, sale_id,
    surgery_date, customer_source, customer_type, status, notes,
    hau_phau_id, created_by
  ) values (
    par.customer_name, par.phone, p_recheck_date, p_recheck_time,
    '[Tái khám] ' || coalesce(par.service, 'Hậu phẫu'),
    'Không cần', 0, 0, null, coalesce(par.sale_id, par.hau_phau_id),
    par.surgery_date, 'CSKH', 'Cũ', 'scheduled', p_notes,
    par.hau_phau_id, v_uid
  ) returning id into v_new;

  return v_new;
end;
$$;

grant execute on function create_recheck_appointment(uuid, date, time, text) to authenticated;
notify pgrst, 'reload schema';
