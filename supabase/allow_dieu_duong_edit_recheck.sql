-- ============================================================
-- Cho phép ĐIỀU DƯỠNG sửa LỊCH TÁI KHÁM (service bắt đầu "[Tái khám]")
-- Admin đã có admin_all nên không cần thêm. An toàn cho prod.
-- ============================================================
drop policy if exists "dieu_duong_update_recheck" on customer_appointments;
create policy "dieu_duong_update_recheck" on customer_appointments
  for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'dieu_duong')
    and service like '[Tái khám]%'
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'dieu_duong')
    and service like '[Tái khám]%'
  );
