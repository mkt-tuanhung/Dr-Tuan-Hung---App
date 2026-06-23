-- ============================================================
-- FIX RLS — Chống đệ quy vô hạn trên bảng profiles
--
-- VẤN ĐỀ: Các policy trên chính bảng `profiles` lại chứa subquery
-- "select ... from profiles ..." → Postgres báo lỗi
-- "infinite recursion detected in policy for relation profiles"
-- (làm hỏng mọi truy vấn profiles, gồm cả đăng nhập).
--
-- CÁCH SỬA: đọc role qua hàm SECURITY DEFINER (chạy với quyền owner,
-- BỎ QUA RLS) nên không còn tự tham chiếu.
--
-- ⚠️ QUAN TRỌNG — PHẢI TEST TRÊN MÔI TRƯỜNG STAGING TRƯỚC KHI ÁP PROD:
--   1) Admin vẫn xem/sửa được toàn bộ nhân sự.
--   2) Nhân viên thường vẫn đăng nhập + xem được profile.
--   3) Kế toán/cổ đông vẫn xem được danh sách.
-- Sai policy ở đây có thể KHOÁ đăng nhập của mọi người.
-- ============================================================

-- 1. Hàm đọc role của user hiện tại (bỏ qua RLS → không đệ quy)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 2. Thay thế các policy tự-tham-chiếu trên profiles
DROP POLICY IF EXISTS "admin_all"        ON profiles;
DROP POLICY IF EXISTS "accountant_read"  ON profiles;

-- Admin: toàn quyền
CREATE POLICY "admin_all" ON profiles
  FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Kế toán / Cổ đông: chỉ đọc
CREATE POLICY "accountant_read" ON profiles
  FOR SELECT
  USING (public.current_user_role() IN ('accountant', 'shareholder'));

-- LƯU Ý: các policy sau (nếu đã tạo từ file cũ) KHÔNG cần đổi vì
-- không tự tham chiếu profiles:
--   "everyone_read" : auth.role() = 'authenticated'   (cho mọi NV đã đăng nhập đọc)
--   "self_update"   : id = auth.uid()                  (tự cập nhật hồ sơ)
-- Nếu chưa có "everyone_read", bỏ comment dòng dưới để NV đăng nhập đọc được:
-- CREATE POLICY "everyone_read" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
