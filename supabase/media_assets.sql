-- Kho tài sản media: mỗi FILE (video/ảnh) trong Drive là 1 dòng.
-- Quét từ hàm scan-drive-folder (mode: 'files') rồi upsert theo drive_id.
create table if not exists media_assets (
  id                uuid primary key default gen_random_uuid(),
  drive_id          text not null unique,
  media_customer_id uuid references media_customers(id) on delete cascade,
  name              text,
  kind              text,                 -- 'video' | 'image'
  mime              text,
  size_bytes        bigint  not null default 0,
  duration_ms       int,                  -- thời lượng video (nếu có)
  folder            text,                 -- tên thư mục chứa (dùng làm tag)
  web_link          text,                 -- link mở trên Drive
  thumb_link        text,                 -- ảnh thu nhỏ (dự phòng)
  created_time      timestamptz,          -- ngày tạo trên Drive
  favorite          boolean not null default false,
  scanned_at        timestamptz default now()
);
create index if not exists media_assets_cust_idx on media_assets(media_customer_id);
create index if not exists media_assets_kind_idx on media_assets(kind);

alter table media_assets enable row level security;
drop policy if exists ma_read on media_assets;
create policy ma_read on media_assets for select to authenticated using (true);
drop policy if exists ma_write on media_assets;
create policy ma_write on media_assets for all to authenticated using (true) with check (true);
grant select, insert, update, delete on media_assets to authenticated;
notify pgrst, 'reload schema';
