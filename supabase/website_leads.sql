-- ============================================================
-- WEBSITE LEADS — Khách đăng ký từ website drtuanhung.vn
-- Chạy trong Supabase Dashboard → SQL Editor
--
-- Nguồn ghi: API /api/lead của website (dùng service_role key,
-- bỏ qua RLS). Nhân sự đăng nhập app đọc & cập nhật trạng thái;
-- khi chốt được lịch thì tạo bản ghi customer_appointments và
-- liên kết qua converted_appointment_id.
-- ============================================================

create table if not exists website_leads (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text not null,
  service text,
  message text,
  source text default 'drtuanhung.vn',
  -- Quy trình xử lý
  status text default 'new' check (status in ('new', 'contacted', 'scheduled', 'rejected')),
  assigned_to uuid references profiles(id),
  converted_appointment_id uuid references customer_appointments(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists website_leads_status_idx on website_leads (status, created_at desc);

alter table website_leads enable row level security;

create policy "admin_all" on website_leads
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Nhân sự đăng nhập được xem & nhận xử lý lead
create policy "staff_read" on website_leads
  for select using (auth.uid() is not null);

create policy "staff_update" on website_leads
  for update using (auth.uid() is not null);
