-- ============================================================
-- Thêm GIỜ phẫu thuật cho khách phẫu thuật.
-- customer_appointments đã có surgery_date (kiểu date) — nay bổ sung
-- surgery_time (text 'HH:MM') để admin chỉnh ngày + giờ mổ ở module
-- Khách Phẫu Thuật. An toàn để chạy lại (idempotent).
-- Quyền cập nhật: dùng chung policy update sẵn có của admin trên bảng này.
-- ============================================================
alter table customer_appointments
  add column if not exists surgery_time text;

-- Kiểm tra
select column_name, data_type
from information_schema.columns
where table_name = 'customer_appointments'
  and column_name in ('surgery_date', 'surgery_time')
order by column_name;
