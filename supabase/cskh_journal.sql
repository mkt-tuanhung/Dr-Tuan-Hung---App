-- ============================================================
-- CSKH: Nhật ký CSKH riêng + phân loại khách
--   cskh_notes  : nhật ký chăm sóc của CSKH (kèm ảnh, cùng định dạng post_op_notes)
--   cskh_status : phân loại khách (Hài lòng / Không hài lòng / Bình thường / Tiềm năng / Gặp vấn đề)
-- CSKH đã có quyền UPDATE customer_appointments (allow_cskh_care_v2.sql) nên không cần thêm RLS.
-- Chạy 1 lần trên Supabase SQL Editor.
-- ============================================================
alter table customer_appointments add column if not exists cskh_notes text;
alter table customer_appointments add column if not exists cskh_status text;
