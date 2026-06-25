-- Cho điều dưỡng (và CSKH) đọc lịch sử giao dịch kho — để thấy "Đã báo cáo",
-- "Lịch sử Nhập/Xuất" và "Vật tư theo khách"
drop policy if exists "allow_read_trans" on inventory_transactions;
create policy "allow_read_trans" on inventory_transactions for select using (
  exists (select 1 from profiles p where p.id = auth.uid()
          and p.role::text in ('admin', 'accountant', 'shareholder', 'dieu_duong', 'cskh'))
);
