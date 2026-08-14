-- ============================================================
-- Đồng bộ Messenger định kỳ (lưới dự phòng — realtime đã có webhook):
--   - Mỗi 10 phút: kéo 25 hội thoại mới nhất mỗi page.
--   - 3h sáng VN (20:00 UTC): kéo sâu 200 hội thoại × 200 tin (lịch sử).
-- THAY <ANON_KEY> rồi chạy trong SQL Editor. Idempotent.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'fb-messenger-10min';
select cron.unschedule(jobid) from cron.job where jobname = 'fb-messenger-deep';

select cron.schedule(
  'fb-messenger-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/fb-messenger-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'fb-messenger-deep',
  '0 20 * * *',
  $$
  select net.http_post(
    url     := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/fb-messenger-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{"conversations": 200, "messages_per": 200}'::jsonb
  );
  $$
);
