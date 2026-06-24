-- ============================================================
-- Cộng đồng nâng cấp: trả lời comment + thả cảm xúc comment
-- An toàn cho prod. Chạy trong Supabase SQL Editor.
-- ============================================================

-- 1. Trả lời bình luận (comment lồng 1 cấp)
alter table community_comments add column if not exists parent_id uuid references community_comments(id) on delete cascade;

-- 2. Thả cảm xúc cho bình luận
create table if not exists community_comment_likes (
  id uuid default uuid_generate_v4() primary key,
  comment_id uuid references community_comments(id) on delete cascade,
  user_id uuid references profiles(id) not null,
  reaction text default 'like',
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);
alter table community_comment_likes enable row level security;

drop policy if exists "ccl_read" on community_comment_likes;
drop policy if exists "ccl_insert" on community_comment_likes;
drop policy if exists "ccl_update" on community_comment_likes;
drop policy if exists "ccl_delete" on community_comment_likes;
create policy "ccl_read" on community_comment_likes for select using (auth.uid() is not null);
create policy "ccl_insert" on community_comment_likes for insert with check (user_id = auth.uid());
create policy "ccl_update" on community_comment_likes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ccl_delete" on community_comment_likes for delete using (user_id = auth.uid());
