-- ============================================================
-- Cấp quyền cho CSKH tiếp quản chăm sóc khách (Hậu phẫu / CSKH tab)
-- + nhập vật tư, viện phí, phân công điều dưỡng.
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================

-- 1. CSKH đọc + cập nhật lịch khách (note hậu phẫu, viện phí, phân công)
drop policy if exists "cskh_read_appointments" on customer_appointments;
create policy "cskh_read_appointments" on customer_appointments
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'cskh'));

drop policy if exists "cskh_update_appointments" on customer_appointments;
create policy "cskh_update_appointments" on customer_appointments
  for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'cskh'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'cskh'));

-- 2. CSKH nhập vật tư (đọc danh mục + thêm danh mục + tạo giao dịch nhập/xuất)
drop policy if exists "cskh_read_inventory" on inventory_items;
create policy "cskh_read_inventory" on inventory_items
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'cskh'));

drop policy if exists "cskh_write_inventory" on inventory_items;
create policy "cskh_write_inventory" on inventory_items
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'cskh'));

drop policy if exists "cskh_read_trans" on inventory_transactions;
create policy "cskh_read_trans" on inventory_transactions
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'cskh'));

drop policy if exists "cskh_insert_trans" on inventory_transactions;
create policy "cskh_insert_trans" on inventory_transactions
  for insert with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'cskh'));
