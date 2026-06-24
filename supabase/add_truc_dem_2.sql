-- ============================================================
-- Phân công điều dưỡng: thêm người trực đêm thứ 2
-- Mỗi người trực đêm được tính 1 ca (thưởng 500k/khách).
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================
alter table customer_appointments add column if not exists truc_dem_id_2 uuid references profiles(id);
