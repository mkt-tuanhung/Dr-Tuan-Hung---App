-- ============================================================
-- (4) KẾ HOẠCH HẬU PHẪU THEO MỐC (mẫu do bác sĩ duyệt)  (5) BÀN GIAO ĐIỀU DƯỠNG -> CSKH   — 12/11/2026
-- Idempotent.
-- ============================================================
create table if not exists public.care_templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  service_group text,                       -- null = mẫu chung; có giá trị = riêng nhóm dịch vụ (Hàm mặt, Body…)
  milestones jsonb not null default '[]'::jsonb,   -- [{key:'d7', off:7, label:'Ngày 7', desc:'Cắt chỉ…'}]
  version int not null default 1,
  status text not null default 'draft',     -- draft | approved
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.care_templates enable row level security;
drop policy if exists "ct_select" on public.care_templates;
drop policy if exists "ct_write" on public.care_templates;
create policy "ct_select" on public.care_templates for select using (auth.uid() is not null);
create policy "ct_write" on public.care_templates for all using (
  public.current_user_role()::text in ('admin','bac_si','dieu_duong')
) with check (public.current_user_role()::text in ('admin','bac_si','dieu_duong'));
-- Chỉ admin / bác sĩ được DUYỆT (đổi status sang approved)
create or replace function public.ct_guard_approve() returns trigger
language plpgsql security definer set search_path = public as $q$
declare approver boolean;
begin
  approver := exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text in ('admin','bac_si') or coalesce(p.role_2::text,'') in ('admin','bac_si')));
  if tg_op = 'UPDATE' and old.milestones is distinct from new.milestones then
    new.version := old.version + 1;
    if not approver then new.status := 'draft'; new.approved_by := null; new.approved_at := null; end if;   -- sửa mốc -> chờ bác sĩ duyệt lại
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved' or old.milestones is distinct from new.milestones) then
    if not approver then raise exception 'Chỉ bác sĩ / admin được duyệt mẫu mốc chăm sóc'; end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $q$;
drop trigger if exists trg_ct_guard on public.care_templates;
create trigger trg_ct_guard before insert or update on public.care_templates for each row execute function public.ct_guard_approve();

-- Mẫu chung khởi tạo (theo các mốc đang dùng) — chờ bác sĩ duyệt
insert into public.care_templates (name, service_group, milestones, status)
select 'Mẫu chung', null, '[
  {"key":"d0","off":0,"label":"Ngày phẫu thuật","desc":"Phẫu thuật, theo dõi sinh hiệu"},
  {"key":"d1","off":1,"label":"Ngày 1","desc":"Theo dõi đau, chảy máu"},
  {"key":"d2","off":2,"label":"Ngày 2","desc":"Thay băng, vệ sinh vết mổ"},
  {"key":"d7","off":7,"label":"Ngày 7","desc":"Cắt chỉ, đánh giá tổng quan"},
  {"key":"d14","off":14,"label":"Ngày 14","desc":"Tái khám, đánh giá hồi phục"},
  {"key":"d30","off":30,"label":"Ngày 30","desc":"Đánh giá kết quả, chuẩn bị bàn giao CSKH"}]'::jsonb, 'draft'
where not exists (select 1 from public.care_templates);

-- Bản kế hoạch CHỐT cho từng ca (không đổi khi mẫu sửa sau) + bàn giao
alter table public.customer_appointments
  add column if not exists care_plan           jsonb,          -- snapshot các mốc khi bắt đầu chăm sóc
  add column if not exists care_plan_version   text,           -- "Mẫu chung v2"
  add column if not exists handover_status     text,           -- null | cho_nhan | da_nhan
  add column if not exists handover_summary    text,           -- tóm tắt cho CSKH (không phải hồ sơ y khoa)
  add column if not exists handover_checklist  jsonb,
  add column if not exists handover_override   text,           -- lý do bàn giao ngoại lệ (còn nguy cơ)
  add column if not exists handover_nurse_by   uuid references public.profiles(id) on delete set null,
  add column if not exists handover_nurse_at   timestamptz,
  add column if not exists handover_cskh_by    uuid references public.profiles(id) on delete set null,
  add column if not exists handover_cskh_at    timestamptz;

notify pgrst, 'reload schema';
