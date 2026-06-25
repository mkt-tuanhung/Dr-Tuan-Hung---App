-- ============================================================
-- Tăng ca + Ứng lương
-- ============================================================

-- 1) Giờ tăng ca theo ngày + cột lưu vào bảng lương
alter table attendance add column if not exists overtime_hours numeric default 0;
alter table payroll add column if not exists overtime_pay numeric default 0;
alter table payroll add column if not exists salary_advance numeric default 0;

-- 2) Ứng lương (trừ vào bảng lương khi được duyệt)
create table if not exists salary_advances (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references profiles(id) on delete cascade not null,
  amount numeric not null,
  reason text,
  status text default 'pending',  -- pending | approved | rejected
  reject_reason text,
  month smallint, year smallint,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table salary_advances enable row level security;
drop policy if exists "sa_read" on salary_advances;
drop policy if exists "sa_insert" on salary_advances;
drop policy if exists "sa_manage" on salary_advances;
create policy "sa_read" on salary_advances for select using (
  staff_id = auth.uid() or public.is_admin() or public.is_accountant());
create policy "sa_insert" on salary_advances for insert with check (
  public.is_admin() or public.is_accountant() or staff_id = auth.uid());
create policy "sa_manage" on salary_advances for all using (
  public.is_admin() or public.is_accountant()) with check (public.is_admin() or public.is_accountant());

do $$ begin alter publication supabase_realtime add table salary_advances; exception when duplicate_object then null; end $$;

-- Có yêu cầu ứng lương → báo admin + kế toán (kèm nút duyệt Telegram)
create or replace function notify_salary_advance() returns trigger language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  if NEW.status = 'pending' then
    select full_name into sname from profiles where id = NEW.staff_id;
    insert into notifications(user_id, actor_id, type, title, body, link, action_type, action_id)
    select p.id, NEW.staff_id, 'salary_advance_request',
      coalesce(sname, 'Nhân sự') || ' xin ứng lương ' || to_char(NEW.amount, 'FM999G999G999') || 'đ',
      coalesce(NEW.reason, ''), 'payroll', 'salary_advance', NEW.id
    from profiles p where p.role::text in ('admin', 'accountant') and p.id <> NEW.staff_id;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_salary_advance on salary_advances;
create trigger trg_notify_salary_advance after insert on salary_advances for each row execute function notify_salary_advance();

-- Kết quả duyệt → báo nhân sự (kèm lý do nếu từ chối)
create or replace function notify_salary_advance_result() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status is distinct from OLD.status and NEW.status in ('approved', 'rejected') then
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (NEW.staff_id, NEW.reviewed_by,
      case when NEW.status = 'approved' then 'salary_advance_approved' else 'salary_advance_rejected' end,
      case when NEW.status = 'approved' then 'Đơn ứng lương đã được DUYỆT' else 'Đơn ứng lương bị TỪ CHỐI' end,
      case when NEW.status = 'approved' then 'Số tiền ' || to_char(NEW.amount, 'FM999G999G999') || 'đ'
           else coalesce('Lý do: ' || NEW.reject_reason, 'Đã từ chối') end,
      'advances');
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_salary_advance_result on salary_advances;
create trigger trg_notify_salary_advance_result after update on salary_advances for each row execute function notify_salary_advance_result();

-- 3) tg_resolve: thêm nhánh duyệt ỨNG LƯƠNG (giữ expense/leave/device)
create or replace function tg_resolve(p_action_type text, p_action_id uuid, p_approve boolean, p_chat_id text)
returns text language plpgsql security definer set search_path = public as $$
declare approver uuid; arole text; r record; att_status text;
begin
  select id, role::text into approver, arole from profiles where telegram_chat_id = p_chat_id;
  if approver is null then return '⚠️ Tài khoản Telegram chưa liên kết.'; end if;
  if arole not in ('admin', 'accountant') then return '⛔ Bạn không có quyền duyệt.'; end if;

  if p_action_type = 'expense' then
    select e.*, pr.full_name as staff_name into r from expenses e left join profiles pr on pr.id = e.staff_id where e.id = p_action_id;
    if not found then return '❓ Không tìm thấy khoản chi.'; end if;
    if r.status <> 'pending' then return 'ℹ️ Đã xử lý trước đó (' || r.status || ').'; end if;
    if p_approve then
      update expenses set status = 'approved', approved_by = approver, approved_at = now() where id = p_action_id;
      return '✅ Đã DUYỆT ' || (case when r.is_advance then 'tạm ứng' else 'khoản chi' end) || ' của ' || coalesce(r.staff_name, 'NV') || ' — ' || to_char(r.amount, 'FM999G999G999') || 'đ';
    else
      update expenses set status = 'rejected', reject_reason = 'Từ chối qua Telegram' where id = p_action_id;
      return '❌ Đã TỪ CHỐI khoản chi của ' || coalesce(r.staff_name, 'NV');
    end if;

  elsif p_action_type = 'leave' then
    select lr.*, pr.full_name as staff_name into r from leave_requests lr left join profiles pr on pr.id = lr.staff_id where lr.id = p_action_id;
    if not found then return '❓ Không tìm thấy đơn nghỉ.'; end if;
    if r.status <> 'pending' then return 'ℹ️ Đã xử lý trước đó (' || r.status || ').'; end if;
    if p_approve then
      update leave_requests set status = 'approved', reviewed_at = now() where id = p_action_id;
      att_status := case r.type when 'leave' then 'leave' when 'half_day' then 'half_day' when 'late' then 'late' when 'early' then 'early_leave' else 'present' end;
      begin
        if exists (select 1 from attendance where staff_id = r.staff_id and date = r.date) then
          update attendance set status = att_status where staff_id = r.staff_id and date = r.date;
        else
          insert into attendance(staff_id, date, status) values (r.staff_id, r.date, att_status);
        end if;
      exception when others then null; end;
      return '✅ Đã DUYỆT đơn nghỉ của ' || coalesce(r.staff_name, 'NV') || ' ngày ' || to_char(r.date, 'DD/MM/YYYY');
    else
      update leave_requests set status = 'rejected', reviewed_at = now() where id = p_action_id;
      return '❌ Đã TỪ CHỐI đơn nghỉ của ' || coalesce(r.staff_name, 'NV');
    end if;

  elsif p_action_type = 'device' then
    select td.*, pr.full_name as staff_name into r from trusted_devices td left join profiles pr on pr.id = td.user_id where td.id = p_action_id;
    if not found then return '❓ Không tìm thấy yêu cầu thiết bị.'; end if;
    if r.approved then return 'ℹ️ Thiết bị đã được duyệt.'; end if;
    if p_approve then
      update trusted_devices set approved = true, approved_at = now(), approved_by = approver where id = p_action_id;
      return '✅ Đã DUYỆT thiết bị mới cho ' || coalesce(r.staff_name, 'NV');
    else
      delete from trusted_devices where id = p_action_id;
      return '❌ Đã TỪ CHỐI thiết bị của ' || coalesce(r.staff_name, 'NV');
    end if;

  elsif p_action_type = 'salary_advance' then
    select sa.*, pr.full_name as staff_name into r from salary_advances sa left join profiles pr on pr.id = sa.staff_id where sa.id = p_action_id;
    if not found then return '❓ Không tìm thấy đơn ứng lương.'; end if;
    if r.status <> 'pending' then return 'ℹ️ Đã xử lý trước đó (' || r.status || ').'; end if;
    if p_approve then
      update salary_advances set status = 'approved', reviewed_by = approver, reviewed_at = now() where id = p_action_id;
      return '✅ Đã DUYỆT ứng lương ' || to_char(r.amount, 'FM999G999G999') || 'đ cho ' || coalesce(r.staff_name, 'NV');
    else
      update salary_advances set status = 'rejected', reviewed_by = approver, reviewed_at = now(), reject_reason = 'Từ chối qua Telegram' where id = p_action_id;
      return '❌ Đã TỪ CHỐI ứng lương của ' || coalesce(r.staff_name, 'NV');
    end if;
  end if;
  return '❓ Loại yêu cầu không hợp lệ.';
end $$;
