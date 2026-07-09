-- ============================================================
-- Thêm role 'bac_si' (Bác sĩ) vào enum user_role.
-- Frontend (StaffManagementPage) đã có role Bác sĩ nhưng enum trong DB chưa
-- có giá trị này → tạo/sửa nhân sự role Bác sĩ báo lỗi:
--   invalid input value for enum user_role: "bac_si"
-- Áp dụng cho cả role và role_2 (cùng kiểu user_role).
-- Chạy trong Supabase SQL Editor (chạy riêng, không trong transaction).
-- ============================================================

alter type user_role add value if not exists 'bac_si';
