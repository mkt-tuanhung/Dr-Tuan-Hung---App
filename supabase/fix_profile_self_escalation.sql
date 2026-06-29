-- ============================================================
-- VÁ LỖ HỔNG: nhân sự tự nâng quyền (role=admin) / tự sửa lương
-- ------------------------------------------------------------
-- Policy "self_update" (allow_profile_update.sql) cho nhân sự UPDATE hồ sơ
-- của chính mình, nhưng KHÔNG khoá cột → nhân sự gọi thẳng API có thể
-- update role='admin', base_salary, allowance... cho bản thân.
--
-- RLS WITH CHECK không thấy giá trị cũ nên không khoá theo cột được →
-- dùng TRIGGER so sánh OLD/NEW. Admin và backend (service role) vẫn toàn quyền;
-- nhân sự thường chỉ được sửa cột an toàn (full_name, phone, bank_*, avatar_url).
--
-- An toàn: admin sửa qua StaffManagementPage vẫn chạy (is_admin()=true);
-- nhân sự tự sửa hồ sơ ở ProfileMenu (full_name/phone/bank/avatar) không bị chặn.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Backend/service role (không có phiên đăng nhập) hoặc admin: cho phép mọi thay đổi
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Nhân sự thường: cấm tự đổi các cột nhạy cảm (chức vụ / lương / trạng thái)
  if new.role is distinct from old.role
     or new.role_2 is distinct from old.role_2
     or new.base_salary is distinct from old.base_salary
     or new.allowance is distinct from old.allowance
     or new.employment_status is distinct from old.employment_status
     or new.is_active is distinct from old.is_active
     or new.position is distinct from old.position
     or new.probation_started_at is distinct from old.probation_started_at then
    raise exception 'Không có quyền sửa thông tin nhạy cảm (chức vụ/lương/trạng thái) của hồ sơ';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_sensitive on profiles;
create trigger trg_protect_profile_sensitive
  before update on profiles
  for each row execute function public.protect_profile_sensitive_columns();
