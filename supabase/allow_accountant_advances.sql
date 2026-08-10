-- ============================================================
-- Cho KẾ TOÁN được DUYỆT TẠM ỨNG (chi hộ) và GHI NHẬN HOÀN ỨNG
-- ------------------------------------------------------------
-- Trang "Tạm ứng chi" (AdvanceExpensePage) đọc/ghi bảng `expenses`.
-- Trước đây kế toán CHỈ có quyền SELECT (policy accountant_read) nên khi bấm
-- "Duyệt" hoặc "Ghi nhận hoàn ứng" (đều là UPDATE) thì bị RLS chặn -> không ăn.
-- Nút đã hiện sẵn cho kế toán ở giao diện, chỉ thiếu quyền dưới CSDL.
--
-- Sau khi chạy: kế toán được TẠO phiếu (chi hộ giúp nhân sự), DUYỆT phiếu và
-- GHI NHẬN HOÀN ỨNG. XOÁ VĨNH VIỄN vẫn chỉ dành cho admin (đúng như giao diện).
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

-- Helper (tạo lại cho chắc, phòng khi chưa chạy allow_accountant_payroll.sql)
create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'accountant');
$$;

-- ---------- expenses: kế toán được TẠO + DUYỆT + HOÀN ỨNG ----------
alter table expenses enable row level security;

-- Tạo phiếu (kể cả chi hộ giúp nhân sự khác)
drop policy if exists "acct_insert_expenses" on expenses;
create policy "acct_insert_expenses" on expenses for insert
  with check (public.is_accountant());

-- Duyệt / từ chối / ghi nhận hoàn ứng (đều là UPDATE trạng thái)
drop policy if exists "acct_update_expenses" on expenses;
create policy "acct_update_expenses" on expenses for update
  using (public.is_accountant())
  with check (public.is_accountant());
-- (Cố ý KHÔNG cấp DELETE — xoá vĩnh viễn phiếu chi vẫn chỉ admin)

-- ---------- salary_advances: bảo đảm kế toán DUYỆT được ứng lương ----------
-- (Đề phòng salary_overtime.sql / fix_rls_self_approve.sql chưa được chạy.)
alter table salary_advances enable row level security;
drop policy if exists "sa_manage" on salary_advances;
create policy "sa_manage" on salary_advances for all
  using (public.is_admin() or public.is_accountant())
  with check (public.is_admin() or public.is_accountant());

notify pgrst, 'reload schema';
