-- ============================================================
-- DR TUAN HUNG APP — CHO PHÉP KẾ TOÁN NHẬP MỚI VẬT TƯ
-- ------------------------------------------------------------
-- Sửa lỗi: "Kế toán không nhập mới được vật tư, nhập xong không ghi nhận".
-- Nguyên nhân có thể: thiếu cột cho phiếu nhập (amount/supplier/proof_urls...)
-- hoặc RLS chưa cho tài khoản 'accountant' được insert → lệnh lưu thất bại
-- (im lặng hoặc báo lỗi) nên phiếu không được ghi nhận.
--
-- File hợp nhất, IDEMPOTENT — chạy an toàn nhiều lần trong Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ĐẢM BẢO ĐỦ CỘT (danh mục + phiếu nhập/xuất)
-- ------------------------------------------------------------
alter table inventory_items add column if not exists current_stock numeric(10,2) default 0;
alter table inventory_items add column if not exists min_stock numeric(10,2) default 0;
alter table inventory_items add column if not exists notes text;
alter table inventory_items add column if not exists created_at timestamptz default now();

alter table inventory_transactions add column if not exists amount bigint default 0;          -- tiền của phiếu nhập
alter table inventory_transactions add column if not exists proof_url text;                    -- (cũ) 1 ảnh chứng từ
alter table inventory_transactions add column if not exists proof_urls text[] default '{}';    -- nhiều ảnh hoá đơn/bill
alter table inventory_transactions add column if not exists supplier text;                     -- nhà cung cấp
alter table inventory_transactions add column if not exists reference_id uuid;                 -- khách phẫu thuật (xuất kho)
alter table inventory_transactions add column if not exists created_at timestamptz default now();

-- ------------------------------------------------------------
-- 2) BẬT RLS + DỌN CÁC POLICY CŨ MÂU THUẪN
--    (gộp mọi tên policy từng dùng ở các migration trước)
-- ------------------------------------------------------------
alter table inventory_items enable row level security;
alter table inventory_transactions enable row level security;

drop policy if exists "admin_accountant"       on inventory_items;
drop policy if exists "allow_read"             on inventory_items;
drop policy if exists "allow_write"            on inventory_items;
drop policy if exists "allow_read_inventory"   on inventory_items;
drop policy if exists "allow_write_inventory"  on inventory_items;

drop policy if exists "admin_accountant"       on inventory_transactions;
drop policy if exists "allow_read"             on inventory_transactions;
drop policy if exists "allow_insert"           on inventory_transactions;
drop policy if exists "allow_read_trans"       on inventory_transactions;
drop policy if exists "allow_insert_trans"     on inventory_transactions;
drop policy if exists "allow_delete_trans"     on inventory_transactions;

-- ------------------------------------------------------------
-- 3) POLICY MỚI — RÕ RÀNG, CÓ CẢ using + with check
--    Kế toán (accountant) được: tạo/sửa danh mục, tạo/sửa/xoá phiếu.
-- ------------------------------------------------------------
-- Danh mục vật tư: đọc
create policy "inv_items_read" on inventory_items for select using (
  exists (select 1 from profiles p where p.id = auth.uid()
          and p.role::text in ('admin', 'accountant', 'dieu_duong', 'shareholder', 'cskh'))
);
-- Danh mục vật tư: thêm / sửa / xoá (kế toán nhập MỚI vật tư → tự tạo danh mục)
create policy "inv_items_write" on inventory_items for all
  using (exists (select 1 from profiles p where p.id = auth.uid()
                 and p.role::text in ('admin', 'accountant', 'dieu_duong')))
  with check (exists (select 1 from profiles p where p.id = auth.uid()
                 and p.role::text in ('admin', 'accountant', 'dieu_duong')));

-- Phiếu nhập/xuất: đọc
create policy "inv_trans_read" on inventory_transactions for select using (
  exists (select 1 from profiles p where p.id = auth.uid()
          and p.role::text in ('admin', 'accountant', 'shareholder', 'dieu_duong', 'cskh'))
);
-- Phiếu nhập/xuất: thêm (ghi nhận phiếu nhập vật tư)
create policy "inv_trans_insert" on inventory_transactions for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid()
          and p.role::text in ('admin', 'accountant', 'dieu_duong'))
);
-- Phiếu nhập/xuất: xoá
create policy "inv_trans_delete" on inventory_transactions for delete using (
  exists (select 1 from profiles p where p.id = auth.uid()
          and p.role::text in ('admin', 'accountant', 'dieu_duong'))
);

-- ------------------------------------------------------------
-- 4) TRIGGER TỰ CỘNG/TRỪ TỒN KHO (SECURITY DEFINER — không vướng RLS)
--    Dọn trigger/function cũ tham chiếu cột không còn tồn tại
--    (update_stock_quantity dùng stock_quantity / transaction_type).
-- ------------------------------------------------------------
drop trigger if exists trg_update_stock on inventory_transactions;
drop function if exists update_stock_quantity() cascade;

create or replace function auto_update_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (NEW.type = 'import') then
    update inventory_items set current_stock = coalesce(current_stock, 0) + NEW.quantity where id = NEW.item_id;
  elsif (NEW.type = 'export') then
    update inventory_items set current_stock = coalesce(current_stock, 0) - NEW.quantity where id = NEW.item_id;
  end if;
  return NEW;
end $$;

create trigger trg_update_stock
after insert on inventory_transactions
for each row execute function auto_update_stock();
