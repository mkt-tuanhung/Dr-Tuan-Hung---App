-- ============================================================
-- MỔ ĐỐI TÁC — khách của đơn vị khác thuê phòng khám mổ
-- ------------------------------------------------------------
-- Mục đích:
--   1. Lương bác sĩ  = 50% tiền nhận từ đối tác (partner_fee).
--   2. Phụ mổ điều dưỡng: theo bậc như khách nội bộ (P1/P2/P3 · Đại/Tiểu).
--   3. Dòng tiền / lãi lỗ: partner_fee là thu nhập thêm của phòng khám.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

create table if not exists partner_surgeries (
  id uuid default gen_random_uuid() primary key,
  customer_name text not null,
  partner_name text,                          -- tên đối tác thuê mổ
  service text,                               -- dịch vụ (VD: Gọt hàm)
  surgery_type text default 'Tiểu phẫu',      -- 'Tiểu phẫu' | 'Đại phẫu'
  surgery_date date,
  partner_fee bigint default 0,               -- tiền nhận từ đối tác
  bac_si_id uuid references profiles(id),     -- bác sĩ mổ (nhận 50% fee)
  phu_mo_1_id uuid references profiles(id),
  phu_mo_2_id uuid references profiles(id),
  phu_mo_3_id uuid references profiles(id),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_partner_surgeries_date on partner_surgeries(surgery_date);

alter table partner_surgeries enable row level security;

-- Đọc: mọi nhân sự đã đăng nhập (bác sĩ/điều dưỡng cần xem để tính lương/KPI của mình)
drop policy if exists partner_read on partner_surgeries;
create policy partner_read on partner_surgeries for select to authenticated using (true);

-- Ghi: admin, kế toán, điều dưỡng (người quản lý ca mổ)
drop policy if exists partner_write on partner_surgeries;
create policy partner_write on partner_surgeries for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid()
                 and (p.role::text in ('admin','accountant','dieu_duong') or p.role_2::text in ('dieu_duong'))))
  with check (exists (select 1 from profiles p where p.id = auth.uid()
                 and (p.role::text in ('admin','accountant','dieu_duong') or p.role_2::text in ('dieu_duong'))));
