-- Ảnh / video của khách (trực page tải lên khi tạo khách; xem/bổ sung trong hồ sơ). Idempotent.
alter table marketing_data add column if not exists media_urls jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
