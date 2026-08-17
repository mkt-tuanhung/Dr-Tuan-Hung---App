-- ============================================================
-- TỰ ĐỘNG đồng bộ GetFly -> Data khách hàng (không cần bấm nút)
--   1) MỖI 10 PHÚT: đồng bộ FULL — mọi thay đổi trên GetFly (khách mới, note,
--      đổi mối quan hệ…) về app trong tối đa ~10 phút. (Giảm từ 1 phút để
--      tiết kiệm hạn mức gói Free — bớt ~90% lượt gọi + băng thông.)
--   2) MỖI ĐÊM 2h SÁNG (giờ VN): kéo FULL toàn bộ để đồng bộ cả các khách
--      cũ bị sửa tên/thông tin trên GetFly.
--
-- Trước khi chạy:
--   1) Deploy function: supabase functions deploy getfly-sync
--      (secrets GETFLY_DOMAIN + GETFLY_API_KEY đã đặt)
--   2) THAY <PROJECT_REF> và <ANON_KEY>:
--      <PROJECT_REF>: vd https://wlblywjdghjwwuumzecc.supabase.co -> wlblywjdghjwwuumzecc
--      <ANON_KEY>   : Project Settings -> API -> anon public key
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Gỡ job cũ (nếu có) rồi tạo lại
select cron.unschedule(jobid) from cron.job where jobname = 'getfly-sync-5min';
select cron.unschedule(jobid) from cron.job where jobname = 'getfly-sync-1min';
select cron.unschedule(jobid) from cron.job where jobname = 'getfly-sync-10min';
select cron.unschedule(jobid) from cron.job where jobname = 'getfly-sync-full';

-- 1) MỖI 10 PHÚT: đồng bộ FULL (kho ~1.5k khách nên chỉ vài giây/lượt)
select cron.schedule(
  'getfly-sync-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/getfly-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{}'::jsonb
  );
  $$
);

-- 2) Mỗi đêm 2h sáng VN (19:00 UTC): kéo FULL toàn bộ
select cron.schedule(
  'getfly-sync-full',
  '0 19 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/getfly-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Kiểm tra:
--   select jobname, schedule, active from cron.job where jobname like 'getfly%';
