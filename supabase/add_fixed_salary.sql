-- ============================================================
-- LƯƠNG CỐ ĐỊNH: nhân sự nhận đủ lương tháng, không cần chấm công
-- ------------------------------------------------------------
-- Thêm cột fixed_salary vào profiles. Khi = true, PayrollPage trả đủ
-- lương tháng (không trừ theo ngày công).
--
-- Đồng thời bổ sung fixed_salary vào danh sách cột NHẠY CẢM của trigger
-- chống tự nâng quyền/sửa lương (chỉ admin mới được bật/tắt).
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table profiles add column if not exists fixed_salary boolean not null default false;

-- Cập nhật trigger bảo vệ: nhân sự thường KHÔNG được tự đổi fixed_salary
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.role_2 is distinct from old.role_2
     or new.base_salary is distinct from old.base_salary
     or new.allowance is distinct from old.allowance
     or new.employment_status is distinct from old.employment_status
     or new.is_active is distinct from old.is_active
     or new.position is distinct from old.position
     or new.probation_started_at is distinct from old.probation_started_at
     or new.fixed_salary is distinct from old.fixed_salary then
    raise exception 'Không có quyền sửa thông tin nhạy cảm (chức vụ/lương/trạng thái) của hồ sơ';
  end if;

  return new;
end;
$$;

-- Trigger đã tạo trước đó (fix_profile_self_escalation.sql); tạo lại cho chắc.
drop trigger if exists trg_protect_profile_sensitive on profiles;
create trigger trg_protect_profile_sensitive
  before update on profiles
  for each row execute function public.protect_profile_sensitive_columns();
