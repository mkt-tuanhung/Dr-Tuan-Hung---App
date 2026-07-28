-- Nhãn (tag) tự do cho source: gấp / VIP / chờ feedback ...
alter table media_customers
  add column if not exists tags text[] not null default '{}';

notify pgrst, 'reload schema';
