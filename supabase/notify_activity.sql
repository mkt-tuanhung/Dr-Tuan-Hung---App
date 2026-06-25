-- ============================================================
-- Thông báo hoạt động: nhân sự thao tác → báo admin + người liên quan
-- ============================================================

-- Helper: gửi thông báo cho admin + các vai trò liên quan (trừ người thao tác)
create or replace function notify_relevant(p_actor uuid, p_type text, p_title text, p_body text, p_link text, p_roles text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, actor_id, type, title, body, link)
  select p.id, p_actor, p_type, p_title, p_body, p_link
  from profiles p
  where coalesce(p.is_active, true) = true
    and (p.role = 'admin' or p.role = any(p_roles) or p.role_2 = any(p_roles))
    and p.id is distinct from p_actor;
end $$;

-- 1) Nhân sự thêm lịch hẹn / khách cọc mới → báo admin + đội sale/telesale/kế toán/cskh
create or replace function notify_new_appointment() returns trigger language plpgsql security definer set search_path = public as $$
declare aname text; lbl text; lnk text;
begin
  if NEW.status in ('scheduled', 'coc') then
    select full_name into aname from profiles where id = NEW.created_by;
    if NEW.status = 'coc' then lbl := 'thêm khách cọc'; lnk := null;
    else lbl := 'thêm lịch hẹn'; lnk := 'appointments'; end if;
    perform notify_relevant(
      NEW.created_by, 'new_appointment',
      coalesce(aname, 'Nhân sự') || ' đã ' || lbl || ': ' || coalesce(NEW.customer_name, ''),
      coalesce(NEW.service, ''), lnk,
      array['sale_offline', 'telesale', 'accountant', 'cskh']);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_new_appointment on customer_appointments;
create trigger trg_notify_new_appointment after insert on customer_appointments for each row execute function notify_new_appointment();

-- 2) Nhân sự gửi báo cáo ngày (page/cskh/marketing/media) → báo admin
create or replace function notify_daily_report() returns trigger language plpgsql security definer set search_path = public as $$
declare aname text;
begin
  select full_name into aname from profiles where id = NEW.staff_id;
  perform notify_relevant(
    NEW.staff_id, 'daily_report',
    coalesce(aname, 'Nhân sự') || ' đã gửi báo cáo ngày ' || to_char(NEW.date, 'DD/MM/YYYY'),
    null, 'kpi', array[]::text[]);  -- mảng rỗng → chỉ admin
  return NEW;
end $$;

drop trigger if exists trg_notify_page_report on page_daily_reports;
create trigger trg_notify_page_report after insert on page_daily_reports for each row execute function notify_daily_report();

drop trigger if exists trg_notify_cskh_report on cskh_daily_reports;
create trigger trg_notify_cskh_report after insert on cskh_daily_reports for each row execute function notify_daily_report();

drop trigger if exists trg_notify_marketing_report on marketing_daily_reports;
create trigger trg_notify_marketing_report after insert on marketing_daily_reports for each row execute function notify_daily_report();

drop trigger if exists trg_notify_media_report on media_daily_reports;
create trigger trg_notify_media_report after insert on media_daily_reports for each row execute function notify_daily_report();
