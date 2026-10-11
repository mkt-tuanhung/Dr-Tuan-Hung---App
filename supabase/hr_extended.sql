-- ============================================================
-- NHÂN SỰ MỞ RỘNG (Ethics BOS D05 / D06) — chạy 1 lần trong SQL Editor (chạy lại vẫn an toàn)
--
-- profiles: hợp đồng lao động + thông tin cá nhân cho ngăn chi tiết nhân sự
--   contract_type  : 'probation' thử việc | 'fixed_term' xác định thời hạn |
--                    'indefinite' không xác định thời hạn | 'seasonal' thời vụ / CTV
--   contract_start / contract_end : ngày hiệu lực hợp đồng hiện tại (contract_end trống = không thời hạn)
--   -> app cảnh báo hợp đồng hết hạn trong 30 ngày
-- leave_requests.decision_note : lý do duyệt / từ chối đơn (Ethics: từ chối phải có lý do)
--
-- Chỉ THÊM cột, không đổi dữ liệu cũ. Quyền sửa vẫn theo policy profiles sẵn có (Admin).
-- ============================================================

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists contract_type text;
alter table public.profiles add column if not exists contract_start date;
alter table public.profiles add column if not exists contract_end date;

do $$ begin
  alter table public.profiles add constraint profiles_gender_check
    check (gender is null or gender in ('male', 'female', 'other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_contract_type_check
    check (contract_type is null or contract_type in ('probation', 'fixed_term', 'indefinite', 'seasonal'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_contract_dates_check
    check (contract_end is null or contract_start is null or contract_end >= contract_start);
exception when duplicate_object then null; end $$;

create index if not exists profiles_contract_end_idx on public.profiles (contract_end) where contract_end is not null;

alter table public.leave_requests add column if not exists decision_note text;

-- Nhật ký hoạt động (audit_log.sql) đã chạy -> theo dõi thêm các cột hợp đồng
do $$ begin
  if to_regprocedure('public.audit_attach(text, text, text, text)') is not null then
    perform public.audit_attach('profiles', 'role,role_2,position,base_salary,allowance,fixed_salary,is_active,employment_status,probation_started_at,official_started_at,bank_name,bank_account,employee_id,contract_type,contract_start,contract_end');
    perform public.audit_attach('leave_requests', 'type,date,status,decision_note', 'staff_id');
  end if;
end $$;
