-- ============================================================
-- Sửa RLS leave_requests: nhân sự xem/tạo đơn của mình;
-- admin & kế toán xem + duyệt mọi đơn.
-- (Triệu chứng: tạo đơn được + báo Telegram, nhưng không ai SELECT thấy → SELECT bị chặn)
-- ============================================================

alter table leave_requests enable row level security;

drop policy if exists "leave_admin_all" on leave_requests;
drop policy if exists "leave_staff_own" on leave_requests;
drop policy if exists "leave_select" on leave_requests;
drop policy if exists "leave_insert" on leave_requests;
drop policy if exists "leave_manage" on leave_requests;

-- Nhân sự: xem + tạo + sửa đơn của chính mình
create policy "leave_staff_own" on leave_requests for all
  using (staff_id = auth.uid())
  with check (staff_id = auth.uid());

-- Admin & kế toán: toàn quyền (xem & duyệt mọi đơn)
create policy "leave_admin_all" on leave_requests for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'accountant')));
