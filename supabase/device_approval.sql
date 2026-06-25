-- ============================================================
-- Phê duyệt đăng nhập thiết bị mới qua Admin
-- (Cần đã chạy community_members.sql để có hàm public.is_admin())
-- ============================================================

create table if not exists trusted_devices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  device_id text not null,
  device_label text,
  approved boolean default false,
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(user_id, device_id)
);
alter table trusted_devices enable row level security;

drop policy if exists "td_read" on trusted_devices;
drop policy if exists "td_insert" on trusted_devices;
drop policy if exists "td_update" on trusted_devices;
drop policy if exists "td_delete" on trusted_devices;
create policy "td_read" on trusted_devices for select using (user_id = auth.uid() or public.is_admin());
create policy "td_insert" on trusted_devices for insert with check (user_id = auth.uid());
create policy "td_update" on trusted_devices for update using (public.is_admin()) with check (public.is_admin());
create policy "td_delete" on trusted_devices for delete using (public.is_admin());

-- Thiết bị ĐẦU TIÊN của 1 user → tự duyệt; thiết bị sau → chờ duyệt.
-- (Chạy ở DB nên client KHÔNG thể tự đặt approved=true để lách)
create or replace function td_autoapprove() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trusted_devices where user_id = NEW.user_id) then
    NEW.approved := true; NEW.approved_at := now();
  else
    NEW.approved := false; NEW.approved_at := null; NEW.approved_by := null;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_td_autoapprove on trusted_devices;
create trigger trg_td_autoapprove before insert on trusted_devices for each row execute function td_autoapprove();

-- Thiết bị cần duyệt → báo cho tất cả admin (kèm nút duyệt trên Telegram)
create or replace function notify_device_request() returns trigger language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  if NEW.approved = false then
    select full_name into uname from profiles where id = NEW.user_id;
    insert into notifications(user_id, actor_id, type, title, body, link, action_type, action_id)
    select p.id, NEW.user_id, 'device_request',
           coalesce(uname, 'Nhân sự') || ' đăng nhập thiết bị MỚI — cần phê duyệt',
           coalesce(NEW.device_label, ''), null, 'device', NEW.id
    from profiles p where p.role = 'admin';
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_device_request on trusted_devices;
create trigger trg_notify_device_request after insert on trusted_devices for each row execute function notify_device_request();

-- Realtime để màn chờ tự cập nhật khi admin duyệt
do $$ begin alter publication supabase_realtime add table trusted_devices; exception when duplicate_object then null; end $$;

-- Mở rộng tg_resolve: thêm duyệt/từ chối THIẾT BỊ (giữ nguyên expense + leave)
create or replace function tg_resolve(p_action_type text, p_action_id uuid, p_approve boolean, p_chat_id text)
returns text language plpgsql security definer set search_path = public as $$
declare approver uuid; arole text; r record; att_status text;
begin
  select id, role into approver, arole from profiles where telegram_chat_id = p_chat_id;
  if approver is null then return '⚠️ Tài khoản Telegram chưa liên kết.'; end if;
  if arole not in ('admin', 'accountant') then return '⛔ Bạn không có quyền duyệt.'; end if;

  if p_action_type = 'expense' then
    select e.*, pr.full_name as staff_name into r from expenses e left join profiles pr on pr.id = e.staff_id where e.id = p_action_id;
    if not found then return '❓ Không tìm thấy khoản chi.'; end if;
    if r.status <> 'pending' then return 'ℹ️ Khoản chi đã được xử lý trước đó (' || r.status || ').'; end if;
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
    if r.status <> 'pending' then return 'ℹ️ Đơn đã được xử lý trước đó (' || r.status || ').'; end if;
    if p_approve then
      update leave_requests set status = 'approved', reviewed_at = now() where id = p_action_id;
      att_status := case r.type when 'leave' then 'leave' when 'half_day' then 'half_day' when 'late' then 'late' when 'early' then 'early_leave' else 'present' end;
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

  elsif p_action_type = 'device' then
    select td.*, pr.full_name as staff_name into r from trusted_devices td left join profiles pr on pr.id = td.user_id where td.id = p_action_id;
    if not found then return '❓ Không tìm thấy yêu cầu thiết bị.'; end if;
    if r.approved then return 'ℹ️ Thiết bị đã được duyệt trước đó.'; end if;
    if p_approve then
      update trusted_devices set approved = true, approved_at = now(), approved_by = approver where id = p_action_id;
      return '✅ Đã DUYỆT thiết bị mới cho ' || coalesce(r.staff_name, 'NV');
    else
      delete from trusted_devices where id = p_action_id;
      return '❌ Đã TỪ CHỐI thiết bị của ' || coalesce(r.staff_name, 'NV');
    end if;
  end if;
  return '❓ Loại yêu cầu không hợp lệ.';
end $$;
