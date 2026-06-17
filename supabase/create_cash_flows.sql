-- Tạo bảng Kế toán dòng tiền (Cash Flows)
create table if not exists cash_flows (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  flow_type text not null check (flow_type in ('in', 'out')), -- 'in': Nhận tiền, 'out': Chi tiền
  amount numeric(15,0) not null,
  method text not null check (method in ('cash', 'transfer')), -- 'cash': Tiền mặt, 'transfer': Chuyển khoản
  handover_person text, -- Người bàn giao
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table cash_flows enable row level security;

-- Admin, Accountant, Shareholder có thể xem
create policy "finance_read_all" on cash_flows for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'shareholder'))
);

-- Chỉ Admin và Accountant có thể thêm/sửa/xoá
create policy "finance_write_all" on cash_flows for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant'))
);
