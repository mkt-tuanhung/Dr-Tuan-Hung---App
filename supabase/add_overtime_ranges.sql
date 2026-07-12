-- ============================================================
-- TĂNG CA — ghi rõ TỪ GIỜ NÀO TỚI GIỜ NÀO (nhiều khoảng/ngày)
-- ------------------------------------------------------------
-- overtime_ranges: mảng các khoảng [{from:'HH:MM', to:'HH:MM', hours:number}]
-- overtime_hours (đã có) = tổng số giờ các khoảng — dùng để tính lương.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table attendance add column if not exists overtime_ranges jsonb default '[]'::jsonb;
