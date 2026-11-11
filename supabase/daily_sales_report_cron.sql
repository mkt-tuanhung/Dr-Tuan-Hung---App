-- BÁO CÁO SALE NGÀY HÔM TRƯỚC: 7:00 sáng giờ VN (00:00 UTC) -> nhóm Telegram DATA KHÁCH HÀNG, kèm link /bao-cao/<mã>.
-- Thay <ANON_KEY>. Idempotent.
select cron.unschedule(jobid) from cron.job where jobname = 'daily-sales-report';
select cron.schedule('daily-sales-report', '0 0 * * *', $$
  select net.http_post(
    url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body := '{"mode":"daily_report"}'::jsonb);
$$);
