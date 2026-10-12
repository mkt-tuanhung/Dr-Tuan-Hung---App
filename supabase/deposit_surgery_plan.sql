-- ============================================================
-- FORM CỌC — NGÀY PHẪU THUẬT DỰ KIẾN: có ngày / PT trong tháng / chưa có ngày (chạy lại vẫn an toàn)
--
-- customer_appointments.expected_surgery_plan:
--   'date'       : đã chốt ngày -> expected_surgery_date là ngày PT dự kiến
--   'this_month' : PT trong tháng (tháng của ngày cọc), chưa chốt ngày cụ thể
--   'none'       : chưa có ngày PT dự kiến
--   null         : dữ liệu cũ trước khi có mục này
-- Sale Offline chọn ở form ĐÁNH GIÁ sau tư vấn trực tiếp khi khách CỌC (Khách tư vấn · Lịch hẹn).
-- Chỉ THÊM cột, không đổi dữ liệu khác.
-- ============================================================

alter table public.customer_appointments add column if not exists expected_surgery_plan text;

do $$ begin
  alter table public.customer_appointments add constraint customer_appointments_surgery_plan_chk
    check (expected_surgery_plan is null or expected_surgery_plan in ('date', 'this_month', 'none'));
exception when duplicate_object then null; end $$;

-- Khách đang cọc đã có ngày PT dự kiến -> đánh dấu 'date'
update public.customer_appointments
   set expected_surgery_plan = 'date'
 where expected_surgery_plan is null and status = 'coc' and expected_surgery_date is not null;
