-- ============================================================
-- FIX RLS — Bảng Community (groups / posts / comments / likes)
-- Vấn đề cũ: policy "all_authenticated" FOR ALL cho phép BẤT KỲ nhân viên
-- đã đăng nhập SỬA/XOÁ bài & bình luận của người khác.
--
-- Sau khi sửa:
--   - Đọc: mọi nhân viên đã đăng nhập
--   - Tạo: phải đúng là tác giả của mình (author_id / user_id = auth.uid())
--   - Sửa/Xoá: chỉ tác giả hoặc admin
--
-- Chạy file này trong Supabase SQL Editor.
-- (Hiện chưa có UI nào dùng các bảng này, nên đây là vá phòng ngừa.)
-- ============================================================

-- Dọn policy cũ
DROP POLICY IF EXISTS "all_authenticated" ON community_posts;
DROP POLICY IF EXISTS "all_authenticated" ON community_comments;
DROP POLICY IF EXISTS "all_authenticated" ON community_likes;

DROP POLICY IF EXISTS "posts_read"      ON community_posts;
DROP POLICY IF EXISTS "posts_insert"    ON community_posts;
DROP POLICY IF EXISTS "posts_modify"    ON community_posts;
DROP POLICY IF EXISTS "comments_read"   ON community_comments;
DROP POLICY IF EXISTS "comments_insert" ON community_comments;
DROP POLICY IF EXISTS "comments_modify" ON community_comments;
DROP POLICY IF EXISTS "likes_read"      ON community_likes;
DROP POLICY IF EXISTS "likes_write_own" ON community_likes;

-- Helper: kiểm tra admin (không gây đệ quy vì query bảng profiles từ bảng khác)
-- (Dùng inline subquery cho gọn.)

-- ---------- POSTS ----------
CREATE POLICY "posts_read" ON community_posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "posts_insert" ON community_posts
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "posts_modify" ON community_posts
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "posts_delete" ON community_posts
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------- COMMENTS ----------
CREATE POLICY "comments_read" ON community_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "comments_insert" ON community_comments
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "comments_modify" ON community_comments
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "comments_delete" ON community_comments
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------- LIKES ----------
CREATE POLICY "likes_read" ON community_likes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "likes_insert" ON community_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete" ON community_likes
  FOR DELETE USING (user_id = auth.uid());
