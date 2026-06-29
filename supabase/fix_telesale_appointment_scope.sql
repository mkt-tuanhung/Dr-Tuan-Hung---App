-- ============================================================
-- VÁ LỖ HỔNG: telesale/sale đọc được lịch hẹn của NGƯỜI KHÁC
-- ------------------------------------------------------------
-- Policy "telesale_manage_appointments" cấp FOR ALL cho MỌI telesale trên
-- TOÀN BỘ customer_appointments → telesale xem/sửa cả khách của người khác,
-- gồm cột tài chính (revenue, deposit_amount, hospital_fee).
--
-- Ngoài ra "staff_read_write_own" (schema.sql) dùng NHẦM cột cũ
-- `sale_offline_id` (luôn null) thay vì `sale_id` mà app đang dùng → sale
-- offline không được scope đúng.
--
-- Sau khi vá: telesale/sale chỉ thao tác trên khách của MÌNH (telesale chính
-- telesale_id, telesale phụ telesale_id_2, sale sale_id, hoặc người tạo
-- created_by). Các role khác giữ nguyên policy riêng:
--   admin_all (admin), acct_read_appointments (kế toán),
--   finance_marketing_read_appointments (marketing/cổ đông),
--   cskh_* (CSKH), dieu_duong_* (điều dưỡng).
--
-- An toàn: app set created_by=profile.id khi tạo (AppointmentManagementPage,
-- KhachCocPage) → telesale/sale vẫn TẠO được khách. Eval/sửa khách của mình
-- vẫn chạy. Idempotent — chạy trong Supabase SQL Editor.
--
-- LƯU Ý NGHIỆP VỤ: nếu tài khoản "đầu não" nhập lịch cho cả công ty cần XEM
-- TẤT CẢ lịch hẹn, hãy đặt tài khoản đó role 'admin' (hoặc thêm policy riêng),
-- vì sau khi vá, role telesale chỉ còn thấy khách của chính mình/đã tạo.
-- ============================================================

alter table customer_appointments enable row level security;

-- Gỡ policy rộng gây lộ + policy scope sai cột
drop policy if exists "telesale_manage_appointments" on customer_appointments;
drop policy if exists "telesale2_read_write" on customer_appointments;
drop policy if exists "staff_read_write_own" on customer_appointments;

-- Nhân sự kinh doanh chỉ thao tác trên khách của mình
drop policy if exists "appt_staff_own" on customer_appointments;
create policy "appt_staff_own" on customer_appointments for all
  using (
    telesale_id = auth.uid()
    or telesale_id_2 = auth.uid()
    or sale_id = auth.uid()
    or created_by = auth.uid()
  )
  with check (
    telesale_id = auth.uid()
    or telesale_id_2 = auth.uid()
    or sale_id = auth.uid()
    or created_by = auth.uid()
  );
