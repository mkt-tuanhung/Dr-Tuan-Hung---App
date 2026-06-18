-- Thêm trường Ngân hàng và Số tài khoản cho nhân sự
alter table profiles
add column if not exists bank_name text,
add column if not exists bank_account text;
