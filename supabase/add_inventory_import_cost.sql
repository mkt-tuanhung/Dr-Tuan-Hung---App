-- ============================================================
-- VẬT TƯ NHẬP MỚI — thêm SỐ TIỀN + HOÁ ĐƠN/CHỨNG TỪ cho phiếu nhập kho
-- ------------------------------------------------------------
--   amount    : số tiền của phiếu nhập (để tính tiền vật tư nhập mới trong tháng)
--   proof_url : ảnh hoá đơn / bill chuyển khoản / chứng từ
--   supplier  : nhà cung cấp
-- Nhập kho vẫn tự cộng tồn nhờ trigger auto_update_stock sẵn có.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table inventory_transactions add column if not exists amount bigint default 0;
alter table inventory_transactions add column if not exists proof_url text;
alter table inventory_transactions add column if not exists supplier text;
