-- Thêm trường cho kho media khách hàng
alter table media_customers add column if not exists source_id text;        -- ID source (Tên + ngày quay + STT)
alter table media_customers add column if not exists service text;          -- dịch vụ
alter table media_customers add column if not exists shoot_date date;        -- ngày quay/chụp
alter table media_customers add column if not exists media_in_charge text;    -- media phụ trách / media phụ
