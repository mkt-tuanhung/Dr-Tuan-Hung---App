-- ============================================================
-- Cộng đồng (Group nội bộ) — cột reaction + RLS đầy đủ
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================

-- Mỗi "like" mang 1 loại cảm xúc: like/love/haha/wow/sad/angry
alter table community_likes add column if not exists reaction text default 'like';

alter table community_posts enable row level security;
alter table community_comments enable row level security;
alter table community_likes enable row level security;

-- ---------- POSTS ----------
drop policy if exists "all_authenticated" on community_posts;
drop policy if exists "posts_read" on community_posts;
drop policy if exists "posts_insert" on community_posts;
drop policy if exists "posts_modify" on community_posts;
drop policy if exists "posts_delete" on community_posts;
create policy "posts_read" on community_posts for select using (auth.uid() is not null);
create policy "posts_insert" on community_posts for insert with check (author_id = auth.uid());
create policy "posts_modify" on community_posts for update using (
  author_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "posts_delete" on community_posts for delete using (
  author_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- COMMENTS ----------
drop policy if exists "all_authenticated" on community_comments;
drop policy if exists "comments_read" on community_comments;
drop policy if exists "comments_insert" on community_comments;
drop policy if exists "comments_modify" on community_comments;
drop policy if exists "comments_delete" on community_comments;
create policy "comments_read" on community_comments for select using (auth.uid() is not null);
create policy "comments_insert" on community_comments for insert with check (author_id = auth.uid());
create policy "comments_delete" on community_comments for delete using (
  author_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- LIKES / REACTIONS ----------
drop policy if exists "all_authenticated" on community_likes;
drop policy if exists "likes_read" on community_likes;
drop policy if exists "likes_insert" on community_likes;
drop policy if exists "likes_update" on community_likes;
drop policy if exists "likes_delete" on community_likes;
create policy "likes_read" on community_likes for select using (auth.uid() is not null);
create policy "likes_insert" on community_likes for insert with check (user_id = auth.uid());
create policy "likes_update" on community_likes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "likes_delete" on community_likes for delete using (user_id = auth.uid());
