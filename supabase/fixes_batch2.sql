-- ============================================================
-- Sửa: duyệt nghỉ phép trên Telegram (#1) + link thông báo nghỉ (#5)
-- ============================================================

-- #5 — link thông báo nghỉ trỏ tới Quản lý Nhân sự > tab Đơn từ
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
    from profiles p where p.role in ('admin', 'accountant') and p.id <> NEW.staff_id;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_leave_request on leave_requests;
create trigger trg_notify_leave_request after insert on leave_requests for each row execute function notify_leave_request();

update notifications set link = 'hr#leave' where action_type = 'leave';

-- #1 — tg_resolve: bọc ghi chấm công trong exception để không rollback việc duyệt đơn
create or replace function tg_resolve(p_action_type text, p_action_id uuid, p_approve boolean, p_chat_id text)
returns text language plpgsql security definer set search_path = public as $$
declare approver uuid; arole text; r record; att_status text;
begin
  select id, role into approver, arole from profiles where telegram_chat_id = p_chat_id;
  if approver is null then return '⚠️ Tài khoản Telegram chưa liên kết.'; end if;
  if arole not in ('admin', 'accountant') then return '⛔ Bạn không có quyền duyệt.'; end if;

  if p_action_type = 'expense' then
    select e.*, pr.full_name as staff_name into r
    from expenses e left join profiles pr on pr.id = e.staff_id where e.id = p_action_id;
    if not found then return '❓ Không tìm thấy khoản chi.'; end if;
    if r.status <> 'pending' then return 'ℹ️ Khoản chi đã được xử lý trước đó (' || r.status || ').'; end if;
    if p_approve then
      update expenses set status = 'approved', approved_by = approver, approved_at = now() where id = p_action_id;
      return '✅ Đã DUYỆT ' || (case when r.is_advance then 'tạm ứng' else 'khoản chi' end)
             || ' của ' || coalesce(r.staff_name, 'NV') || ' — ' || to_char(r.amount, 'FM999G999G999') || 'đ';
    else
      update expenses set status = 'rejected', reject_reason = 'Từ chối qua Telegram' where id = p_action_id;
      return '❌ Đã TỪ CHỐI khoản chi của ' || coalesce(r.staff_name, 'NV');
    end if;

  elsif p_action_type = 'leave' then
    select lr.*, pr.full_name as staff_name into r
    from leave_requests lr left join profiles pr on pr.id = lr.staff_id where lr.id = p_action_id;
    if not found then return '❓ Không tìm thấy đơn nghỉ.'; end if;
    if r.status <> 'pending' then return 'ℹ️ Đơn đã được xử lý trước đó (' || r.status || ').'; end if;
    if p_approve then
      update leave_requests set status = 'approved', reviewed_at = now() where id = p_action_id;
      att_status := case r.type when 'leave' then 'leave' when 'half_day' then 'half_day'
                                when 'late' then 'late' when 'early' then 'early_leave' else 'present' end;
      -- Ghi chấm công: bọc exception để nếu cấu trúc attendance khác cũng không làm hỏng việc duyệt
      begin
        if exists (select 1 from attendance where staff_id = r.staff_id and date = r.date) then
          update attendance set status = att_status where staff_id = r.staff_id and date = r.date;
        else
          insert into attendance(staff_id, date, status) values (r.staff_id, r.date, att_status);
        end if;
      exception when others then null;
      end;
      return '✅ Đã DUYỆT đơn nghỉ của ' || coalesce(r.staff_name, 'NV') || ' ngày ' || to_char(r.date, 'DD/MM/YYYY');
    else
      update leave_requests set status = 'rejected', reviewed_at = now() where id = p_action_id;
      return '❌ Đã TỪ CHỐI đơn nghỉ của ' || coalesce(r.staff_name, 'NV');
    end if;
  end if;
  return '❓ Loại yêu cầu không hợp lệ.';
end $$;
