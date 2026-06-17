-- ============================================================
-- DR TUAN HUNG APP — Supabase Schema
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type user_role as enum (
  'admin', 'accountant', 'shareholder',
  'telesale', 'sale_offline', 'cskh',
  'truc_page', 'media', 'marketing', 'dieu_duong'
);

create type employment_status as enum ('probation', 'official', 'inactive');

create type attendance_status as enum ('present', 'absent', 'leave', 'late', 'early_leave');

create type leave_type as enum ('full_day', 'morning', 'afternoon');

create type expense_category as enum ('MKT', 'Vat_tu', 'Van_phong', 'Nhan_cong', 'Cong_tac', 'Tiep_khach', 'Tho_cung', 'Khac');

create type expense_status as enum ('pending', 'approved', 'rejected', 'paid');

create type appointment_status as enum ('scheduled', 'coc', 'bong', 'phau_thuat', 'cancelled');

create type transaction_type as enum ('cash', 'transfer');

-- ============================================================
-- 1. PROFILES (mở rộng từ auth.users của Supabase)
-- ============================================================

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  employee_id text unique not null,         -- VD: NV001
  full_name text not null,
  role user_role not null default 'telesale',
  position text,                            -- Tên vị trí hiển thị
  base_salary numeric(15,0) default 0,
  allowance numeric(15,0) default 0,
  phone text,
  employment_status employment_status default 'probation',
  probation_started_at date,
  official_started_at date,
  avatar_url text,
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;

-- Admin thấy tất cả
create policy "admin_all" on profiles
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Nhân viên chỉ thấy profile của mình
create policy "self_read" on profiles
  for select using (id = auth.uid());

-- Kế toán/cổ đông thấy tất cả (read only)
create policy "accountant_read" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('accountant', 'shareholder'))
  );

-- ============================================================
-- 2. ATTENDANCE — Chấm công
-- ============================================================

create table attendance (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  status attendance_status not null default 'present',
  leave_type leave_type,                    -- nếu status = leave
  late_time text,                           -- VD: "08:30" nếu đi muộn
  early_time text,                          -- VD: "17:00" nếu về sớm
  notes text,
  edited_by uuid references profiles(id),  -- admin mới được sửa quá khứ
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(staff_id, date)
);

alter table attendance enable row level security;

-- Admin full quyền
create policy "admin_all" on attendance
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Nhân viên: chỉ xem của mình, chỉ insert ngày hôm nay trở đi
create policy "staff_read_own" on attendance
  for select using (staff_id = auth.uid());

create policy "staff_insert_today_future" on attendance
  for insert with check (
    staff_id = auth.uid() and date >= current_date
  );

-- ============================================================
-- 3. CUSTOMER APPOINTMENTS — Lịch hẹn khách
-- ============================================================

create table customer_appointments (
  id uuid default uuid_generate_v4() primary key,
  customer_name text not null,
  phone text,
  appointment_date date not null,
  telesale_id uuid references profiles(id),       -- Telesale up lên
  sale_offline_id uuid references profiles(id),   -- Sale offline phụ trách
  status appointment_status default 'scheduled',
  -- Khi CỌC
  deposit_date date,
  deposit_amount numeric(15,0),
  service text,
  expected_surgery_date date,
  -- Khi PHẪU THUẬT
  surgery_date date,
  revenue numeric(15,0),
  upsale_revenue numeric(15,0),
  -- Chung
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table customer_appointments enable row level security;

create policy "admin_all" on customer_appointments
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "staff_read_write_own" on customer_appointments
  for all using (
    telesale_id = auth.uid() or sale_offline_id = auth.uid() or created_by = auth.uid()
  );

-- ============================================================
-- 4. KPI TARGETS — Admin giao KPI
-- ============================================================

create table kpi_targets (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) on delete cascade not null,
  month smallint not null check (month between 1 and 12),
  year smallint not null,
  target_revenue numeric(15,0) default 0,
  target_appointments int default 0,
  target_phones int default 0,               -- Trực page
  target_clips int default 0,                -- Media
  target_livestreams int default 0,          -- Media
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(staff_id, month, year)
);

alter table kpi_targets enable row level security;

create policy "admin_all" on kpi_targets
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "staff_read_own" on kpi_targets
  for select using (staff_id = auth.uid());

-- ============================================================
-- 5. DAILY REPORTS — Báo cáo hằng ngày theo vai trò
-- ============================================================

-- Trực page
create table page_daily_reports (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) not null,
  date date not null,
  total_messages int default 0,
  total_phones int default 0,
  notes text,
  created_at timestamptz default now(),
  unique(staff_id, date)
);

alter table page_daily_reports enable row level security;
create policy "admin_all" on page_daily_reports for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "staff_own" on page_daily_reports for all using (staff_id = auth.uid());

-- CSKH
create table cskh_daily_reports (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) not null,
  date date not null,
  total_customers int default 0,
  satisfied_customers int default 0,
  unsatisfied_customers int default 0,
  notes text,
  created_at timestamptz default now(),
  unique(staff_id, date)
);

alter table cskh_daily_reports enable row level security;
create policy "admin_all" on cskh_daily_reports for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "staff_own" on cskh_daily_reports for all using (staff_id = auth.uid());

-- Marketing
create table marketing_daily_reports (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) not null,
  date date not null,
  ad_budget numeric(15,0) default 0,
  total_phones int default 0,
  notes text,
  created_at timestamptz default now(),
  unique(staff_id, date)
);

alter table marketing_daily_reports enable row level security;
create policy "admin_all" on marketing_daily_reports for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "staff_own" on marketing_daily_reports for all using (staff_id = auth.uid());

-- Media
create table media_daily_reports (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) not null,
  date date not null,
  clips_produced int default 0,
  livestreams int default 0,
  viral_clips int default 0,
  notes text,
  created_at timestamptz default now(),
  unique(staff_id, date)
);

alter table media_daily_reports enable row level security;
create policy "admin_all" on media_daily_reports for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "staff_own" on media_daily_reports for all using (staff_id = auth.uid());

-- ============================================================
-- 6. SURGICAL ASSIGNMENTS — Ca trực đêm & Phụ mổ điều dưỡng
-- ============================================================

create table surgical_assignments (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) not null,
  date date not null,
  assignment_type text not null, -- 'night_shift', 'major_assist_1', 'major_assist_2', 'major_assist_3', 'minor_assist_1', 'minor_assist_2', 'minor_assist_3'
  customer_name text not null,
  surgery_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table surgical_assignments enable row level security;
create policy "admin_all" on surgical_assignments for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "staff_own" on surgical_assignments for all using (staff_id = auth.uid());

-- ============================================================
-- 7. EXPENSES — Thu chi tạm ứng nhân sự
-- ============================================================

create table expenses (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) not null,
  date date not null,
  category expense_category not null,
  amount numeric(15,0) not null,
  description text,
  proof_image_urls text[],                  -- URLs từ Cloudflare R2
  status expense_status default 'pending',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  paid_at timestamptz,
  is_advance boolean default false,         -- true = tạm ứng
  advance_repaid_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table expenses enable row level security;
create policy "admin_all" on expenses for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "staff_own" on expenses for all using (staff_id = auth.uid());
create policy "accountant_read" on expenses for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('accountant', 'shareholder'))
);

-- ============================================================
-- 8. PAYROLL — Bảng lương hàng tháng
-- ============================================================

create table payroll (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) not null,
  month smallint not null check (month between 1 and 12),
  year smallint not null,
  -- Lương cơ bản
  base_salary numeric(15,0) default 0,
  allowance numeric(15,0) default 0,
  working_days numeric(5,2) default 0,      -- số ngày công thực tế
  salary_by_attendance numeric(15,0) default 0,
  -- Hoa hồng theo vai trò (lưu JSON chi tiết)
  commission_detail jsonb default '{}',
  total_commission numeric(15,0) default 0,
  -- Thưởng & khấu trừ
  other_bonus numeric(15,0) default 0,
  unpaid_advance numeric(15,0) default 0,
  other_deduction numeric(15,0) default 0,
  -- Tổng
  gross_income numeric(15,0) default 0,
  total_deductions numeric(15,0) default 0,
  net_salary numeric(15,0) default 0,
  -- Trạng thái
  status text default 'draft',              -- draft, locked
  locked_at timestamptz,
  locked_by uuid references profiles(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(staff_id, month, year)
);

alter table payroll enable row level security;
create policy "admin_all" on payroll for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "staff_read_own" on payroll for select using (staff_id = auth.uid());
create policy "accountant_read" on payroll for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('accountant', 'shareholder'))
);

-- ============================================================
-- 9. FINANCE TRANSACTIONS — Kế toán tài chính doanh nghiệp
-- ============================================================

create table finance_transactions (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  type text not null,                       -- 'income', 'expense'
  transaction_type transaction_type not null,
  amount numeric(15,0) not null,
  handover_person text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table finance_transactions enable row level security;
create policy "admin_accountant_shareholder" on finance_transactions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'shareholder'))
);

-- ============================================================
-- 10. COMMUNITY POSTS — Group cộng đồng nội bộ
-- ============================================================

create table community_groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table community_posts (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references community_groups(id) on delete cascade,
  author_id uuid references profiles(id) not null,
  content text,
  image_urls text[],
  likes_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table community_comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references community_posts(id) on delete cascade,
  author_id uuid references profiles(id) not null,
  content text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table community_likes (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references community_posts(id) on delete cascade,
  user_id uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table community_groups enable row level security;
alter table community_posts enable row level security;
alter table community_comments enable row level security;
alter table community_likes enable row level security;

create policy "all_read" on community_groups for select using (auth.uid() is not null);
create policy "admin_write" on community_groups for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "all_authenticated" on community_posts for all using (auth.uid() is not null);
create policy "all_authenticated" on community_comments for all using (auth.uid() is not null);
create policy "all_authenticated" on community_likes for all using (auth.uid() is not null);

-- ============================================================
-- 11. INVENTORY — Kế toán kho
-- ============================================================

create table inventory_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  unit text,                                -- cái, hộp, lọ...
  current_stock numeric(10,2) default 0,
  min_stock numeric(10,2) default 0,        -- cảnh báo tồn kho thấp
  notes text,
  created_at timestamptz default now()
);

create table inventory_transactions (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references inventory_items(id) not null,
  type text not null,                       -- 'import', 'export'
  quantity numeric(10,2) not null,
  date date not null,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table inventory_items enable row level security;
alter table inventory_transactions enable row level security;

create policy "admin_accountant" on inventory_items for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant'))
);
create policy "admin_accountant" on inventory_transactions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant'))
);

-- ============================================================
-- TRIGGERS — tự cập nhật updated_at
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles for each row execute function update_updated_at();
create trigger trg_attendance_updated before update on attendance for each row execute function update_updated_at();
create trigger trg_appointments_updated before update on customer_appointments for each row execute function update_updated_at();
create trigger trg_expenses_updated before update on expenses for each row execute function update_updated_at();
create trigger trg_payroll_updated before update on payroll for each row execute function update_updated_at();
create trigger trg_finance_updated before update on finance_transactions for each row execute function update_updated_at();

-- ============================================================
-- MARKETING ADS MODULE
-- ============================================================

create table marketing_monthly_targets (
  month date primary key, -- First day of the month
  budget numeric not null default 0,
  target_leads integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table marketing_ads_performance (
  id uuid primary key default uuid_generate_v4(),
  date date unique not null,
  amount_spent numeric not null default 0,
  impressions text,
  leads integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Policies (allow marketing, admin, etc to access)
alter table marketing_monthly_targets enable row level security;
alter table marketing_ads_performance enable row level security;

create policy "Cho phép tất cả đọc marketing_monthly_targets" on marketing_monthly_targets for select using (true);
create policy "Cho phép tất cả sửa marketing_monthly_targets" on marketing_monthly_targets for all using (true);

create policy "Cho phép tất cả đọc marketing_ads_performance" on marketing_ads_performance for select using (true);
create policy "Cho phép tất cả sửa marketing_ads_performance" on marketing_ads_performance for all using (true);
