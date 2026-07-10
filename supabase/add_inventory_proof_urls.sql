-- ============================================================
-- VẬT TƯ NHẬP MỚI — cho phép NHIỀU ảnh hoá đơn/chứng từ mỗi phiếu
-- ------------------------------------------------------------
-- proof_urls: mảng URL ảnh (hoá đơn / bill / chứng từ). proof_url (1 ảnh cũ)
-- vẫn giữ để tương thích ngược (lưu ảnh đầu tiên).
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table inventory_transactions add column if not exists proof_urls text[] default '{}';
