-- ============================================================
-- PHÂN CÔNG TELESALE cho Data khách hàng
-- Mỗi khách gán 1 telesale phụ trách; admin/marketing chia data (gán tay
-- hoặc "Chia đều"). Telesale mở tab mặc định "Của tôi".
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================
alter table marketing_data
  add column if not exists telesale_id uuid references profiles(id) on delete set null;

create index if not exists idx_marketing_data_telesale on marketing_data(telesale_id);

notify pgrst, 'reload schema';
