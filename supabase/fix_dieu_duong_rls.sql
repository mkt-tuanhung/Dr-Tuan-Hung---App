-- Xóa các policy rác (nếu có)
DROP POLICY IF EXISTS "dieu_duong_all" ON customer_appointments;
DROP POLICY IF EXISTS "dieu_duong_truong_all" ON customer_appointments;
DROP POLICY IF EXISTS "dieu_duong_read" ON customer_appointments;
DROP POLICY IF EXISTS "dieu_duong_update_notes" ON customer_appointments;

-- 1. Cho phép TẤT CẢ Điều dưỡng được XEM danh sách khách hàng (để phục vụ Khách Phẫu Thuật và Hậu phẫu)
CREATE POLICY "dieu_duong_read" ON customer_appointments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'dieu_duong')
  );

-- 2. Cấp quyền UPDATE/ALL cho ĐIỀU DƯỠNG TRƯỞNG (Được toàn quyền phân công)
CREATE POLICY "dieu_duong_truong_all" ON customer_appointments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'dieu_duong' AND p.position = 'Trưởng bộ phận')
  );

-- 3. Cấp quyền UPDATE cho Điều dưỡng thường NHƯNG CHỈ trên những ca họ được phân công (Để họ lưu ghi chú hậu phẫu)
CREATE POLICY "dieu_duong_update_notes" ON customer_appointments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'dieu_duong' AND p.position != 'Trưởng bộ phận')
    AND (
      hau_phau_id = auth.uid() 
      OR auth.uid() = ANY(additional_hau_phau_ids)
    )
  );

-- Đảm bảo các cột phân công có tồn tại
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS surgery_type text;
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS phu_mo_1_id uuid references profiles(id);
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS phu_mo_2_id uuid references profiles(id);
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS phu_mo_3_id uuid references profiles(id);
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS surgery_notes text;
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS truc_dem_id uuid references profiles(id);
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS truc_dem_notes text;
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS hau_phau_id uuid references profiles(id);

-- Thêm cột phục vụ tính năng Phân công thêm Điều dưỡng
ALTER TABLE customer_appointments ADD COLUMN IF NOT EXISTS additional_hau_phau_ids uuid[] DEFAULT '{}';
