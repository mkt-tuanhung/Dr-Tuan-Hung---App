-- ============================================================
-- 1 khách có thể do 2 telesale phụ trách → thêm telesale phụ thứ 2
-- Doanh thu & hoa hồng telesale sẽ chia đều khi có 2 người.
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================
alter table customer_appointments add column if not exists telesale_id_2 uuid references profiles(id);

-- Cho telesale phụ thứ 2 cũng đọc/sửa được lịch của mình
drop policy if exists "telesale2_read_write" on customer_appointments;
create policy "telesale2_read_write" on customer_appointments
  for all using (telesale_id_2 = auth.uid());
