-- Giờ đi muộn/về sớm mỗi ngày — tổng trong tháng sẽ TRỪ vào giờ tăng ca khi tính lương.
alter table attendance
  add column if not exists late_early_hours numeric not null default 0;
notify pgrst, 'reload schema';
