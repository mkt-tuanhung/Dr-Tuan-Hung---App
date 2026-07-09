-- ============================================================
-- MÃ BẢO MẬT PHIẾU LƯƠNG RIÊNG CHO TỪNG NHÂN SỰ
-- ------------------------------------------------------------
-- Mỗi nhân sự có 1 mã riêng (không dùng mã chung). Admin đặt mã cho
-- từng người tại Bảng lương (nút 🔑 trên mỗi dòng). Mã dùng để mã hoá
-- QR phiếu lương; nhân sự nhập đúng mã của mình rồi CHỜ ADMIN DUYỆT
-- mới xem được chi tiết lương.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table profiles add column if not exists payslip_code text;
