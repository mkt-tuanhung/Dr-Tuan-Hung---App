-- Xoá bỏ policy cũ chỉ cho phép tự xem profile của mình
DROP POLICY IF EXISTS "self_read" ON profiles;

-- Tạo policy mới cho phép tất cả nhân sự (đã đăng nhập) xem được danh sách profile của nhau
-- Việc này giúp Telesale, Điều dưỡng có thể nhìn thấy danh sách đồng nghiệp để chọn phụ trách
CREATE POLICY "everyone_read" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
