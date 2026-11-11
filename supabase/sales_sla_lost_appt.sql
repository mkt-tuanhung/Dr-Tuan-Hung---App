-- ============================================================
-- (1) THỜI HẠN GỌI LEAD MỚI 15 PHÚT  (2) LÝ DO MẤT KHÁCH + LỊCH SỬ GIAI ĐOẠN
-- (3) LỊCH HẸN: XÁC NHẬN / KHÔNG ĐẾN / DỜI LỊCH CÓ LÝ DO          — 12/11/2026. Idempotent.
-- ============================================================

-- ---------- (1) SLA ----------
alter table marketing_data
  add column if not exists sla_due_at       timestamptz,   -- hạn gọi lần đầu (15' trong giờ 8:00–21:00, ngoài giờ -> 8:15 sáng)
  add column if not exists first_contact_at timestamptz,   -- lần đầu nhân viên gọi / note
  add column if not exists sla_warned_at    timestamptz,   -- đã nhắc "còn 5 phút"
  add column if not exists sla_breached_at  timestamptz,   -- đã báo quá hạn
  add column if not exists lost_reason      text;          -- (2) lý do Mất / Chốt Fail

create or replace function public.md_set_sla() returns trigger
language plpgsql security definer set search_path = public as $q$
declare loc timestamp; due timestamp;
begin
  if new.getfly_id is not null then return new; end if;            -- dữ liệu chuyển từ GetFly: không tính
  loc := coalesce(new.created_at, now()) at time zone 'Asia/Ho_Chi_Minh';
  if extract(hour from loc) < 8 then due := date_trunc('day', loc) + interval '8 hours 15 minutes';
  elsif extract(hour from loc) >= 21 then due := date_trunc('day', loc) + interval '1 day 8 hours 15 minutes';
  else due := loc + interval '15 minutes'; end if;
  new.sla_due_at := due at time zone 'Asia/Ho_Chi_Minh';
  return new;
end $q$;
drop trigger if exists trg_md_set_sla on public.marketing_data;
create trigger trg_md_set_sla before insert on public.marketing_data for each row execute function public.md_set_sla();

-- Gọi / note của nhân viên: cập nhật liên hệ cuối + LẦN ĐẦU liên hệ
create or replace function public.touch_last_contact() returns trigger
language plpgsql security definer set search_path = public as $q$
begin
  if new.data_id is not null and new.created_by is not null then
    update marketing_data set
      last_contact_at = greatest(coalesce(last_contact_at, new.created_at), new.created_at),
      first_contact_at = coalesce(first_contact_at, new.created_at)
    where id = new.data_id;
  end if;
  return new;
exception when others then return new;
end $q$;

-- ---------- (2) LỊCH SỬ ĐỔI GIAI ĐOẠN (không sửa / xoá) ----------
create table if not exists public.marketing_stage_history (
  id uuid default gen_random_uuid() primary key,
  data_id uuid references public.marketing_data(id) on delete cascade,
  from_status text, to_status text, reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz default now()
);
create index if not exists idx_msh_data on public.marketing_stage_history(data_id, changed_at desc);
create index if not exists idx_msh_time on public.marketing_stage_history(changed_at desc);
alter table public.marketing_stage_history enable row level security;
drop policy if exists "msh_select" on public.marketing_stage_history;
create policy "msh_select" on public.marketing_stage_history for select using (
  public.current_user_role()::text in ('marketing','truc_page','media','telesale','admin','accountant','shareholder','sale_offline','cskh')
);
create or replace function public.md_stage_history() returns trigger
language plpgsql security definer set search_path = public as $q$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into marketing_stage_history (data_id, from_status, to_status, reason, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status,
            case when new.status in ('mat','chot_fail') then new.lost_reason end, auth.uid());
  end if;
  return new;
exception when others then return new;
end $q$;
drop trigger if exists trg_md_stage_history on public.marketing_data;
create trigger trg_md_stage_history after insert or update of status on public.marketing_data
  for each row execute function public.md_stage_history();

-- ---------- (3) LỊCH HẸN ----------
alter table customer_appointments
  add column if not exists confirmed_at      timestamptz,   -- khách đã xác nhận đến
  add column if not exists confirmed_by      uuid references profiles(id) on delete set null,
  add column if not exists no_show_at        timestamptz,   -- đánh dấu KHÔNG ĐẾN
  add column if not exists no_show_reason    text,
  add column if not exists reschedule_reason text,          -- lý do lần dời lịch gần nhất
  add column if not exists bong_reason       text;          -- lý do bong (mã)

create table if not exists public.appointment_reschedules (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references public.customer_appointments(id) on delete cascade,
  old_date date, old_time text, new_date date, new_time text, reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz default now()
);
create index if not exists idx_appt_resched on public.appointment_reschedules(appointment_id, changed_at desc);
alter table public.appointment_reschedules enable row level security;
drop policy if exists "ar_select" on public.appointment_reschedules;
create policy "ar_select" on public.appointment_reschedules for select using (auth.uid() is not null);

-- Dời ngày / giờ hẹn: lưu lịch sử + bỏ xác nhận / không đến cũ (lịch mới cần xác nhận lại)
create or replace function public.appt_on_reschedule() returns trigger
language plpgsql security definer set search_path = public as $q$
begin
  if new.appointment_date is distinct from old.appointment_date
     or coalesce(new.appointment_time::text,'') is distinct from coalesce(old.appointment_time::text,'') then
    insert into appointment_reschedules (appointment_id, old_date, old_time, new_date, new_time, reason, changed_by)
    values (new.id, old.appointment_date, old.appointment_time::text, new.appointment_date, new.appointment_time::text, new.reschedule_reason, auth.uid());
    new.confirmed_at := null; new.confirmed_by := null; new.no_show_at := null; new.no_show_reason := null;
  end if;
  return new;
exception when others then return new;
end $q$;
drop trigger if exists trg_appt_on_reschedule on public.customer_appointments;
create trigger trg_appt_on_reschedule before update of appointment_date, appointment_time on public.customer_appointments
  for each row execute function public.appt_on_reschedule();

notify pgrst, 'reload schema';
