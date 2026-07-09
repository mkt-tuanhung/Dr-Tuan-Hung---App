-- ============================================================
-- CẢNH BÁO XEM LƯƠNG — CHỈ CẢNH BÁO THIẾT BỊ LẠ
-- ------------------------------------------------------------
-- Trước: cứ có thiết bị khác từng xem phiếu là cảnh báo (kể cả thiết bị quen).
-- Nay:
--   • Thiết bị ĐÃ TỪNG ĐƯỢC DUYỆT xem lương của nhân sự này = thiết bị QUEN
--     -> KHÔNG cảnh báo nữa (dù mở lại phiếu tháng khác).
--   • Chỉ cảnh báo khi 1 thiết bị LẠ (chưa từng được duyệt) mở phiếu mà phiếu
--     đó đã/đang được thiết bị khác xem.
-- Vẫn cần Admin duyệt mỗi lần xem. Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

create or replace function request_payslip_view(
  p_staff text, p_period text, p_key text, p_device text, p_label text
) returns table(req_id uuid, is_duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare dup boolean; known boolean; other boolean; new_id uuid; staff_key text;
begin
  staff_key := split_part(p_key, ':', 1);   -- id nhân sự (phần trước dấu ':')

  -- Thiết bị này đã TỪNG được DUYỆT xem lương của nhân sự này chưa? -> quen thuộc
  known := exists(
    select 1 from payslip_view_requests r
    where split_part(r.slip_key, ':', 1) = staff_key
      and r.device_id = p_device and r.status = 'approved'
  );

  -- Có thiết bị KHÁC đã/đang xem đúng phiếu này không?
  other := exists(
    select 1 from payslip_view_requests r
    where r.slip_key = p_key and r.device_id is distinct from p_device
      and r.status in ('approved', 'pending')
  );

  -- Chỉ cảnh báo khi thiết bị LẠ (chưa từng được duyệt) mà phiếu đã có thiết bị khác xem
  dup := (not known) and other;

  insert into payslip_view_requests(staff_name, period, slip_key, device_id, device_label, is_duplicate)
  values (p_staff, p_period, p_key, p_device, p_label, dup)
  returning id into new_id;

  insert into notifications(user_id, type, title, body, link, action_type, action_id)
  select p.id, 'payslip_view_request',
    (case when dup then '⚠️ CẢNH BÁO — ' else '' end) || 'Yêu cầu xem lương: ' || coalesce(p_staff, '?') || ' (' || coalesce(p_period, '') || ')',
    'Thiết bị: ' || coalesce(p_label, '?')
      || (case when dup then E'\n⚠️ Thiết bị LẠ (chưa từng được duyệt) đang mở phiếu này — nếu không đúng, hãy TỪ CHỐI để chặn.'
               when known then E'\n✅ Thiết bị quen thuộc (đã từng được duyệt).' else '' end),
    'payroll', 'payslip_view', new_id
  from profiles p where p.role::text in ('admin', 'accountant');

  return query select new_id, dup;
end $$;
grant execute on function request_payslip_view(text, text, text, text, text) to anon, authenticated;
