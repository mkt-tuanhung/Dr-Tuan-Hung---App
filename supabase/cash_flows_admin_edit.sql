-- ============================================================
-- KẾ TOÁN DÒNG TIỀN — chỉ ADMIN được SỬA giao dịch đã ghi.
-- Kế toán vẫn: xem, thêm, xóa như cũ. Cổ đông: chỉ xem.
-- (Tách policy "for all" cũ thành insert/update/delete riêng)
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================

drop policy if exists "finance_write_all" on cash_flows;
drop policy if exists "cf_insert" on cash_flows;
drop policy if exists "cf_update" on cash_flows;
drop policy if exists "cf_delete" on cash_flows;

-- Thêm: admin + kế toán (vai chính hoặc kiêm nhiệm)
create policy "cf_insert" on cash_flows for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text in ('admin','accountant') or p.role_2::text in ('admin','accountant')))
);

-- SỬA: CHỈ admin
create policy "cf_update" on cash_flows for update using (
  exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text = 'admin' or p.role_2::text = 'admin'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text = 'admin' or p.role_2::text = 'admin'))
);

-- Xóa: admin + kế toán (giữ như trước)
create policy "cf_delete" on cash_flows for delete using (
  exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text in ('admin','accountant') or p.role_2::text in ('admin','accountant')))
);

-- Kiểm tra: phải thấy cf_insert / cf_update / cf_delete / finance_read_all
select policyname, cmd from pg_policies where tablename = 'cash_flows' order by policyname;
