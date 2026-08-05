-- ============================================================
-- Cập nhật CHI PHÍ ADS CỦA HÔM NAY mỗi giờ (số đang chạy trong ngày).
-- Gọi fb-daily-cost với date = hôm nay (giờ VN) -> module "Chi phí Ads"
-- thấy chi phí hôm nay nhảy dần theo giờ; cuối ngày job fb-daily-cost
-- 00:05 chốt lại số chính xác của cả ngày.
--
-- Trước khi chạy: THAY <ANON_KEY> (Project Settings -> API -> anon public).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'fb-today-cost';

select cron.schedule(
  'fb-today-cost',
  '30 * * * *',   -- phút 30 mỗi giờ
  $$
  select net.http_post(
    url     := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/fb-daily-cost',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := jsonb_build_object('date', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'))
  );
  $$
);

-- Kiểm tra:  select jobname, schedule, active from cron.job where jobname = 'fb-today-cost';
