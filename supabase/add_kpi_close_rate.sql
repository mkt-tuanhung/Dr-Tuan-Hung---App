-- ============================================================
-- KPI Sale Offline: thêm cột "tỉ lệ chốt mục tiêu" admin giao
-- An toàn cho prod (if not exists). Chạy trong Supabase SQL Editor.
-- ============================================================
alter table kpi_targets add column if not exists target_close_rate numeric(5,2) default 0;
