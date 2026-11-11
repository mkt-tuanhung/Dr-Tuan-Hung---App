-- (4) 8:00 sáng VN (01:00 UTC): việc hậu phẫu hôm nay -> nhóm Hậu phẫu · (5) đổi trạng thái bàn giao -> báo nhóm CSKH / Hậu phẫu.
-- Thay <ANON_KEY>. Idempotent.
select cron.unschedule(jobid) from cron.job where jobname = 'postop-daily';
select cron.schedule('postop-daily', '0 1 * * *', $$
  select net.http_post(url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'), body := '{"mode":"postop_daily"}'::jsonb);
$$);
create or replace function public.notify_handover() returns trigger
language plpgsql security definer set search_path = public as $q$
begin
  if new.handover_status is distinct from old.handover_status and new.handover_status in ('cho_nhan','da_nhan') then
    perform net.http_post(url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
      body := jsonb_build_object('table', 'handover', 'id', new.id));
  end if;
  return new;
exception when others then return new;
end $q$;
drop trigger if exists trg_notify_handover on public.customer_appointments;
create trigger trg_notify_handover after update of handover_status on public.customer_appointments
  for each row execute function public.notify_handover();
