-- Cho kế toán sửa viện phí (UPDATE customer_appointments). Admin đã có admin_all.
drop policy if exists "acct_update_appointments" on customer_appointments;
create policy "acct_update_appointments" on customer_appointments for update
  using (public.is_accountant())
  with check (public.is_accountant());
