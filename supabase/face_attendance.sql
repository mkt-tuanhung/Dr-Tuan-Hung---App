-- ============================================================
-- CHẤM CÔNG KHUÔN MẶT (FACE_AI) — Phase 1: Foundation
-- Chạy TOÀN BỘ file này trong Supabase SQL Editor. Idempotent.
--
-- Kiến trúc: điện thoại chỉ XÁC MINH (detect + liveness + embedding),
-- Edge Function `face-attendance` là ATTENDANCE ENGINE: so khớp khuôn mặt
-- (template KHÔNG bao giờ rời server), quyết định đi muộn / trùng lượt,
-- ghi bảng attendance CŨ (không tạo bảng chấm công song song) và bắn
-- notification qua pipeline notifications -> Push + Telegram sẵn có.
-- ============================================================

-- 1) Bảng attendance cũ: thêm phương thức cho từng lượt (giữ nguyên GPS/IP cũ)
alter table attendance add column if not exists check_in_method  text;
alter table attendance add column if not exists check_out_method text;
-- Dữ liệu cũ đều chấm bằng GPS/IP web
update attendance set check_in_method  = 'gps_ip' where check_in  is not null and check_in_method  is null;
update attendance set check_out_method = 'gps_ip' where check_out is not null and check_out_method is null;

-- 2) FACE PROFILE — template sinh trắc học đã mã hóa (AES-GCM, key nằm trong
--    Supabase Edge Secret FACE_TEMPLATE_KEY; chỉ Edge Function service-role đọc)
create table if not exists face_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'ACTIVE', -- ACTIVE | NEEDS_REENROLLMENT | DISABLED
  template_enc text,        -- base64 {iv,data} AES-GCM — KHÔNG ai select được (thu hồi quyền cột bên dưới)
  template_version text not null default 'v1',
  model_version text,
  sample_count int,
  quality_score numeric,
  enrolled_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table face_profiles enable row level security;

drop policy if exists "fp_select" on face_profiles;
drop policy if exists "fp_admin_update" on face_profiles;
drop policy if exists "fp_admin_delete" on face_profiles;
-- Ai cũng chỉ xem được TRẠNG THÁI của chính mình; admin xem tất cả
create policy "fp_select" on face_profiles for select using (
  user_id = auth.uid() or public.is_admin()
);
-- Admin được đổi status (bắt đăng ký lại / khóa) và xóa profile.
-- INSERT/UPDATE template: KHÔNG có policy -> chỉ Edge Function (service role) làm được.
create policy "fp_admin_update" on face_profiles for update
  using (public.is_admin()) with check (public.is_admin());
create policy "fp_admin_delete" on face_profiles for delete using (public.is_admin());

-- Chặn đọc template ở tầng QUYỀN CỘT: kể cả chính chủ cũng không tải template về
revoke select on face_profiles from authenticated;
grant select (user_id, status, template_version, model_version, sample_count, quality_score, enrolled_at, updated_at)
  on face_profiles to authenticated;
grant update (status) on face_profiles to authenticated; -- policy giới hạn admin
grant delete on face_profiles to authenticated;           -- policy giới hạn admin

-- 3) AUDIT mỗi lượt xác minh (kể cả thất bại) + IDEMPOTENCY theo request_id
create table if not exists face_attendance_audit (
  id uuid default uuid_generate_v4() primary key,
  request_id text not null unique,      -- app retry -> trả lại kết quả cũ, không ghi công 2 lần
  user_id uuid references profiles(id) on delete set null,
  action text not null,                 -- CHECK_IN | CHECK_OUT
  match_score numeric,
  liveness_score numeric,
  liveness_method text,
  quality_score numeric,
  gps_verified boolean,
  gps_distance_m numeric,
  wifi_verified boolean,
  device_id text,
  model_version text,
  result text not null,                 -- ACCEPTED | REJECTED | ERROR
  error_code text,
  result_json jsonb,                    -- response đã trả cho app (phục vụ idempotency)
  created_at timestamptz default now()
);
alter table face_attendance_audit enable row level security;
drop policy if exists "faa_select" on face_attendance_audit;
create policy "faa_select" on face_attendance_audit for select using (
  user_id = auth.uid() or public.is_admin()
);
-- INSERT chỉ qua Edge Function (service role) — không cấp policy insert.

-- 4) CẤU HÌNH — không hardcode threshold/toạ độ trong code (spec mục 10, 45)
create table if not exists face_config (
  id int primary key default 1 check (id = 1),
  face_match_threshold numeric not null default 0.55,  -- cosine similarity 0..1 (CẦN hiệu chỉnh sau khi test thật)
  liveness_threshold numeric not null default 0.7,
  min_quality numeric not null default 0.6,
  require_liveness boolean not null default true,
  -- 'warn' = sai vị trí vẫn ghi công + cảnh báo (giống GPS flow hiện tại)
  -- 'require' = Face OK nhưng sai cả GPS lẫn IP -> TỪ CHỐI ghi công
  location_rule text not null default 'warn',
  office_lat numeric not null default 21.025956,   -- 10 ngõ 168 Hào Nam (khớp AttendancePage)
  office_lng numeric not null default 105.828384,
  office_radius_m numeric not null default 200,
  office_ips jsonb not null default '["42.114.215.104"]'::jsonb,
  work_start time not null default '09:00',        -- sau giờ này = đi muộn (quy tắc hiện hành)
  late_grace_min int not null default 0,
  updated_at timestamptz default now()
);
insert into face_config (id) values (1) on conflict (id) do nothing;
alter table face_config enable row level security;
drop policy if exists "fc_select" on face_config;
drop policy if exists "fc_admin_update" on face_config;
create policy "fc_select" on face_config for select using (auth.uid() is not null);
create policy "fc_admin_update" on face_config for update
  using (public.is_admin()) with check (public.is_admin());

-- 5) Kiểm tra sau khi chạy
select 'attendance.method cols' as check, count(*) filter (where column_name in ('check_in_method','check_out_method')) as ok
from information_schema.columns where table_name = 'attendance'
union all
select 'face tables', count(*) from information_schema.tables
where table_name in ('face_profiles','face_attendance_audit','face_config');
