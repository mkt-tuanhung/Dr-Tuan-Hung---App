-- Đơn nghỉ phép: CHỈ admin nhận thông báo (bỏ kế toán & các vai trò khác)
create or replace function notify_leave_request() returns trigger language plpgsql security definer set search_path = public as $$
declare sname text; tlabel text;
begin
  if NEW.status = 'pending' then
    select full_name into sname from profiles where id = NEW.staff_id;
    tlabel := case NEW.type
      when 'late' then 'Xin đi muộn'
      when 'early' then 'Xin về sớm'
      when 'leave' then 'Xin nghỉ cả ngày'
      when 'half_day' then 'Xin nghỉ nửa ngày' ||
           coalesce(case NEW.half_day_period when 'morning' then ' (buổi sáng)' when 'afternoon' then ' (buổi chiều)' else '' end, '')
      else 'Xin nghỉ phép' end;
    insert into notifications(user_id, actor_id, type, title, body, link, action_type, action_id)
    select p.id, NEW.staff_id, 'leave_request',
           coalesce(sname, 'Nhân sự') || ' — ' || tlabel,
           'Ngày ' || to_char(NEW.date, 'DD/MM/YYYY') || coalesce(' · Lý do: ' || NEW.reason, ''),
           'hr#leave', 'leave', NEW.id
    from profiles p where p.role::text = 'admin' and p.id <> NEW.staff_id;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_leave_request on leave_requests;
create trigger trg_notify_leave_request after insert on leave_requests for each row execute function notify_leave_request();
