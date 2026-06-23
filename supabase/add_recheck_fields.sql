-- ============================================================
-- Lịch tái khám — thêm "Dịch vụ sử dụng" (ngày phẫu thuật dùng surgery_date sẵn có)
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================
alter table customer_appointments add column if not exists used_service text;
