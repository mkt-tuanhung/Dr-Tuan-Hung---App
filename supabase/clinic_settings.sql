-- ============================================================
-- CÀI ĐẶT HỆ THỐNG (theo Ethics BOS D12) — chạy 1 lần trong SQL Editor
-- (chạy lại nhiều lần vẫn an toàn)
--
-- clinic_settings: bảng CHỈ CÓ 1 DÒNG (id luôn = true) chứa thông tin phòng khám
--   và quy tắc chấm công / công chuẩn dùng chung:
--   - clinic_name, legal_name, tax_code, address, hotline, email, website, logo_url
--   - working_hours: giờ mở cửa theo thứ trong tuần
--       {"mon":{"open":"08:00","close":"20:00","closed":false}, … "sun":{…}}
--   - office_ips: danh sách IP mạng văn phòng (đối chiếu khi chấm công)
--   - payroll_standard_days: số công chuẩn / tháng (mặc định 26)
--   - late_grace_minutes: số phút ân hạn trước khi tính đi muộn
--
-- LƯU Ý: hiện tại các màn khác CHƯA đọc bảng này — bảng lương vẫn dùng hằng số
--   STANDARD_DAYS = 26 (pages/PayrollPage.jsx), chấm công vẫn dùng hằng số
--   OFFICE_IPS (lib/geo.js, pages/AttendanceManagementPage.jsx). Bảng này là nơi
--   lưu tập trung để nối dần các màn sau.
--
-- Quyền (RLS):
--   - Ai đăng nhập cũng ĐỌC được (để in phiếu, hiện tên phòng khám…)
--   - Chỉ Admin (vai trò chính hoặc vai trò phụ role_2) được tạo / sửa
--   - KHÔNG ai xoá được (không có policy delete)
-- Nếu đã chạy audit_log.sql: mọi thay đổi được ghi vào Nhật ký hoạt động.
-- Chỉ THÊM bảng mới, không sửa bảng cũ.
-- ============================================================

create table if not exists public.clinic_settings (
  id                     boolean primary key default true check (id),
  clinic_name            text not null default 'Phòng khám Dr Tuấn Hùng',
  legal_name             text,
  tax_code               text,
  address                text,
  hotline                text,
  email                  text,
  website                text,
  logo_url               text,
  working_hours          jsonb not null default '{
    "mon": {"open": "08:00", "close": "20:00", "closed": false},
    "tue": {"open": "08:00", "close": "20:00", "closed": false},
    "wed": {"open": "08:00", "close": "20:00", "closed": false},
    "thu": {"open": "08:00", "close": "20:00", "closed": false},
    "fri": {"open": "08:00", "close": "20:00", "closed": false},
    "sat": {"open": "08:00", "close": "20:00", "closed": false},
    "sun": {"open": "08:00", "close": "20:00", "closed": false}
  }'::jsonb,
  office_ips             text[] not null default '{}',
  payroll_standard_days  int not null default 26,
  late_grace_minutes     int not null default 0,
  updated_by             uuid references public.profiles(id) on delete set null,
  updated_at             timestamptz not null default now()
);

-- Ràng buộc giá trị hợp lệ (thêm riêng để chạy lại không lỗi)
do $$ begin
  alter table public.clinic_settings add constraint clinic_settings_std_days_chk
    check (payroll_standard_days between 1 and 31);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clinic_settings add constraint clinic_settings_grace_chk
    check (late_grace_minutes between 0 and 240);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clinic_settings add constraint clinic_settings_hours_chk
    check (jsonb_typeof(working_hours) = 'object');
exception when duplicate_object then null; end $$;

-- Dòng duy nhất. IP văn phòng khởi tạo đúng bằng hằng số đang dùng trong app (lib/geo.js)
insert into public.clinic_settings (id, clinic_name, office_ips)
values (true, 'Phòng khám Dr Tuấn Hùng', array['42.114.215.104'])
on conflict (id) do nothing;

-- Tự ghi người sửa + thời điểm sửa (không tin giá trị app gửi lên)
create or replace function public.clinic_settings_touch()
returns trigger language plpgsql as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists trg_clinic_settings_touch on public.clinic_settings;
create trigger trg_clinic_settings_touch before insert or update on public.clinic_settings
  for each row execute function public.clinic_settings_touch();

alter table public.clinic_settings enable row level security;

drop policy if exists clinic_settings_read on public.clinic_settings;
create policy clinic_settings_read on public.clinic_settings
  for select to authenticated using (true);

drop policy if exists clinic_settings_admin_insert on public.clinic_settings;
create policy clinic_settings_admin_insert on public.clinic_settings
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                      and (p.role::text = 'admin' or p.role_2::text = 'admin')));

drop policy if exists clinic_settings_admin_update on public.clinic_settings;
create policy clinic_settings_admin_update on public.clinic_settings
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and (p.role::text = 'admin' or p.role_2::text = 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                      and (p.role::text = 'admin' or p.role_2::text = 'admin')));

-- Không có policy delete -> không ai xoá được dòng cài đặt
grant select, insert, update on public.clinic_settings to authenticated;

-- Nhật ký hoạt động (audit_log.sql) đã chạy -> ghi lại mọi thay đổi cài đặt
do $$ begin
  if to_regprocedure('public.audit_attach(text, text, text, text)') is not null then
    perform public.audit_attach('clinic_settings', '*');
  end if;
end $$;

-- Kiểm tra sau khi chạy
select 'clinic_settings rows' as check, count(*) as ok from public.clinic_settings;
