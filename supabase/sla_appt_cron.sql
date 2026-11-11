-- Cron: (1) kiểm tra hạn gọi lead mới 15' mỗi 2 phút · (3) nhắc lịch hẹn ngày mai 18:00 VN (11:00 UTC). Thay <ANON_KEY>.
select cron.unschedule(jobid) from cron.job where jobname in ('lead-sla-check', 'appt-remind-tomorrow');
select cron.schedule('lead-sla-check', '*/2 * * * *', $$
  select net.http_post(url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'), body := '{"mode":"sla"}'::jsonb);
$$);
select cron.schedule('appt-remind-tomorrow', '0 11 * * *', $$
  select net.http_post(url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'), body := '{"mode":"appt_remind"}'::jsonb);
$$);
