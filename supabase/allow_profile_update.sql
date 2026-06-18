-- 1. Đảm bảo đã có 2 cột ngân hàng
alter table profiles
add column if not exists bank_name text,
add column if not exists bank_account text;

-- 2. Cho phép nhân sự tự cập nhật hồ sơ cá nhân của chính mình
drop policy if exists "self_update" on profiles;
create policy "self_update" on profiles
  for update using (id = auth.uid());
