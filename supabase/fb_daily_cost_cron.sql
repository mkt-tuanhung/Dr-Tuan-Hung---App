-- ============================================================
-- Tự động ghi TỔNG CHI PHÍ Ads mỗi ngày vào module "Chi phí Ads".
-- Chạy 00:05 giờ Việt Nam (= 17:05 UTC) → ghi chi phí của NGÀY HÔM QUA (ngày vừa kết thúc).
--
-- Trước khi chạy: THAY <PROJECT_REF> và <ANON_KEY> bằng của dự án bạn:
--   <PROJECT_REF>: phần đầu URL Supabase, vd https://abcxyz.supabase.co -> abcxyz
--   <ANON_KEY>   : Project Settings -> API -> anon public key
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Gỡ job cũ (nếu đã tạo lần trước) rồi tạo lại
select cron.unschedule(jobid) from cron.job where jobname = 'fb-daily-cost';

select cron.schedule(
  'fb-daily-cost',
  '5 17 * * *',   -- 17:05 UTC = 00:05 giờ VN, mỗi ngày
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/fb-daily-cost',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Kiểm tra job đã tạo:
--   select jobname, schedule, active from cron.job where jobname = 'fb-daily-cost';
