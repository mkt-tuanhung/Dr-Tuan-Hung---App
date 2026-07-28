-- Gán ID chiến dịch Facebook vào clip + lưu chỉ số kéo về.
alter table media_clips
  add column if not exists fb_campaign_id text,
  add column if not exists fb_spend       numeric not null default 0,
  add column if not exists fb_messages    int     not null default 0,
  add column if not exists fb_leads       int     not null default 0,
  add column if not exists fb_purchases   int     not null default 0,
  add column if not exists fb_reach       bigint  not null default 0,
  add column if not exists fb_impressions bigint  not null default 0,
  add column if not exists fb_results     int     not null default 0,
  add column if not exists fb_status      text,   -- ACTIVE / PAUSED... lấy từ Facebook
  add column if not exists fb_synced_at   timestamptz;

notify pgrst, 'reload schema';
