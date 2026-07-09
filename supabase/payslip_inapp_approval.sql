-- ============================================================
-- DUYỆT XEM LƯƠNG NGAY TRONG APP (không phụ thuộc Telegram)
-- ------------------------------------------------------------
-- Admin/Kế toán thấy danh sách yêu cầu xem lương đang chờ ngay tại Bảng lương
-- và bấm Duyệt/Từ chối trực tiếp. Dùng chung bảng payslip_view_requests.
-- Idempotent — chạy trong Supabase SQL Editor.
-- (Cần đã chạy payslip_view_approval.sql trước để có bảng payslip_view_requests.)
-- ============================================================

-- Danh sách yêu cầu đang chờ (chỉ admin/accountant đọc được)
create or replace function payslip_pending_requests()
returns setof payslip_view_requests
language sql security definer set search_path = public as $$
  select * from payslip_view_requests
  where status = 'pending'
    and exists (select 1 from profiles where id = auth.uid() and role::text in ('admin', 'accountant'))
  order by created_at desc;
$$;
grant execute on function payslip_pending_requests() to authenticated;

-- Duyệt / từ chối trực tiếp trong app
create or replace function resolve_payslip_view(p_id uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare arole text;
begin
  select role::text into arole from profiles where id = auth.uid();
  if arole not in ('admin', 'accountant') then return '⛔ Không có quyền'; end if;
  update payslip_view_requests
     set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now()
   where id = p_id and status = 'pending';
  if not found then return 'ℹ️ Đã xử lý trước đó'; end if;
  return case when p_approve then 'approved' else 'rejected' end;
end $$;
grant execute on function resolve_payslip_view(uuid, boolean) to authenticated;
