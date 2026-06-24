-- ============================================================
-- Cộng đồng: thành viên group (group riêng tư — chỉ thành viên thấy/đăng)
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================

-- Bảng thành viên group (tạo TRƯỚC để hàm helper tham chiếu được)
create table if not exists community_group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references community_groups(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  added_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(group_id, user_id)
);
alter table community_group_members enable row level security;

-- Hàm helper (SECURITY DEFINER → tránh đệ quy RLS)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_group_members where group_id = gid and user_id = auth.uid());
$$;
create or replace function public.is_group_owner(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_groups where id = gid and created_by = auth.uid());
$$;

drop policy if exists "gm_read" on community_group_members;
drop policy if exists "gm_write" on community_group_members;
create policy "gm_read" on community_group_members for select using (
  public.is_group_member(group_id) or public.is_admin());
create policy "gm_write" on community_group_members for all using (
  public.is_admin() or public.is_group_owner(group_id))
  with check (public.is_admin() or public.is_group_owner(group_id));

-- Groups: chỉ thành viên (hoặc admin) thấy group
drop policy if exists "all_read" on community_groups;
drop policy if exists "groups_read" on community_groups;
create policy "groups_read" on community_groups for select using (
  public.is_group_member(id) or public.is_admin());

-- Posts: chỉ thành viên group (hoặc admin) đọc/đăng
drop policy if exists "posts_read" on community_posts;
drop policy if exists "posts_insert" on community_posts;
create policy "posts_read" on community_posts for select using (
  public.is_group_member(group_id) or public.is_admin());
create policy "posts_insert" on community_posts for insert with check (
  author_id = auth.uid() and (public.is_group_member(group_id) or public.is_admin()));
