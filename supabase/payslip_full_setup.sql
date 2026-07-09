-- ============================================================
-- CÀI ĐẶT TRỌN GÓI: DUYỆT XEM LƯƠNG (Telegram + trong app)
-- ------------------------------------------------------------
-- Chạy DUY NHẤT file này là đủ toàn bộ chuỗi duyệt xem lương:
--   • cột notifications.action_type / action_id
--   • bảng payslip_view_requests + payslips (+ profiles.payslip_code)
--   • RPC: request_payslip_view (GỬI THÔNG BÁO TELEGRAM), payslip_view_status,
--          save_payslip, get_payslip, payslip_pending_requests, resolve_payslip_view
--   • tg_resolve BẢN ĐẦY ĐỦ (đủ 5 nhánh) — để nút Duyệt trên Telegram chạy đúng
-- Idempotent. Chạy trong Supabase SQL Editor. KHÔNG cần deploy lại Edge Function.
-- ============================================================

-- 0) Cột phục vụ nút Duyệt/Từ chối trên Telegram
alter table notifications add column if not exists action_type text;
alter table notifications add column if not exists action_id uuid;

-- 1) Mã bảo mật riêng từng nhân sự
alter table profiles add column if not exists payslip_code text;

-- 2) Lưu phiếu lương đã mã hoá (QR chỉ chứa id ngắn)
create table if not exists payslips (
  id uuid default gen_random_uuid() primary key,
  slip_key text unique,
  staff_name text,
  period text,
  token text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table payslips enable row level security;

create or replace function save_payslip(p_key text, p_staff text, p_period text, p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into payslips(slip_key, staff_name, period, token)
  values (p_key, p_staff, p_period, p_token)
  on conflict (slip_key) do update
    set token = excluded.token, staff_name = excluded.staff_name,
        period = excluded.period, updated_at = now()
  returning id into new_id;
  return new_id;
end $$;
grant execute on function save_payslip(text, text, text, text) to authenticated;

create or replace function get_payslip(p_id uuid)
returns text language sql security definer set search_path = public as $$
  select token from payslips where id = p_id;
$$;
grant execute on function get_payslip(uuid) to anon, authenticated;

-- 3) Yêu cầu xem lương + theo dõi thiết bị
create table if not exists payslip_view_requests (
  id uuid default gen_random_uuid() primary key,
  staff_name text,
  period text,
  slip_key text not null,
  device_id text,
  device_label text,
  status text not null default 'pending',
  is_duplicate boolean not null default false,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);
alter table payslip_view_requests enable row level security;

-- Trang xem (anon) gọi -> chèn thông báo Telegram cho Admin/Kế toán
create or replace function request_payslip_view(
  p_staff text, p_period text, p_key text, p_device text, p_label text
) returns table(req_id uuid, is_duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare dup boolean; known boolean; other boolean; new_id uuid; staff_key text;
begin
  staff_key := split_part(p_key, ':', 1);
  known := exists(select 1 from payslip_view_requests r
    where split_part(r.slip_key, ':', 1) = staff_key and r.device_id = p_device and r.status = 'approved');
  other := exists(select 1 from payslip_view_requests r
    where r.slip_key = p_key and r.device_id is distinct from p_device and r.status in ('approved', 'pending'));
  dup := (not known) and other;   -- chỉ cảnh báo thiết bị LẠ

  insert into payslip_view_requests(staff_name, period, slip_key, device_id, device_label, is_duplicate)
  values (p_staff, p_period, p_key, p_device, p_label, dup)
  returning id into new_id;

  -- >>> ĐÂY LÀ THÔNG BÁO GỬI VỀ TELEGRAM (kèm nút Duyệt/Từ chối) <<<
  insert into notifications(user_id, type, title, body, link, action_type, action_id)
  select p.id, 'payslip_view_request',
    (case when dup then '⚠️ CẢNH BÁO — ' else '' end) || 'Yêu cầu xem lương: ' || coalesce(p_staff, '?') || ' (' || coalesce(p_period, '') || ')',
    'Thiết bị: ' || coalesce(p_label, '?')
      || (case when dup then E'\n⚠️ Thiết bị LẠ (chưa từng được duyệt) đang mở phiếu này — nếu không đúng, hãy TỪ CHỐI để chặn.'
               when known then E'\n✅ Thiết bị quen thuộc (đã từng được duyệt).' else '' end),
    'payroll', 'payslip_view', new_id
  from profiles p where p.role::text in ('admin', 'accountant');

  return query select new_id, dup;
end $$;
grant execute on function request_payslip_view(text, text, text, text, text) to anon, authenticated;

create or replace function payslip_view_status(p_id uuid)
returns text language sql security definer set search_path = public as $$
  select status from payslip_view_requests where id = p_id;
$$;
grant execute on function payslip_view_status(uuid) to anon, authenticated;

-- 4) Duyệt ngay trong app (không cần Telegram)
create or replace function payslip_pending_requests()
returns setof payslip_view_requests
language sql security definer set search_path = public as $$
  select * from payslip_view_requests
  where status = 'pending'
    and exists (select 1 from profiles where id = auth.uid() and role::text in ('admin', 'accountant'))
  order by created_at desc;
$$;
grant execute on function payslip_pending_requests() to authenticated;

create or replace function resolve_payslip_view(p_id uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare arole text;
begin
  select role::text into arole from profiles where id = auth.uid();
  if arole not in ('admin', 'accountant') then return '⛔ Không có quyền'; end if;
  update payslip_view_requests
     set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now()
   where id = p_id and status = 'pending';
  if not found then return 'ℹ️ Đã xử lý trước đó'; end if;
  return case when p_approve then 'approved' else 'rejected' end;
end $$;
grant execute on function resolve_payslip_view(uuid, boolean) to authenticated;

-- 5) tg_resolve BẢN ĐẦY ĐỦ (đủ 5 nhánh) — nút Duyệt trên Telegram chạy đúng
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

  elsif p_action_type = 'payslip_view' then
    select * into r from payslip_view_requests where id = p_action_id;
    if not found then return '❓ Không tìm thấy yêu cầu xem lương.'; end if;
    if r.status <> 'pending' then return 'ℹ️ Đã xử lý trước đó (' || r.status || ').'; end if;
    if p_approve then
      update payslip_view_requests set status = 'approved', reviewed_at = now() where id = p_action_id;
      return '✅ Đã DUYỆT xem lương: ' || coalesce(r.staff_name, '') || ' (' || coalesce(r.period, '') || ') · ' || coalesce(r.device_label, '');
    else
      update payslip_view_requests set status = 'rejected', reviewed_at = now() where id = p_action_id;
      return '❌ Đã TỪ CHỐI/CHẶN xem lương: ' || coalesce(r.staff_name, '') || ' · ' || coalesce(r.device_label, '');
    end if;
  end if;
  return '❓ Loại yêu cầu không hợp lệ.';
end $$;
