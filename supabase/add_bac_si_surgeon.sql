-- ============================================================
-- Thêm cột bac_si_id (bác sĩ mổ chính) vào customer_appointments.
-- Dùng để tính CÔNG MỔ bác sĩ: Tiểu phẫu 10% · Đại phẫu 5% × doanh thu ca.
-- Gán ở màn Khách Phẫu thuật (form Điều phối điều dưỡng).
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table customer_appointments add column if not exists bac_si_id uuid references profiles(id);
