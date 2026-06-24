-- ============================================================
-- Cho ĐIỀU DƯỠNG quyền nhập vật tư vào kho (thêm danh mục + nhập kho)
-- (Điều dưỡng đã có quyền insert inventory_transactions từ trước.)
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================
drop policy if exists "allow_write_inventory" on inventory_items;
create policy "allow_write_inventory" on inventory_items
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid()
            and p.role in ('admin', 'accountant', 'dieu_duong'))
  );
