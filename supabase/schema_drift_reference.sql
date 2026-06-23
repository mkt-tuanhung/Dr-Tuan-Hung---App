-- ============================================================
-- SCHEMA DRIFT — Bổ sung các phần app ĐANG DÙNG nhưng schema.sql THIẾU
--
-- Mục đích: để dựng lại DB từ repo (môi trường mới) không bị lỗi.
-- An toàn cho prod: tất cả đều "if not exists" / "add column if not exists".
--
-- ⚠️ Kiểu dữ liệu dưới đây được SUY RA từ cách app sử dụng. Nếu prod đã có
-- các cột/bảng này (rất có thể), lệnh sẽ bỏ qua. Hãy đối chiếu lại với
-- DB thật trước khi coi đây là nguồn chuẩn.
-- ============================================================

-- ------------------------------------------------------------
-- 1. leave_requests — Đơn xin nghỉ / đi muộn / về sớm
--    Dùng ở: LeaveManagementPage, AttendancePage, LeaveManagement...
-- ------------------------------------------------------------
create table if not exists leave_requests (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  type text not null,                 -- 'late' | 'early' | 'leave'
  half_day_period text,               -- 'morning' | 'afternoon' (khi nghỉ nửa ngày)
  reason text,
  status text default 'pending',      -- 'pending' | 'approved' | 'rejected'
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table leave_requests enable row level security;

drop policy if exists "leave_admin_all" on leave_requests;
drop policy if exists "leave_staff_own" on leave_requests;

create policy "leave_admin_all" on leave_requests for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "leave_staff_own" on leave_requests for all using (staff_id = auth.uid());

-- ------------------------------------------------------------
-- 2. kpi_targets — các cột app dùng nhưng schema.sql gốc chưa có
--    (KPIPage + StaffDashboard đọc actual_* / commission_rate / target_*)
-- ------------------------------------------------------------
alter table kpi_targets add column if not exists target_customers int default 0;
alter table kpi_targets add column if not exists target_calls     int default 0;
alter table kpi_targets add column if not exists actual_revenue   numeric(15,0) default 0;
alter table kpi_targets add column if not exists actual_customers int default 0;
alter table kpi_targets add column if not exists actual_calls     int default 0;
alter table kpi_targets add column if not exists commission_rate  numeric(5,2) default 0;

-- ------------------------------------------------------------
-- GHI CHÚ: cash_flows đã có file riêng (create_cash_flows.sql).
-- Nên gom create_cash_flows.sql + schema.sql + các fix_*.sql + file này
-- thành MỘT bộ migration có thứ tự (khuyến nghị dùng Supabase CLI:
-- `supabase db diff` / `supabase migration new`) để tránh lệch tiếp.
-- ------------------------------------------------------------
