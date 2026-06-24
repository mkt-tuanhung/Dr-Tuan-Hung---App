-- ============================================================
-- 1 nhân sự kiêm nhiệm 2 vị trí → thêm vị trí phụ role_2
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================
alter table profiles add column if not exists role_2 user_role;
