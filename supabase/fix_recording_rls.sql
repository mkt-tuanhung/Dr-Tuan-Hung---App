-- ============================================================
-- FIX: hệ thống KHÔNG ghi nhận doanh thu / dòng tiền (do RLS)
-- ------------------------------------------------------------
-- Khi RLS chặn 1 UPDATE/INSERT, Supabase trả "thành công" nhưng sửa 0 dòng
-- (không báo lỗi) -> giao diện tưởng đã lưu nhưng dữ liệu không vào.
--
-- 2 lỗ hổng đã xác minh trong code SQL:
--  1) "staff_read_write_own" kiểm cột CŨ sale_offline_id, nhưng app lưu sale vào
--     sale_id (update_appointments.sql) -> Sale Offline không có quyền UPDATE.
--  2) Policy tài chính (cash_flows, is_accountant, đọc doanh thu) chỉ kiểm role,
--     bỏ role_2 -> kế toán gán quyền ở vai trò phụ bị chặn.
--
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

-- 1) Quyền sở hữu khách: dùng đúng cột sale_id (giữ cả cột cũ cho an toàn)
drop policy if exists "staff_read_write_own" on customer_appointments;
create policy "staff_read_write_own" on customer_appointments for all
  using (telesale_id = auth.uid() or sale_id = auth.uid() or sale_offline_id = auth.uid() or created_by = auth.uid())
  with check (telesale_id = auth.uid() or sale_id = auth.uid() or sale_offline_id = auth.uid() or created_by = auth.uid());

-- 2) Sale Offline được quản lý/đánh giá khách trong luồng tư vấn (như telesale)
drop policy if exists "sale_manage_appointments" on customer_appointments;
create policy "sale_manage_appointments" on customer_appointments for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text='sale_offline' or p.role_2::text='sale_offline')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text='sale_offline' or p.role_2::text='sale_offline')));

-- 3) is_accountant(): tính cả role_2
create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and (role::text='accountant' or role_2::text='accountant'));
$$;

-- 4) Doanh thu: kế toán/giám đốc/marketing đọc khách (tính role_2)
drop policy if exists "finance_marketing_read_appointments" on customer_appointments;
create policy "finance_marketing_read_appointments" on customer_appointments for select using (
  exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text in ('accountant','shareholder','marketing') or p.role_2::text in ('accountant','shareholder','marketing'))));

-- 5) Dòng tiền: ghi (admin/kế toán) + đọc (thêm giám đốc), tính role_2
drop policy if exists "finance_read_all" on cash_flows;
create policy "finance_read_all" on cash_flows for select using (
  exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text in ('admin','accountant','shareholder') or p.role_2::text in ('admin','accountant','shareholder'))));
drop policy if exists "finance_write_all" on cash_flows;
create policy "finance_write_all" on cash_flows for all using (
  exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text in ('admin','accountant') or p.role_2::text in ('admin','accountant'))))
  with check (exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text in ('admin','accountant') or p.role_2::text in ('admin','accountant'))));
