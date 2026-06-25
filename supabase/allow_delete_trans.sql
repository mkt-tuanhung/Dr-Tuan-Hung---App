-- Xoá dòng vật tư đã báo cáo: cho phép xoá giao dịch + tự khôi phục tồn kho

-- Khôi phục tồn kho khi xoá giao dịch (export → cộng lại, import → trừ lại)
create or replace function auto_restore_stock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.type = 'export' then
    update inventory_items set current_stock = current_stock + OLD.quantity where id = OLD.item_id;
  elsif OLD.type = 'import' then
    update inventory_items set current_stock = current_stock - OLD.quantity where id = OLD.item_id;
  end if;
  return OLD;
end $$;
drop trigger if exists trg_restore_stock on inventory_transactions;
create trigger trg_restore_stock after delete on inventory_transactions for each row execute function auto_restore_stock();

-- Cho phép admin/kế toán/điều dưỡng xoá giao dịch kho
drop policy if exists "allow_delete_trans" on inventory_transactions;
create policy "allow_delete_trans" on inventory_transactions for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'accountant', 'dieu_duong'))
);
