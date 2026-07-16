-- ============================================================
-- SIẾT RLS: media_clip_likes / media_clip_comments
-- Trước đây: for all using (auth.uid() is not null) → ai cũng có thể chèn với
-- user_id giả (mạo danh) hoặc sửa/xoá của người khác.
-- Nay: chỉ thao tác trên bản ghi của CHÍNH MÌNH (admin được xoá/sửa comment).
-- profiles.id === auth.uid() nên không phá app (app luôn dùng user_id = me.id).
-- Chạy 1 lần trên Supabase SQL Editor. An toàn cho prod.
-- ============================================================

-- media_clip_likes
drop policy if exists "clip_likes_all"    on media_clip_likes;
drop policy if exists "clip_likes_read"   on media_clip_likes;
drop policy if exists "clip_likes_insert" on media_clip_likes;
drop policy if exists "clip_likes_delete" on media_clip_likes;
create policy "clip_likes_read"   on media_clip_likes for select using (auth.uid() is not null);
create policy "clip_likes_insert" on media_clip_likes for insert with check (user_id = auth.uid());
create policy "clip_likes_delete" on media_clip_likes for delete using (user_id = auth.uid());

-- media_clip_comments
drop policy if exists "clip_comments_all"    on media_clip_comments;
drop policy if exists "clip_comments_read"   on media_clip_comments;
drop policy if exists "clip_comments_insert" on media_clip_comments;
drop policy if exists "clip_comments_update" on media_clip_comments;
drop policy if exists "clip_comments_delete" on media_clip_comments;
create policy "clip_comments_read"   on media_clip_comments for select using (auth.uid() is not null);
create policy "clip_comments_insert" on media_clip_comments for insert with check (user_id = auth.uid());
create policy "clip_comments_update" on media_clip_comments for update
  using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "clip_comments_delete" on media_clip_comments for delete
  using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
