-- ============================================================
-- Trực page — bổ sung cột cho báo cáo số điện thoại theo ngày
-- An toàn cho prod (if not exists). Chạy trong Supabase SQL Editor.
-- ============================================================
alter table page_daily_reports add column if not exists total_interested_phones int default 0; -- SĐT quan tâm
alter table page_daily_reports add column if not exists total_spam_messages int default 0;     -- tin nhắn spam
alter table page_daily_reports add column if not exists telesale_id uuid references profiles(id); -- telesale tiếp nhận số

-- KPI Trực page: dùng target_phones (đã có) + target_close_rate (tỉ lệ xin số) làm mục tiêu
alter table kpi_targets add column if not exists target_close_rate numeric(5,2) default 0;

-- Cho phép Telesale ĐỌC các báo cáo số mà họ được tag (phục vụ tính KPI telesale)
drop policy if exists "telesale_read_assigned" on page_daily_reports;
create policy "telesale_read_assigned" on page_daily_reports
  for select using (telesale_id = auth.uid());
