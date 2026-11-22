-- ============================================================
-- EVENT: THI VĂN NGHỆ MỪNG SINH NHẬT DR TUẤN HÙNG — CHẤM ĐIỂM GALA (v2)
-- Chạy 1 lần trong Supabase → SQL Editor. Chạy lại được (idempotent).
-- Chỉ TẠO MỚI các bảng/hàm tiền tố gala_*; không sửa bảng cũ của app.
--
-- Quyền:
--   • Ban tổ chức = nhân sự có profiles.role = 'admin' và đang hoạt động
--     (cùng quy tắc với trang Admin của app) — kiểm tra ở DB, không tin cờ từ trình duyệt.
--   • Giám khảo = tài khoản app được Admin chỉ định theo TỪNG chương trình (bảng gala_judges).
--   • Nhân sự khác: không đọc/ghi được dữ liệu gala.
-- Điểm chỉ ghi qua RPC gala_submit_score; xếp hạng chỉ lấy qua RPC gala_rankings.
-- ============================================================
begin;

create extension if not exists pgcrypto;

-- Ban tổ chức = Admin của app (profiles.role = 'admin', đang hoạt động). Kiểm tra phía server.
create or replace function public.gala_is_app_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'admin' and coalesce(p.is_active, true)
  );
$$;
comment on function public.gala_is_app_admin() is
  'Gala: quyền Ban tổ chức = profiles.role admin đang hoạt động. Không nhận cờ isAdmin từ trình duyệt.';

create table if not exists public.gala_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 120),
  subtitle text not null default 'DR TUẤN HÙNG · TOGETHER WE SHINE',
  phase text not null default 'draft' check (phase in ('draft','scoring','paused','closed')),
  published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.gala_performances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gala_events(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  team_name text not null check (length(trim(team_name)) between 1 and 120),
  description text not null default '',
  order_no integer not null default 1 check (order_no between 1 and 999),
  duration_minutes integer check (duration_minutes between 1 and 180),
  created_at timestamptz not null default now()
);
create index if not exists gala_performances_event_order on public.gala_performances(event_id, order_no, created_at);

create table if not exists public.gala_criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gala_events(id) on delete cascade,
  label text not null check(length(trim(label)) between 1 and 80),
  max_points numeric(6,2) not null check (max_points > 0 and max_points <= 100),
  sort_order integer not null default 1,
  unique(event_id, label)
);
create index if not exists gala_criteria_event_order on public.gala_criteria(event_id,sort_order);

create table if not exists public.gala_judges (
  event_id uuid not null references public.gala_events(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  active boolean not null default true,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (event_id,user_id)
);
create index if not exists gala_judges_user on public.gala_judges(user_id,event_id);

create table if not exists public.gala_scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gala_events(id) on delete cascade,
  performance_id uuid not null references public.gala_performances(id),
  judge_id uuid not null references auth.users(id),
  values_by_criterion jsonb not null check (jsonb_typeof(values_by_criterion) = 'object'),
  total numeric(6,2) not null check (total between 0 and 100),
  note text not null default '',
  submitted_at timestamptz not null default now(),
  revised_at timestamptz not null default now(),
  unique(event_id,performance_id,judge_id)
);
create index if not exists gala_scores_event_performance on public.gala_scores(event_id,performance_id);

create table if not exists public.gala_score_audit (
  id bigserial primary key,
  event_id uuid not null references public.gala_events(id) on delete cascade,
  performance_id uuid not null,
  judge_id uuid not null,
  old_values jsonb,
  new_values jsonb not null,
  action text not null check (action in ('submitted','revised')),
  happened_at timestamptz not null default now()
);

create or replace function public.gala_is_judge(p_event uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.gala_judges j
    where j.event_id = p_event and j.user_id = auth.uid() and j.active
  );
$$;

create or replace function public.gala_seed_criteria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gala_criteria(event_id, label, max_points, sort_order) values
    (new.id,'Chất lượng tiết mục',40,1),
    (new.id,'Sáng tạo & ý tưởng',25,2),
    (new.id,'Phong cách biểu diễn',20,3),
    (new.id,'Tinh thần tập thể',15,4);
  return new;
end $$;
drop trigger if exists gala_seed_criteria_insert on public.gala_events;
create trigger gala_seed_criteria_insert after insert on public.gala_events
for each row execute function public.gala_seed_criteria();

create or replace function public.gala_config_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event uuid;
begin
  v_event := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  if exists (select 1 from public.gala_scores where event_id=v_event) then
    raise exception 'Đã có điểm. Không thể thay cấu trúc tiết mục/tiêu chí.';
  end if;
  if exists (select 1 from public.gala_events where id=v_event and published) then
    raise exception 'Đã công bố. Không thể thay cấu trúc chương trình.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists gala_performance_guard on public.gala_performances;
create trigger gala_performance_guard before insert or update or delete on public.gala_performances
for each row execute function public.gala_config_guard();
drop trigger if exists gala_criterion_guard on public.gala_criteria;
create trigger gala_criterion_guard before update or delete on public.gala_criteria
for each row execute function public.gala_config_guard();

-- Private server-side validation + submission. Client NEVER chooses judge identity.
create or replace function public.gala_submit_score(
  p_event_id uuid, p_performance_id uuid, p_values jsonb, p_note text default ''
) returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_phase text;
  v_published boolean;
  v_criterion record;
  v_value numeric;
  v_total numeric := 0;
  v_count int := 0;
  v_old jsonb;
begin
  if auth.uid() is null then raise exception 'Cần đăng nhập.'; end if;
  select phase,published into v_phase,v_published
  from public.gala_events where id=p_event_id for update;
  if not found then raise exception 'Sự kiện không tồn tại.'; end if;
  if v_phase <> 'scoring' or v_published then raise exception 'Chưa mở chấm hoặc đã khóa điểm.'; end if;
  if not public.gala_is_judge(p_event_id) then raise exception 'Tài khoản chưa được chỉ định làm giám khảo.'; end if;
  if not exists(select 1 from public.gala_performances where id=p_performance_id and event_id=p_event_id)
    then raise exception 'Tiết mục không thuộc chương trình.'; end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Bảng điểm không hợp lệ.'; end if;
  for v_criterion in select id,max_points from public.gala_criteria where event_id=p_event_id loop
    if jsonb_typeof(p_values -> (v_criterion.id::text)) is distinct from 'number'
      then raise exception 'Thiếu điểm hoặc sai kiểu dữ liệu cho tiêu chí %',v_criterion.id; end if;
    v_value := (p_values ->> (v_criterion.id::text))::numeric;
    if v_value < 0 or v_value > v_criterion.max_points or mod(v_value*2,1) <> 0
      then raise exception 'Điểm phải trong khoảng cho phép và theo bước 0,5.'; end if;
    v_total := v_total + v_value;
    v_count := v_count+1;
  end loop;
  if v_count=0 or (select count(*) from jsonb_object_keys(p_values))<>v_count
    then raise exception 'Bảng điểm thừa hoặc thiếu tiêu chí.'; end if;
  if (select coalesce(sum(max_points),0) from public.gala_criteria where event_id=p_event_id) <> 100
    then raise exception 'Tổng thang điểm phải là 100.'; end if;
  select values_by_criterion into v_old from public.gala_scores
  where event_id=p_event_id and performance_id=p_performance_id and judge_id=auth.uid();
  insert into public.gala_scores(event_id,performance_id,judge_id,values_by_criterion,total,note)
  values(p_event_id,p_performance_id,auth.uid(),p_values,v_total,left(coalesce(p_note,''),500))
  on conflict(event_id,performance_id,judge_id) do update
    set values_by_criterion=excluded.values_by_criterion,total=excluded.total,
      note=excluded.note,revised_at=now();
  insert into public.gala_score_audit(event_id,performance_id,judge_id,old_values,new_values,action)
  values(p_event_id,p_performance_id,auth.uid(),v_old,p_values,
    case when v_old is null then 'submitted' else 'revised' end);
  return v_total;
end $$;

-- Centralized, auditable judge authorization: uses existing authenticated user ID.
create or replace function public.gala_set_judge(
  p_event_id uuid, p_user_id uuid, p_active boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.gala_is_app_admin() then raise exception 'Không có quyền cấp giám khảo.'; end if;
  if auth.uid() is null then raise exception 'Cần đăng nhập.'; end if;
  if not exists (select 1 from public.gala_events where id=p_event_id)
    then raise exception 'Chương trình không tồn tại.'; end if;
  insert into public.gala_judges(event_id,user_id,active,assigned_by)
  values(p_event_id,p_user_id,p_active,auth.uid())
  on conflict(event_id,user_id) do update
    set active=excluded.active,assigned_by=auth.uid(),assigned_at=now();
end $$;

create or replace function public.gala_event_action(
  p_event_id uuid,p_action text,p_force boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.gala_events%rowtype; v_expected integer; v_received integer;
begin
  if not public.gala_is_app_admin() then raise exception 'Không có quyền quản trị.'; end if;
  select * into v_event from public.gala_events where id=p_event_id for update;
  if not found then raise exception 'Không tìm thấy sự kiện.'; end if;
  if p_action='open' then
    if v_event.published then raise exception 'Cần ẩn kết quả trước khi mở chấm.'; end if;
    if not exists (select 1 from public.gala_performances where event_id=p_event_id)
      then raise exception 'Cần thêm ít nhất một tiết mục.'; end if;
    if not exists (select 1 from public.gala_judges where event_id=p_event_id and active)
      then raise exception 'Cần chỉ định giám khảo.'; end if;
    update public.gala_events set phase='scoring',updated_at=now() where id=p_event_id;
  elsif p_action='pause' then
    update public.gala_events set phase='paused',updated_at=now() where id=p_event_id;
  elsif p_action='close' then
    update public.gala_events set phase='closed',updated_at=now() where id=p_event_id;
  elsif p_action='publish' then
    select (select count(*) from public.gala_performances where event_id=p_event_id)
           *(select count(*) from public.gala_judges where event_id=p_event_id and active)
      into v_expected;
    select count(*) into v_received from public.gala_scores s
      join public.gala_judges j on j.event_id=s.event_id and j.user_id=s.judge_id and j.active
      where s.event_id=p_event_id;
    if v_expected=0 or v_received=0 then raise exception 'Chưa có đủ dữ liệu để công bố.'; end if;
    if v_received<v_expected and not p_force then
      raise exception 'Còn % phiếu chưa chấm. Cần đủ phiếu hoặc xác nhận công bố tạm.',v_expected-v_received;
    end if;
    update public.gala_events set published=true,phase='closed',updated_at=now() where id=p_event_id;
  elsif p_action='unpublish' then
    update public.gala_events set published=false,phase='paused',updated_at=now() where id=p_event_id;
  else raise exception 'Thao tác không hợp lệ.';
  end if;
end $$;

create or replace function public.gala_rankings(p_event_id uuid)
returns table (
  performance_id uuid, performance_title text, team_name text,
  mean_total numeric, received bigint, expected bigint, placement bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.gala_events where id=p_event_id and
    (public.gala_is_app_admin() or (published and public.gala_is_judge(p_event_id)))) then
    raise exception 'Kết quả chưa được công bố hoặc không có quyền.';
  end if;
  return query
    with expectations as (
      select count(*)::bigint cnt from public.gala_judges where event_id=p_event_id and active
    ), aggregates as (
      select p.id id, p.title title, p.team_name team,
             round(avg(s.total),2) avg_score, count(s.id)::bigint votes, e.cnt expected_votes
      from public.gala_performances p
      cross join expectations e
      left join public.gala_scores s on s.performance_id=p.id and s.event_id=p_event_id
        and exists(select 1 from public.gala_judges j where j.event_id=p_event_id and j.user_id=s.judge_id and j.active)
      where p.event_id=p_event_id
      group by p.id,p.title,p.team_name,p.order_no,e.cnt
    )
    select a.id,a.title,a.team,a.avg_score,a.votes,a.expected_votes,
      dense_rank() over(order by a.avg_score desc nulls last)::bigint
    from aggregates a order by a.avg_score desc nulls last,a.title;
end $$;

alter table public.gala_events enable row level security;
alter table public.gala_performances enable row level security;
alter table public.gala_criteria enable row level security;
alter table public.gala_judges enable row level security;
alter table public.gala_scores enable row level security;
alter table public.gala_score_audit enable row level security;

drop policy if exists gala_events_read on public.gala_events;
create policy gala_events_read on public.gala_events for select to authenticated
using (public.gala_is_app_admin() or public.gala_is_judge(id));
drop policy if exists gala_events_insert on public.gala_events;
create policy gala_events_insert on public.gala_events for insert to authenticated
with check (public.gala_is_app_admin() and created_by=auth.uid());
drop policy if exists gala_events_update on public.gala_events;
create policy gala_events_update on public.gala_events for update to authenticated
using (public.gala_is_app_admin()) with check (public.gala_is_app_admin());

drop policy if exists gala_performances_read on public.gala_performances;
create policy gala_performances_read on public.gala_performances for select to authenticated
using (public.gala_is_app_admin() or public.gala_is_judge(event_id));
drop policy if exists gala_performances_write on public.gala_performances;
create policy gala_performances_write on public.gala_performances for all to authenticated
using (public.gala_is_app_admin()) with check (public.gala_is_app_admin());

drop policy if exists gala_criteria_read on public.gala_criteria;
create policy gala_criteria_read on public.gala_criteria for select to authenticated
using (public.gala_is_app_admin() or public.gala_is_judge(event_id));
drop policy if exists gala_criteria_write on public.gala_criteria;
create policy gala_criteria_write on public.gala_criteria for all to authenticated
using (public.gala_is_app_admin()) with check (public.gala_is_app_admin());

drop policy if exists gala_judges_read on public.gala_judges;
create policy gala_judges_read on public.gala_judges for select to authenticated
using (public.gala_is_app_admin() or user_id=auth.uid());
drop policy if exists gala_judges_write on public.gala_judges;
-- Judge assignment is written exclusively through gala_set_judge(), never through client table writes.

drop policy if exists gala_scores_read on public.gala_scores;
create policy gala_scores_read on public.gala_scores for select to authenticated
using (public.gala_is_app_admin() or (judge_id=auth.uid() and public.gala_is_judge(event_id)));
-- Never grant client direct INSERT / UPDATE / DELETE on scores. RPC above is the sole write path.

drop policy if exists gala_audit_read on public.gala_score_audit;
create policy gala_audit_read on public.gala_score_audit for select to authenticated
using (public.gala_is_app_admin());

revoke all on public.gala_events,public.gala_performances,public.gala_criteria,
  public.gala_judges,public.gala_scores,public.gala_score_audit from anon;
revoke all on public.gala_events,public.gala_performances,public.gala_criteria,
  public.gala_judges,public.gala_scores,public.gala_score_audit from authenticated;
grant select,insert on public.gala_events to authenticated;
grant update (title,subtitle) on public.gala_events to authenticated;
grant select,insert,update,delete on public.gala_performances to authenticated;
grant select,insert,update,delete on public.gala_criteria to authenticated;
grant select on public.gala_judges to authenticated;
grant select on public.gala_scores to authenticated;
grant select on public.gala_score_audit to authenticated;
revoke all on function public.gala_is_app_admin(), public.gala_is_judge(uuid) from public,anon;
grant execute on function public.gala_is_app_admin(), public.gala_is_judge(uuid) to authenticated;
revoke all on function public.gala_submit_score(uuid,uuid,jsonb,text),
  public.gala_set_judge(uuid,uuid,boolean),
  public.gala_event_action(uuid,text,boolean),public.gala_rankings(uuid) from public,anon;
grant execute on function public.gala_submit_score(uuid,uuid,jsonb,text),
  public.gala_set_judge(uuid,uuid,boolean),
  public.gala_event_action(uuid,text,boolean),public.gala_rankings(uuid) to authenticated;

-- Supabase Realtime needs tables added to publication; run only if supported in target project.
-- alter publication supabase_realtime add table public.gala_scores;
-- alter publication supabase_realtime add table public.gala_events;
commit;
