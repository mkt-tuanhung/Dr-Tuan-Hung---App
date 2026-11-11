-- Ảnh / video đính kèm trong nhật ký gọi / ghi chú khách (Data khách). Idempotent.
alter table marketing_activities add column if not exists media_urls jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
