-- Môi trường giả lập Supabase TỐI THIỂU để chạy migration + test trên PostgreSQL cục bộ (KHÔNG chạy trên Supabase thật).
-- Tạo: vai trò anon / authenticated / authenticator, schema auth + auth.uid() (đọc JWT như Supabase),
-- publication supabase_realtime, và bản rút gọn các bảng app có sẵn mà module dùng tới.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login password 'authpass' noinherit; end if;
end $$;
grant anon, authenticated to authenticator;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid;
$$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'telesale', 'sale_offline', 'cskh', 'truc_page', 'media', 'marketing', 'editor', 'seeding',
    'dieu_duong', 'accountant', 'shareholder', 'bac_si', 'designer');
exception when duplicate_object then null; end $$;
do $$ begin create type employment_status as enum ('probation', 'official', 'inactive'); exception when duplicate_object then null; end $$;
create table if not exists public.profiles (
  id uuid primary key, full_name text, employee_id text, role user_role not null default 'telesale', role_2 user_role,
  position text, is_active boolean default true, employment_status employment_status default 'official', avatar_url text
);
alter table public.profiles enable row level security;
drop policy if exists p_read on public.profiles;
create policy p_read on public.profiles for select to authenticated using (true);
grant select on public.profiles to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id), type text not null, title text not null, body text, link text,
  is_read boolean default false, created_at timestamptz default now()
);
alter table public.notifications enable row level security;
drop policy if exists n_read on public.notifications;
create policy n_read on public.notifications for select to authenticated using (user_id = auth.uid());
grant select on public.notifications to authenticated;

create table if not exists public.clinic_settings (id boolean primary key default true check (id), clinic_name text not null default 'Phòng khám');
alter table public.clinic_settings enable row level security;
drop policy if exists cs_read on public.clinic_settings;
create policy cs_read on public.clinic_settings for select to authenticated using (true);
grant select on public.clinic_settings to authenticated;
insert into public.clinic_settings (id) values (true) on conflict do nothing;

create table if not exists public.role_permissions (role text, module text, granted boolean, primary key (role, module));
grant select on public.role_permissions to authenticated;

-- ---------- Kho Media (rút gọn từ ads_production.sql / media_assets.sql) ----------
create or replace function public.current_user_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;
grant execute on function public.current_user_role() to authenticated;
create table if not exists public.media_customers (
  id uuid primary key default gen_random_uuid(), customer_name text, customer_phone text, media_id uuid references public.profiles(id),
  source_links jsonb default '[]'::jsonb, note text, source_id text, service text, shoot_date date, source_type text,
  source_status text default 'chua_dung', tags text[] not null default '{}', no_image boolean not null default false,
  hide_face boolean not null default false, source_video_count int default 0, source_image_count int default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.media_customers enable row level security;
drop policy if exists mc_select on public.media_customers;
create policy mc_select on public.media_customers for select using (
  public.current_user_role()::text in ('media','editor','marketing','admin','accountant','shareholder','dieu_duong','cskh') or media_id = auth.uid());
drop policy if exists mc_write on public.media_customers;
create policy mc_write on public.media_customers for all using (
  media_id = auth.uid() or public.current_user_role()::text in ('media','editor','dieu_duong','cskh','marketing','admin'))
  with check (media_id = auth.uid() or public.current_user_role()::text in ('media','editor','dieu_duong','cskh','marketing','admin'));
grant select, insert, update, delete on public.media_customers to authenticated;
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(), drive_id text not null unique, media_customer_id uuid references public.media_customers(id) on delete cascade,
  name text, kind text, mime text, size_bytes bigint not null default 0, duration_ms int, folder text, web_link text, thumb_link text,
  created_time timestamptz, favorite boolean not null default false
);
alter table public.media_assets enable row level security;
drop policy if exists ma_read on public.media_assets;
create policy ma_read on public.media_assets for select to authenticated using (true);
grant select on public.media_assets to authenticated;
create table if not exists public.media_clips (
  id uuid primary key default gen_random_uuid(), media_customer_id uuid not null references public.media_customers(id) on delete cascade,
  editor_id uuid references public.profiles(id), title text, win boolean, score int default 0, fb_spend numeric not null default 0,
  fb_purchases int not null default 0, ad_status text, clip_links jsonb default '[]'::jsonb, created_at timestamptz default now()
);
alter table public.media_clips enable row level security;
drop policy if exists clip_select on public.media_clips;
create policy clip_select on public.media_clips for select using (
  editor_id = auth.uid() or public.current_user_role()::text in ('media','editor','marketing','admin','accountant','shareholder'));
grant select on public.media_clips to authenticated;
