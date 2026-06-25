-- Thông báo thêm lịch hẹn / khách cọc: bỏ kế toán (chỉ admin + sale/telesale/cskh)
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
      array['sale_offline', 'telesale', 'cskh']);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_new_appointment on customer_appointments;
create trigger trg_notify_new_appointment after insert on customer_appointments for each row execute function notify_new_appointment();

-- Dọn thông báo lịch hẹn cũ đã gửi cho kế toán
delete from notifications
where type = 'new_appointment'
  and user_id in (select id from profiles where role::text = 'accountant');
