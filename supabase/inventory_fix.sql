-- ============================================================
-- Kho vật tư: cho điều dưỡng nhập kho + cảnh báo tồn < 10
-- ============================================================

-- 1) Cho phép điều dưỡng (cùng admin/kế toán) thêm/sửa danh mục + tồn kho
drop policy if exists "allow_write_inventory" on inventory_items;
create policy "allow_write_inventory" on inventory_items for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'accountant', 'dieu_duong')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'accountant', 'dieu_duong')));

-- Đảm bảo điều dưỡng đọc được danh mục
drop policy if exists "allow_read_inventory" on inventory_items;
create policy "allow_read_inventory" on inventory_items for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'accountant', 'dieu_duong', 'shareholder', 'cskh')));

-- Trigger trừ tồn chạy quyền cao (để export của điều dưỡng không vướng RLS)
create or replace function auto_update_stock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (NEW.type = 'import') then
    update inventory_items set current_stock = current_stock + NEW.quantity where id = NEW.item_id;
  elsif (NEW.type = 'export') then
    update inventory_items set current_stock = current_stock - NEW.quantity where id = NEW.item_id;
  end if;
  return NEW;
end $$;

-- 2) Cảnh báo khi tồn DƯỚI mức tối thiểu → báo admin + điều dưỡng (cần notify_relevant từ notify_activity.sql)
create or replace function notify_low_stock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.current_stock <= coalesce(NEW.min_stock, 0)
     and (OLD.current_stock is null or OLD.current_stock > coalesce(OLD.min_stock, 0)) then
    perform notify_relevant(null, 'low_stock',
      'Vật tư sắp hết: ' || NEW.name,
      'Tồn còn ' || NEW.current_stock || ' ' || coalesce(NEW.unit, '') || ' (mức tối thiểu ' || coalesce(NEW.min_stock, 0) || ')',
      null, array['dieu_duong']);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_low_stock on inventory_items;
create trigger trg_notify_low_stock after update on inventory_items for each row execute function notify_low_stock();
