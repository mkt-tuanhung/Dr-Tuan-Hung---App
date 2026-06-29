-- ============================================================
-- VÁ LỖ HỔNG: nhân sự tự duyệt đơn NGHỈ PHÉP / ỨNG LƯƠNG
-- ------------------------------------------------------------
-- Trước đây policy "leave_staff_own" (FOR ALL) cho nhân sự UPDATE đơn của
-- chính mình → có thể tự set status='approved' (trigger ghi công luôn).
-- Tương tự "sa_insert" không ép status nên nhân sự insert thẳng 'approved'.
--
-- Sau khi vá: nhân sự CHỈ được TẠO đơn ở trạng thái 'pending' và XEM đơn
-- của mình; KHÔNG được tự cập nhật trạng thái. Duyệt vẫn do admin/kế toán.
--
-- An toàn: app chỉ insert đơn (status='pending') và admin/kế toán mới update
-- (xem AttendancePage / LeaveManagementPage / PayrollPage). Không phá luồng nào.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

-- ---------- leave_requests ----------
alter table leave_requests enable row level security;

-- Gỡ policy FOR ALL cũ của nhân sự (nguồn lỗ hổng tự duyệt)
drop policy if exists "leave_staff_own" on leave_requests;
drop policy if exists "leave_staff_select" on leave_requests;
drop policy if exists "leave_staff_insert" on leave_requests;

-- Nhân sự xem đơn của chính mình (mọi trạng thái)
create policy "leave_staff_select" on leave_requests for select
  using (staff_id = auth.uid());

-- Nhân sự chỉ được TẠO đơn ở trạng thái pending (không thể tự duyệt)
create policy "leave_staff_insert" on leave_requests for insert
  with check (staff_id = auth.uid() and status = 'pending');
-- (Cố ý KHÔNG tạo policy UPDATE/DELETE cho nhân sự)

-- Admin & kế toán: toàn quyền (xem & duyệt). Tạo lại cho chắc (idempotent).
drop policy if exists "leave_admin_all" on leave_requests;
create policy "leave_admin_all" on leave_requests for all
  using (public.is_admin() or public.is_accountant())
  with check (public.is_admin() or public.is_accountant());

-- ---------- salary_advances ----------
alter table salary_advances enable row level security;

-- Nhân sự chỉ được tạo đơn ứng lương ở trạng thái 'pending'
drop policy if exists "sa_insert" on salary_advances;
create policy "sa_insert" on salary_advances for insert with check (
  public.is_admin() or public.is_accountant() or (staff_id = auth.uid() and status = 'pending'));

-- Lưu ý: "sa_read" (xem đơn của mình / admin / kế toán) và "sa_manage"
-- (admin/kế toán toàn quyền) giữ nguyên — nhân sự không có policy UPDATE nên
-- không thể tự đổi trạng thái sau khi tạo.
