-- ============================================================
-- Cho MARKETING sửa doanh thu (Doanh thu tổng / Upsale / người phụ trách...) ở màn Doanh thu.
-- Trước đây marketing chỉ có quyền XEM khách (finance_marketing_read_appointments) nên bấm
-- "Sửa doanh thu" bị chặn âm thầm (0 dòng được cập nhật) -> số liệu không đổi.
-- Tính cả vai trò phụ (role_2). Không cấp quyền XOÁ.
-- Chạy trong Supabase SQL Editor. Chạy lại nhiều lần không sao.
-- ============================================================
drop policy if exists "marketing_update_revenue" on customer_appointments;
create policy "marketing_update_revenue" on customer_appointments for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid()
      and (p.role::text = 'marketing' or p.role_2::text = 'marketing'))
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid()
      and (p.role::text = 'marketing' or p.role_2::text = 'marketing'))
  );

-- Kiểm tra: phải ra 1 dòng
select policyname, cmd from pg_policies
where tablename = 'customer_appointments' and policyname = 'marketing_update_revenue';
