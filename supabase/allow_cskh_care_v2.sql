-- ============================================================
-- CSKH (kể cả kiêm nhiệm qua role_2) — xem/sửa tất cả khách hậu phẫu & CSKH
-- + nhập vật tư. Cập nhật các policy cũ để check cả role lẫn role_2.
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================

-- Helper điều kiện: là CSKH ở vị trí chính hoặc kiêm nhiệm
-- (viết inline trong từng policy)

-- 1. customer_appointments
drop policy if exists "cskh_read_appointments" on customer_appointments;
create policy "cskh_read_appointments" on customer_appointments
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'cskh' or p.role_2 = 'cskh')));

drop policy if exists "cskh_update_appointments" on customer_appointments;
create policy "cskh_update_appointments" on customer_appointments
  for update using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'cskh' or p.role_2 = 'cskh')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'cskh' or p.role_2 = 'cskh')));

-- 2. inventory
drop policy if exists "cskh_read_inventory" on inventory_items;
create policy "cskh_read_inventory" on inventory_items
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'cskh' or p.role_2 = 'cskh')));

drop policy if exists "cskh_write_inventory" on inventory_items;
create policy "cskh_write_inventory" on inventory_items
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'cskh' or p.role_2 = 'cskh')));

drop policy if exists "cskh_read_trans" on inventory_transactions;
create policy "cskh_read_trans" on inventory_transactions
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'cskh' or p.role_2 = 'cskh')));

drop policy if exists "cskh_insert_trans" on inventory_transactions;
create policy "cskh_insert_trans" on inventory_transactions
  for insert with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.role = 'cskh' or p.role_2 = 'cskh')));
