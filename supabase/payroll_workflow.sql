-- ============================================================
-- QUY TRÌNH DUYỆT LƯƠNG 7 BƯỚC (theo Ethics BOS D08) — chạy 1 lần trong SQL Editor
-- (chạy lại nhiều lần vẫn an toàn)
--
--   Nháp → HR kiểm tra → Trưởng phòng duyệt → Tài chính kiểm tra → Đã duyệt → Đã khoá → Đã chi trả
--   draft   hr_review     manager_review       finance_review       approved   locked    paid
--
-- Ai được chuyển bước (vai trò chính HOẶC vai trò phụ role_2):
--   draft → hr_review, hr_review → manager_review ........ Kế toán, Admin   (bước HR)
--   manager_review → finance_review ....................... Admin            (Trưởng phòng)
--   finance_review → approved ............................. Kế toán, Admin   (Tài chính)
--   approved → locked ..................................... Cổ đông, Admin   (CEO) — bắt ghi chú
--   locked → paid ......................................... Kế toán, Admin   — bắt ghi chú
--   (mọi bước trừ paid) → draft "Trả về nháp" ............. Admin            — bắt lý do
--
-- Hai người: từ bước Trưởng phòng trở đi, người chuyển bước KHÔNG được là người
-- vừa chuyển bước trước đó (trừ bước "Đã chi trả" và "Trả về nháp").
--
-- Khoá dữ liệu ở database: bảng payroll chỉ sửa được khi kỳ đang ở "Nháp" hoặc
-- "HR kiểm tra". Sau đó mọi thay đổi số liệu bị từ chối, trừ khi đi qua hàm
-- payroll_transition (khoá / trả về nháp).
--
-- payroll_period_history: CHỈ GHI THÊM (không có policy sửa/xoá).
-- ============================================================

create table if not exists public.payroll_periods (
  year        smallint not null,
  month       smallint not null check (month between 1 and 12),
  status      text not null default 'draft' check (status in
                ('draft', 'hr_review', 'manager_review', 'finance_review', 'approved', 'locked', 'paid')),
  locked_at   timestamptz,
  locked_by   uuid references public.profiles(id) on delete set null,
  paid_at     timestamptz,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (year, month)
);

create table if not exists public.payroll_period_history (
  id          bigserial primary key,
  year        smallint not null,
  month       smallint not null,
  from_status text,
  to_status   text not null,
  actor_id    uuid references public.profiles(id) on delete set null,
  note        text,
  total_net   numeric(15,0),
  staff_count integer,
  created_at  timestamptz not null default now(),
  foreign key (year, month) references public.payroll_periods(year, month) on delete cascade
);
create index if not exists payroll_period_history_period_idx
  on public.payroll_period_history (year, month, created_at desc);

-- Các tháng ĐÃ CHỐT theo cách cũ (payroll.status = 'locked') -> kỳ "Đã khoá"
insert into public.payroll_periods (year, month, status, locked_at, locked_by)
select year, month, 'locked', max(locked_at), (array_agg(locked_by) filter (where locked_by is not null))[1]
from public.payroll where status = 'locked'
group by year, month
on conflict (year, month) do nothing;

-- ---------- Quyền đọc ----------
alter table public.payroll_periods enable row level security;
alter table public.payroll_period_history enable row level security;

-- Trạng thái kỳ (không có số tiền): ai đăng nhập cũng đọc được -> nhân sự biết lương tháng đang ở bước nào
drop policy if exists payroll_periods_read on public.payroll_periods;
create policy payroll_periods_read on public.payroll_periods
  for select to authenticated using (true);

-- Lịch sử duyệt (có tổng tiền): Admin, Kế toán, Cổ đông
drop policy if exists payroll_history_read on public.payroll_period_history;
create policy payroll_history_read on public.payroll_period_history
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
            and (p.role::text in ('admin', 'accountant', 'shareholder')
                 or p.role_2::text in ('admin', 'accountant', 'shareholder')))
  );
-- KHÔNG có policy insert/update/delete: mọi thay đổi đi qua hàm payroll_transition bên dưới.
grant select on public.payroll_periods, public.payroll_period_history to authenticated;

-- ---------- Khoá dữ liệu bảng payroll theo trạng thái kỳ ----------
create or replace function public.payroll_guard_period()
returns trigger language plpgsql as $$
declare
  v_year smallint := coalesce(new.year, old.year);
  v_month smallint := coalesce(new.month, old.month);
  v_status text;
begin
  -- Hàm payroll_transition tự ghi khi khoá / trả về nháp
  if coalesce(current_setting('app.payroll_transition', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  select status into v_status from public.payroll_periods where year = v_year and month = v_month;
  if coalesce(v_status, 'draft') not in ('draft', 'hr_review') then
    raise exception 'Bảng lương tháng %/% đang ở bước "%" — không sửa được số liệu. Admin cần "Trả về nháp" trước.',
      v_month, v_year, v_status using errcode = 'P0001';
  end if;
  -- Dòng lẻ không được tự đặt "đã chốt": chốt là thao tác cả tháng qua quy trình
  if tg_op <> 'DELETE' and new.status = 'locked' then
    raise exception 'Chốt lương phải đi qua quy trình duyệt (payroll_transition).' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_payroll_guard_period on public.payroll;
create trigger trg_payroll_guard_period
  before insert or update or delete on public.payroll
  for each row execute function public.payroll_guard_period();

-- ---------- Chuyển bước ----------
create or replace function public.payroll_transition(p_year int, p_month int, p_to text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_roles text[];
  v_from text;
  v_allowed text[];
  v_needs_note boolean := false;
  v_last_actor uuid;
  v_total numeric;
  v_count int;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_order text[] := array['draft', 'hr_review', 'manager_review', 'finance_review', 'approved', 'locked', 'paid'];
begin
  if v_me is null then raise exception 'Chưa đăng nhập'; end if;
  select array_remove(array[role::text, role_2::text], null) into v_roles from profiles where id = v_me and is_active;
  if v_roles is null then raise exception 'Tài khoản không hợp lệ hoặc đã bị khoá'; end if;

  insert into payroll_periods (year, month) values (p_year, p_month) on conflict do nothing;
  select status into v_from from payroll_periods where year = p_year and month = p_month for update;

  if p_to = 'draft' then
    -- Trả về nháp để sửa (Admin, bắt lý do). Kỳ đã chi trả thì không mở lại.
    if v_from = 'paid' then raise exception 'Kỳ lương đã chi trả — không trả về nháp được'; end if;
    if v_from = 'draft' then raise exception 'Kỳ lương đang ở bước Nháp'; end if;
    v_allowed := array['admin'];
    v_needs_note := true;
  elsif array_position(v_order, p_to) is distinct from array_position(v_order, v_from) + 1 then
    raise exception 'Không chuyển được từ "%" sang "%" (phải đi lần lượt từng bước)', v_from, p_to;
  else
    v_allowed := case p_to
      when 'hr_review'      then array['accountant', 'admin']
      when 'manager_review' then array['accountant', 'admin']
      when 'finance_review' then array['admin']
      when 'approved'       then array['accountant', 'admin']
      when 'locked'         then array['shareholder', 'admin']
      when 'paid'           then array['accountant', 'admin']
    end;
    v_needs_note := p_to in ('locked', 'paid');
  end if;

  if not (v_roles && v_allowed) then
    raise exception 'Vai trò của bạn không thực hiện được bước này';
  end if;
  if v_needs_note and length(coalesce(v_note, '')) < 5 then
    raise exception 'Cần ghi chú / lý do ít nhất 5 ký tự';
  end if;

  -- Hai người: từ bước Trưởng phòng duyệt trở đi
  if p_to in ('finance_review', 'approved', 'locked') then
    select actor_id into v_last_actor from payroll_period_history
      where year = p_year and month = p_month order by created_at desc, id desc limit 1;
    if v_last_actor = v_me then
      raise exception 'Bạn vừa thực hiện bước trước — bước này cần một người khác duyệt';
    end if;
  end if;

  select coalesce(sum(net_salary), 0), count(*) into v_total, v_count
    from payroll where year = p_year and month = p_month;
  if p_to = 'hr_review' and v_count = 0 then
    raise exception 'Chưa có bảng lương đã lưu cho tháng này — bấm "Lưu nháp" trước';
  end if;

  perform set_config('app.payroll_transition', 'on', true);
  if p_to = 'locked' then
    update payroll set status = 'locked', locked_at = now(), locked_by = v_me, updated_at = now()
      where year = p_year and month = p_month;
  elsif p_to = 'draft' and v_from in ('locked') then
    update payroll set status = 'draft', locked_at = null, locked_by = null, updated_at = now()
      where year = p_year and month = p_month;
  end if;
  perform set_config('app.payroll_transition', 'off', true);

  update payroll_periods set
    status = p_to,
    locked_at = case when p_to = 'locked' then now() when p_to = 'draft' then null else locked_at end,
    locked_by = case when p_to = 'locked' then v_me when p_to = 'draft' then null else locked_by end,
    paid_at = case when p_to = 'paid' then now() else paid_at end,
    updated_by = v_me, updated_at = now()
  where year = p_year and month = p_month;

  insert into payroll_period_history (year, month, from_status, to_status, actor_id, note, total_net, staff_count)
    values (p_year, p_month, v_from, p_to, v_me, v_note, v_total, v_count);

  return p_to;
end $$;

revoke all on function public.payroll_transition(int, int, text, text) from public;
grant execute on function public.payroll_transition(int, int, text, text) to authenticated;

-- Bật realtime để màn Bảng lương của người khác tự cập nhật bước hiện tại
do $$ begin
  alter publication supabase_realtime add table public.payroll_periods;
exception when duplicate_object then null; when undefined_object then null; end $$;
