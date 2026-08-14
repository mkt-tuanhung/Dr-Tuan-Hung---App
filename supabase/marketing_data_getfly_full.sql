-- ============================================================
-- KÉO FULL THÔNG TIN GETFLY về Data khách hàng — thêm cột chứa toàn bộ
-- thông tin GetFly: email, giới tính, sinh nhật, địa chỉ, website, nhóm KH,
-- nguồn, người phụ trách (GetFly), mối quan hệ, doanh thu, ngày tạo/sửa…
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================
alter table marketing_data
  add column if not exists getfly_id         text,
  add column if not exists getfly_code       text,          -- mã KH GetFly
  add column if not exists email             text,
  add column if not exists gender            text,
  add column if not exists birthday          text,
  add column if not exists address           text,
  add column if not exists website           text,
  add column if not exists customer_group    text,          -- "Nhóm khách hàng" (vd Nhóm hàm mặt)
  add column if not exists source            text,          -- "Nguồn khách hàng" (vd Facebook Ads)
  add column if not exists manager_name      text,          -- "Người phụ trách" bên GetFly
  add column if not exists relation_name     text,          -- "Mối quan hệ" GetFly (nguyên văn)
  add column if not exists total_revenue     numeric not null default 0,
  add column if not exists getfly_created_at timestamptz,
  add column if not exists getfly_updated_at timestamptz,
  add column if not exists getfly_synced_at  timestamptz;

create index if not exists idx_marketing_data_getfly on marketing_data(getfly_id);

notify pgrst, 'reload schema';
