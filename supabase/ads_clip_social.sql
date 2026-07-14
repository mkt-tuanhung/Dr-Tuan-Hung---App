-- ============================================================
-- SẢN XUẤT ADS: Tính năng xã hội cho clip (giao diện TikTok)
--   - Thả tim (like) + đếm
--   - Bình luận (comment)
-- Chạy 1 lần trên Supabase (SQL editor) để tạo bảng + RLS + realtime.
-- ============================================================

-- 1) Thả tim: mỗi nhân viên thả tối đa 1 tim / clip
create table if not exists media_clip_likes (
  id uuid default uuid_generate_v4() primary key,
  clip_id uuid references media_clips(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(clip_id, user_id)
);
create index if not exists idx_clip_likes_clip on media_clip_likes(clip_id);

-- 2) Bình luận
create table if not exists media_clip_comments (
  id uuid default uuid_generate_v4() primary key,
  clip_id uuid references media_clips(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  content text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_clip_comments_clip on media_clip_comments(clip_id);

-- 3) RLS: mọi người đã đăng nhập đều xem/tương tác được (giống community_*)
alter table media_clip_likes enable row level security;
alter table media_clip_comments enable row level security;

drop policy if exists "clip_likes_all" on media_clip_likes;
create policy "clip_likes_all" on media_clip_likes for all using (auth.uid() is not null);

drop policy if exists "clip_comments_all" on media_clip_comments;
create policy "clip_comments_all" on media_clip_comments for all using (auth.uid() is not null);

-- 4) Realtime
do $$ begin alter publication supabase_realtime add table media_clip_likes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table media_clip_comments; exception when duplicate_object then null; end $$;
