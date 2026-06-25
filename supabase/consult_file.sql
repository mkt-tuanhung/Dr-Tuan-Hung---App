-- Hồ sơ tư vấn (ghi chú + ảnh) gắn vào khách khi Sale offline đánh giá
alter table customer_appointments add column if not exists consult_note text;
alter table customer_appointments add column if not exists consult_image_urls text[] default '{}';
