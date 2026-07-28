-- Lưu danh sách TÊN thư mục con đọc được trong link Drive của khách (hiện nguyên tên lên thẻ).
alter table media_customers
  add column if not exists source_folders text[] not null default '{}';

notify pgrst, 'reload schema';
