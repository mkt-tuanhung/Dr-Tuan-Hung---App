-- ============================================================
-- Cron 5 phút/lần: quét clip đến giờ hẹn & đã có ID bài đăng -> tự tạo
-- chiến dịch Facebook (gọi edge function fb-create-campaign).
--
-- Trước khi chạy:
--   1) Deploy function: fb-create-campaign
--   2) THAY <ANON_KEY> (Project Settings -> API -> anon public).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'fb-create-campaign';

select cron.schedule(
  'fb-create-campaign',
  '*/5 * * * *',   -- mỗi 5 phút
  $$
  select net.http_post(
    url     := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/fb-create-campaign',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Kiểm tra:  select jobname, schedule, active from cron.job where jobname = 'fb-create-campaign';
