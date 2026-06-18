-- ============================================================
-- DR TUAN HUNG APP — Nâng cấp cấu trúc bảng Kho hiện có
-- ============================================================

-- 1. Thêm cột reference_id để lưu vết Khách hàng phẫu thuật
alter table inventory_transactions
add column if not exists reference_id uuid;

-- 2. Cập nhật quyền (RLS) cho phép Điều dưỡng được Đọc và Thêm giao dịch (xuất kho)
drop policy if exists "admin_accountant" on inventory_items;
create policy "allow_read_inventory" on inventory_items for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'dieu_duong', 'shareholder'))
);
create policy "allow_write_inventory" on inventory_items for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant'))
);

drop policy if exists "admin_accountant" on inventory_transactions;
create policy "allow_read_trans" on inventory_transactions for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'shareholder'))
);
create policy "allow_insert_trans" on inventory_transactions for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant', 'dieu_duong'))
);

-- 3. Tạo Trigger tự động cộng/trừ số lượng tồn kho (current_stock)
create or replace function auto_update_stock()
returns trigger as $$
begin
  if (NEW.type = 'import') then
    update inventory_items
    set current_stock = current_stock + NEW.quantity
    where id = NEW.item_id;
  elsif (NEW.type = 'export') then
    update inventory_items
    set current_stock = current_stock - NEW.quantity
    where id = NEW.item_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_update_stock on inventory_transactions;
create trigger trg_update_stock
after insert on inventory_transactions
for each row
execute function auto_update_stock();
