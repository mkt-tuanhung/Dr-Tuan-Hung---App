-- ============================================================
-- LỊCH LÀM VIỆC / PHÂN CA (theo Ethics BOS) — chạy 1 lần trong SQL Editor
--   work_shifts      : danh mục ca (Sáng, Chiều, Tối, Trực đêm, Hành chính, Nghỉ)
--   staff_schedules  : ca của từng nhân sự theo ngày — 'draft' (nháp) | 'published' (đã công bố)
--   publish_schedule_week(): Admin công bố lịch 1 tuần + gửi thông báo cho nhân sự
-- Chỉ THÊM bảng/hàm mới, không sửa bảng cũ.
-- ============================================================

create table if not exists public.work_shifts (
  id          text primary key,
  code        text not null,
  name        text not null,
  short       text not null,
  start_time  text not null,          -- 'HH:MM'
  end_time    text not null,          -- 'HH:MM' (nhỏ hơn giờ bắt đầu = qua đêm)
  tone        text not null default 'neutral',  -- peach|success|rose|lavender|sky|neutral
  is_off      boolean not null default false,
  sort        int not null default 0,
  active      boolean not null default true
);

insert into public.work_shifts (id, code, name, short, start_time, end_time, tone, is_off, sort) values
  ('sh-am',  'SANG',  'Ca sáng',    'Sáng',  '08:00', '17:00', 'peach',    false, 1),
  ('sh-pm',  'CHIEU', 'Ca chiều',   'Chiều', '11:00', '20:00', 'success',  false, 2),
  ('sh-ev',  'TOI',   'Ca tối',     'Tối',   '13:00', '22:00', 'rose',     false, 3),
  ('sh-nt',  'TRUC',  'Trực đêm',   'Trực',  '22:00', '08:00', 'lavender', false, 4),
  ('sh-of',  'HC',    'Hành chính', 'HC',    '08:30', '17:30', 'sky',      false, 5),
  ('sh-off', 'NGHI',  'Nghỉ',       'Nghỉ',  '00:00', '00:00', 'neutral',  true,  6)
on conflict (id) do nothing;

create table if not exists public.staff_schedules (
  staff_id    uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  shift_id    text not null references public.work_shifts(id),
  status      text not null default 'draft' check (status in ('draft', 'published')),
  note        text,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (staff_id, date)
);
create index if not exists staff_schedules_date_idx on public.staff_schedules (date);

alter table public.work_shifts enable row level security;
alter table public.staff_schedules enable row level security;

-- Ai đăng nhập cũng xem được danh mục ca
drop policy if exists work_shifts_read on public.work_shifts;
create policy work_shifts_read on public.work_shifts for select to authenticated using (true);
drop policy if exists work_shifts_admin on public.work_shifts;
create policy work_shifts_admin on public.work_shifts for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Nhân sự xem lịch ĐÃ CÔNG BỐ (để biết đồng nghiệp trực ca nào); Admin xem cả nháp
drop policy if exists staff_schedules_read on public.staff_schedules;
create policy staff_schedules_read on public.staff_schedules for select to authenticated
  using (status = 'published' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Chỉ Admin xếp / sửa / xoá ca
drop policy if exists staff_schedules_admin on public.staff_schedules;
create policy staff_schedules_admin on public.staff_schedules for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Công bố lịch 1 tuần: nháp -> đã công bố, gửi thông báo cho từng nhân sự có ca
create or replace function public.publish_schedule_week(week_start date)
returns int language plpgsql security definer set search_path = public as $$
declare n int; r record;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Chỉ Admin được công bố lịch';
  end if;
  update staff_schedules set status = 'published', updated_by = auth.uid(), updated_at = now()
   where date between week_start and week_start + 6 and status = 'draft';
  get diagnostics n = row_count;
  if n = 0 then return 0; end if;
  for r in select distinct staff_id from staff_schedules where date between week_start and week_start + 6 loop
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (r.staff_id, auth.uid(), 'schedule', 'Đã có lịch làm việc mới',
            'Lịch tuần ' || to_char(week_start, 'DD/MM') || ' - ' || to_char(week_start + 6, 'DD/MM/YYYY') || ' đã được công bố.', 'my_schedule');
  end loop;
  return n;
end $$;
grant execute on function public.publish_schedule_week(date) to authenticated;
