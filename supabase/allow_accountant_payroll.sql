-- ============================================================
-- Cho KẾ TOÁN xem đầy đủ bảng lương như admin
-- (đọc toàn bộ nhân sự + dữ liệu tổng hợp + toàn quyền bảng payroll)
-- ============================================================

-- Helper tránh đệ quy RLS khi đặt policy trên chính bảng profiles
create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'accountant');
$$;

-- profiles: kế toán đọc toàn bộ nhân sự (tên, lương cơ bản, phụ cấp, NH...)
drop policy if exists "acct_read_profiles" on profiles;
create policy "acct_read_profiles" on profiles for select using (public.is_accountant());

-- attendance: kế toán đọc chấm công mọi nhân sự
alter table attendance enable row level security;
drop policy if exists "acct_read_attendance" on attendance;
create policy "acct_read_attendance" on attendance for select using (public.is_accountant());

-- customer_appointments: kế toán đọc tất cả (tính hoa hồng)
drop policy if exists "acct_read_appointments" on customer_appointments;
create policy "acct_read_appointments" on customer_appointments for select using (public.is_accountant());

-- page_daily_reports: kế toán đọc (hoa hồng trực page)
alter table page_daily_reports enable row level security;
drop policy if exists "acct_read_page_reports" on page_daily_reports;
create policy "acct_read_page_reports" on page_daily_reports for select using (public.is_accountant());

-- expenses: kế toán đọc tất cả (trừ tạm ứng vào lương)
alter table expenses enable row level security;
drop policy if exists "acct_read_expenses" on expenses;
create policy "acct_read_expenses" on expenses for select using (public.is_accountant());

-- payroll: kế toán toàn quyền (xem + chốt lương)
alter table payroll enable row level security;
drop policy if exists "acct_all_payroll" on payroll;
create policy "acct_all_payroll" on payroll for all
  using (public.is_accountant() or public.is_admin())
  with check (public.is_accountant() or public.is_admin());
