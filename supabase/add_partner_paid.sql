-- ============================================================
-- MỔ ĐỐI TÁC — trạng thái "đối tác đã thanh toán"
-- ------------------------------------------------------------
-- Chỉ khi partner_paid = true thì mới:
--   • cộng tiền đối tác vào dòng tiền / lãi lỗ
--   • tính công mổ 50% cho bác sĩ
-- (Phụ mổ điều dưỡng vẫn tính bình thường.)
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table partner_surgeries add column if not exists partner_paid boolean not null default false;
alter table partner_surgeries add column if not exists paid_at timestamptz;
