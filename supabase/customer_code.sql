-- MÃ KHÁCH HÀNG do Trực page nhập khi tạo khách (12/11/2026). Idempotent.
-- Khách chuyển từ GetFly: lấy luôn mã GetFly làm mã KH.
alter table public.marketing_data add column if not exists customer_code text;
update public.marketing_data set customer_code = getfly_code where customer_code is null and getfly_code is not null;
create index if not exists idx_md_customer_code on public.marketing_data (lower(customer_code));
notify pgrst, 'reload schema';
