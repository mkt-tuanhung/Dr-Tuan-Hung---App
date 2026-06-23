-- ============================================================
-- Khách Cọc — thêm cột ảnh + quyền xem cho kế toán/cổ đông/marketing
-- An toàn cho prod (if not exists). Chạy trong Supabase SQL Editor.
-- ============================================================

-- Ảnh bill cọc + ảnh ghi chú (đẩy lên R2, lưu URL)
alter table customer_appointments add column if not exists deposit_bill_url text;
alter table customer_appointments add column if not exists note_image_urls text[] default '{}';

-- Cho phép kế toán / cổ đông / marketing XEM danh sách khách (để vào module Khách Cọc)
drop policy if exists "finance_marketing_read_appointments" on customer_appointments;
create policy "finance_marketing_read_appointments" on customer_appointments
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid()
            and p.role in ('accountant', 'shareholder', 'marketing'))
  );
