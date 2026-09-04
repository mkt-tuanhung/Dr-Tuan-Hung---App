-- ============================================================
-- NHÓM "HÀNH TRÌNH KHÁCH HÀNG" — trạng thái hành trình sau chốt mổ,
-- cập nhật bằng NÚT BẤM trong nhóm Telegram (chỉ Điều dưỡng/Admin).
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================
alter table customer_appointments add column if not exists journey_status text;      -- dang_mo | mo_xong | ra_vien
alter table customer_appointments add column if not exists journey_updated_at timestamptz;
alter table customer_appointments add column if not exists journey_updated_by text;  -- tên người bấm nút
