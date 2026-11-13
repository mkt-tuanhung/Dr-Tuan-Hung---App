-- (13/11/2026, ĐÃ CHẠY) Báo cáo số trực page: "SĐT xin được" do hệ thống tự đếm từ Data khách (từ 13/11/2026),
-- trực page chỉ nhập SĐT quan tâm / tin nhắn / spam. Cron 15 phút cập nhật hôm nay, 00:10 chốt hôm qua.
alter table public.page_daily_reports add column if not exists auto_updated_at timestamptz;
create or replace function public.page_phones_count(p_staff uuid, p_day date) returns int
language sql stable security definer set search_path = public as $f$
  select count(distinct right(regexp_replace(phone, '\D', '', 'g'), 9))::int from (
    select md.phone from marketing_data md
     where md.getfly_id is null and md.truc_page_id = p_staff
       and (md.created_at at time zone 'Asia/Ho_Chi_Minh')::date = p_day
    union all
    select md.phone from marketing_activities a join marketing_data md on md.id = a.data_id
     where a.created_by = p_staff and coalesce(a.content, '') ~* '^Trực page bổ sung thông tin'
       and (a.created_at at time zone 'Asia/Ho_Chi_Minh')::date = p_day
  ) x where length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 9
$f$;
grant execute on function public.page_phones_count(uuid, date) to authenticated;
create or replace function public.refresh_page_phones(p_day date default (now() at time zone 'Asia/Ho_Chi_Minh')::date) returns int
language plpgsql security definer set search_path = public as $f$
declare s record; n int; tele uuid; k int := 0;
begin
  select case when count(*) = 1 then min(id::text)::uuid end into tele
    from profiles where is_active and (role::text = 'telesale' or coalesce(role_2::text, '') = 'telesale');
  for s in select id from profiles where is_active and (role::text = 'truc_page' or coalesce(role_2::text, '') = 'truc_page') loop
    n := page_phones_count(s.id, p_day);
    if n = 0 and not exists (select 1 from page_daily_reports where staff_id = s.id and date = p_day) then continue; end if;
    insert into page_daily_reports (staff_id, date, total_phones, auto_updated_at, telesale_id)
    values (s.id, p_day, n, now(), tele)
    on conflict (staff_id, date) do update
      set total_phones = excluded.total_phones, auto_updated_at = now(),
          telesale_id = coalesce(page_daily_reports.telesale_id, excluded.telesale_id);
    k := k + 1;
  end loop;
  return k;
end $f$;
select cron.unschedule(jobid) from cron.job where jobname in ('page-phones-today', 'page-phones-yesterday');
select cron.schedule('page-phones-today', '*/15 * * * *', $c$ select public.refresh_page_phones(); $c$);
select cron.schedule('page-phones-yesterday', '10 17 * * *', $c$ select public.refresh_page_phones(((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1)); $c$);
