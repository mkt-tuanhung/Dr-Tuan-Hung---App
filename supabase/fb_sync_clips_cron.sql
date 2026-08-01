-- ============================================================
-- Tự động cập nhật chỉ số Facebook cho MỌI clip đã gán ID chiến dịch,
-- chạy MỖI 60 PHÚT (đầu mỗi giờ). Gọi edge function fb-sync-clips.
--
-- Trước khi chạy:
--   1) Deploy function: supabase functions deploy fb-sync-clips
--      (dùng chung secret FB_ADS_TOKEN đã có)
--   2) THAY <PROJECT_REF> và <ANON_KEY>:
--      <PROJECT_REF>: vd https://wlblywjdghjwwuumzecc.supabase.co -> wlblywjdghjwwuumzecc
--      <ANON_KEY>   : Project Settings -> API -> anon public key
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Gỡ job cũ (nếu có) rồi tạo lại
select cron.unschedule(jobid) from cron.job where jobname = 'fb-sync-clips';

select cron.schedule(
  'fb-sync-clips',
  '0 * * * *',   -- phút 0 mỗi giờ = mỗi 60 phút
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/fb-sync-clips',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Kiểm tra:
--   select jobname, schedule, active from cron.job where jobname = 'fb-sync-clips';
