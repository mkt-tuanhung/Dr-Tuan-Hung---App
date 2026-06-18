-- ============================================================
-- DR TUAN HUNG APP — Kế toán Kho (Inventory Management)
-- ============================================================

-- ============================================================
-- 1. INVENTORY ITEMS — Danh mục vật tư
-- ============================================================
create table inventory_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,                       -- Tên vật tư (VD: Bơm tiêm 5ml)
  unit text not null,                       -- Đơn vị tính (VD: Cái, Hộp, Vỉ)
  stock_quantity int default 0,             -- Tồn kho hiện tại
  notes text,                               -- Ghi chú thêm
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table inventory_items enable row level security;

-- Admin, Accountant, Điều dưỡng được xem danh mục
create policy "allow_read" on inventory_items for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'dieu_duong', 'shareholder'))
);

-- Chỉ Admin và Kế toán được tạo/sửa danh mục vật tư
create policy "allow_write" on inventory_items for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant'))
);


-- ============================================================
-- 2. INVENTORY TRANSACTIONS — Lịch sử Nhập/Xuất kho
-- ============================================================
create type inventory_transaction_type as enum ('in', 'out');

create table inventory_transactions (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references inventory_items(id) on delete cascade not null,
  transaction_type inventory_transaction_type not null,
  quantity int not null,                    -- Số lượng giao dịch (Luôn là số dương)
  reference_id uuid,                        -- ID của khách phẫu thuật nếu là xuất kho
  notes text,                               -- Lý do / Ghi chú
  created_by uuid references profiles(id),  -- Người thực hiện giao dịch (Admin, Kế toán, Điều dưỡng)
  created_at timestamptz default now()
);

alter table inventory_transactions enable row level security;

-- Admin, Accountant, Shareholder được xem tất cả
create policy "allow_read" on inventory_transactions for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'shareholder'))
);

-- Admin, Kế toán, Điều dưỡng được tạo giao dịch (Xuất/Nhập)
create policy "allow_insert" on inventory_transactions for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'dieu_duong'))
);


-- ============================================================
-- 3. TRIGGER: TỰ ĐỘNG CẬP NHẬT TỒN KHO KHI CÓ GIAO DỊCH
-- ============================================================
create or replace function update_stock_quantity()
returns trigger as $$
begin
  if (NEW.transaction_type = 'in') then
    update inventory_items
    set stock_quantity = stock_quantity + NEW.quantity,
        updated_at = now()
    where id = NEW.item_id;
  elsif (NEW.transaction_type = 'out') then
    update inventory_items
    set stock_quantity = stock_quantity - NEW.quantity,
        updated_at = now()
    where id = NEW.item_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_update_stock
after insert on inventory_transactions
for each row
execute function update_stock_quantity();
