-- Nhãn "Đăng ngay": Ads bật cờ này -> hệ thống ngoài (của chủ) tự quét & đăng video lên page.
-- Hệ thống ngoài đọc các clip có post_now = true và post_status = 'queued',
-- sau khi đăng xong thì cập nhật post_status = 'posted' + posted_at.
alter table media_clips
  add column if not exists post_now     boolean not null default false,
  add column if not exists post_now_at  timestamptz,                 -- thời điểm bật Đăng ngay
  add column if not exists post_status  text,                        -- queued | posted | failed
  add column if not exists posted_at    timestamptz;                 -- hệ thống ngoài điền khi đăng xong

create index if not exists media_clips_post_now_idx on media_clips(post_now) where post_now = true;
notify pgrst, 'reload schema';
