-- (13/11/2026) Giờ nghỉ telesale: nghỉ trưa 12:00–13:30, di chuyển 18:00–19:30 (giờ VN) -> không nhắc gọi.
-- Hạn gọi rơi vào giờ nghỉ được dời sang 13:45 / 19:45; đúng 13:30 / 19:30 gửi 1 tin gom "gọi ngay".
create or replace function public.md_set_sla() returns trigger
language plpgsql security definer set search_path = public as $q$
declare loc timestamp; due timestamp; m int;
begin
  if new.getfly_id is not null then return new; end if;            -- dữ liệu chuyển từ GetFly: không tính
  loc := coalesce(new.created_at, now()) at time zone 'Asia/Ho_Chi_Minh';
  if extract(hour from loc) < 8 then due := date_trunc('day', loc) + interval '8 hours 15 minutes';
  elsif extract(hour from loc) >= 21 then due := date_trunc('day', loc) + interval '1 day 8 hours 15 minutes';
  else due := loc + interval '15 minutes'; end if;
  m := extract(hour from due)::int * 60 + extract(minute from due)::int;
  if m >= 12 * 60 and m < 13 * 60 + 30 then due := date_trunc('day', due) + interval '13 hours 45 minutes';
  elsif m >= 18 * 60 and m < 19 * 60 + 30 then due := date_trunc('day', due) + interval '19 hours 45 minutes'; end if;
  new.sla_due_at := due at time zone 'Asia/Ho_Chi_Minh';
  return new;
end $q$;

select cron.unschedule(jobid) from cron.job where jobname in ('sla-resume-noon', 'sla-resume-evening');
select cron.schedule('sla-resume-noon', '30 6 * * *', $$
  select net.http_post(url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'), body := '{"mode":"sla_resume"}'::jsonb);
$$);
select cron.schedule('sla-resume-evening', '30 12 * * *', $$
  select net.http_post(url := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'), body := '{"mode":"sla_resume"}'::jsonb);
$$);
