-- Cho phép telesale xem & sửa mọi lịch hẹn (admin đã có admin_all)
drop policy if exists "telesale_manage_appointments" on customer_appointments;
create policy "telesale_manage_appointments" on customer_appointments
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text = 'telesale' or p.role_2::text = 'telesale')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text = 'telesale' or p.role_2::text = 'telesale')));
