-- Nhắc buổi sáng 8:15 giờ VN (01:15 UTC): việc chăm data hôm nay của từng telesale -> nhóm Telegram DATA KHÁCH HÀNG.
-- Thay <ANON_KEY>. Idempotent.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'data-khach-morning';
select cron.schedule('data-khach-morning', '15 1 * * *', $$
  select net.http_post(
    url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body := '{"mode":"morning"}'::jsonb);
$$);
