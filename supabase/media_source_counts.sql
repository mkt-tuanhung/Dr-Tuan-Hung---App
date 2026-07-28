-- Đếm số video / ảnh trong source gốc của khách (soi đệ quy các thư mục con).
alter table media_customers
  add column if not exists source_video_count int not null default 0,
  add column if not exists source_image_count int not null default 0;

notify pgrst, 'reload schema';
