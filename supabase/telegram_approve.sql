-- ============================================================
-- Duyệt qua Telegram (nút ✅ Duyệt / ❌ Từ chối)
-- Áp dụng: khoản chi (expenses) + nghỉ phép (leave_requests)
-- ============================================================

-- Cột mang "hành động cần duyệt" cho notifications
alter table notifications add column if not exists action_type text; -- 'expense' | 'leave'
alter table notifications add column if not exists action_id uuid;

-- Trigger: khoản chi mới (pending) -> báo người duyệt (admin + kế toán)
create or replace function notify_expense_request() returns trigger language plpgsql security definer set search_path = public as $$
declare sname text; kind text;
begin
  if NEW.status = 'pending' then
    select full_name into sname from profiles where id = NEW.staff_id;
    kind := case when NEW.is_advance then 'tạm ứng' else 'khoản chi' end;
    insert into notifications(user_id, actor_id, type, title, body, link, action_type, action_id)
    select p.id, NEW.staff_id, 'expense_request',
           coalesce(sname, 'Nhân sự') || ' xin duyệt ' || kind,
           'Số tiền ' || to_char(NEW.amount, 'FM999G999G999') || 'đ' || coalesce(' · ' || NEW.description, ''),
           'advances', 'expense', NEW.id
    from profiles p
    where p.role in ('admin', 'accountant') and p.id <> NEW.staff_id;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_expense_request on expenses;
create trigger trg_notify_expense_request after insert on expenses for each row execute function notify_expense_request();

-- Trigger: đơn nghỉ mới (pending) -> báo người duyệt
create or replace function notify_leave_request() returns trigger language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  if NEW.status = 'pending' then
    select full_name into sname from profiles where id = NEW.staff_id;
    insert into notifications(user_id, actor_id, type, title, body, link, action_type, action_id)
    select p.id, NEW.staff_id, 'leave_request',
           coalesce(sname, 'Nhân sự') || ' xin nghỉ phép',
           to_char(NEW.date, 'DD/MM/YYYY') || coalesce(' · ' || NEW.reason, ''),
           'leave', 'leave', NEW.id
    from profiles p
    where p.role in ('admin', 'accountant') and p.id <> NEW.staff_id;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_leave_request on leave_requests;
create trigger trg_notify_leave_request after insert on leave_requests for each row execute function notify_leave_request();

-- RPC: xử lý duyệt/từ chối từ Telegram (xác thực quyền theo chat_id)
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
      if exists (select 1 from attendance where staff_id = r.staff_id and date = r.date) then
        update attendance set status = att_status,
               leave_type = case when r.type = 'half_day' then r.half_day_period else null end,
               note = 'Đã duyệt đơn: ' || coalesce(r.reason, '')
        where staff_id = r.staff_id and date = r.date;
      else
        insert into attendance(staff_id, date, status, leave_type, note)
        values (r.staff_id, r.date, att_status,
                case when r.type = 'half_day' then r.half_day_period else null end,
                'Đã duyệt đơn: ' || coalesce(r.reason, ''));
      end if;
      return '✅ Đã DUYỆT đơn nghỉ của ' || coalesce(r.staff_name, 'NV') || ' ngày ' || to_char(r.date, 'DD/MM/YYYY');
    else
      update leave_requests set status = 'rejected', reviewed_at = now() where id = p_action_id;
      return '❌ Đã TỪ CHỐI đơn nghỉ của ' || coalesce(r.staff_name, 'NV');
    end if;
  end if;
  return '❓ Loại yêu cầu không hợp lệ.';
end $$;
