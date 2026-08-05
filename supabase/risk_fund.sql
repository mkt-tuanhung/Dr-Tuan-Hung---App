-- ============================================================
-- QUỸ RỦI RO — trích tiền từ dòng tiền để dự phòng.
-- Nằm trong module Lãi/Lỗ (tab "Quỹ rủi ro").
-- Mỗi bút toán TRÍCH: Lợi nhuận tháng (P&L) và Vốn lưu động (dòng tiền)
-- tự TRỪ khoản đó; bút toán RÚT thì cộng ngược lại.
-- Chạy trong Supabase SQL Editor.
-- ============================================================
create table if not exists risk_fund (
  id         uuid default uuid_generate_v4() primary key,
  date       date not null default current_date,
  amount     numeric not null check (amount > 0),
  kind       text not null default 'deposit' check (kind in ('deposit', 'withdraw')), -- deposit = trích vào quỹ | withdraw = rút khỏi quỹ
  note       text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_risk_fund_date on risk_fund(date);

alter table risk_fund enable row level security;
drop policy if exists "risk_fund_select" on risk_fund;
drop policy if exists "risk_fund_insert" on risk_fund;
drop policy if exists "risk_fund_delete" on risk_fund;
-- Xem: admin + kế toán + cổ đông (giống dòng tiền)
create policy "risk_fund_select" on risk_fund for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'accountant', 'shareholder'))
);
-- Thêm/xoá: admin + kế toán
create policy "risk_fund_insert" on risk_fund for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'accountant'))
);
create policy "risk_fund_delete" on risk_fund for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'accountant'))
);

-- Realtime để P&L / dòng tiền tự cập nhật khi có bút toán mới
do $$ begin
  alter publication supabase_realtime add table risk_fund;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
