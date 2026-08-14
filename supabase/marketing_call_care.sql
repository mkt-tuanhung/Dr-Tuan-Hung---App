-- ============================================================
-- DATA KHÁCH HÀNG nâng cấp thành màn hình LÀM VIỆC CỦA TELESALE:
-- gọi khách, cập nhật thông tin, ghi NHẬT KÝ GỌI + NHẬT KÝ CHĂM SÓC.
--
-- 1) Cho TELESALE được sửa data khách (trước chỉ marketing/trực page/admin).
-- 2) Thêm cột nhắc lịch: lần liên hệ tiếp theo & lần liên hệ gần nhất.
-- 3) Bảng marketing_activities: mỗi dòng là 1 cuộc gọi hoặc 1 lần chăm sóc.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

-- 1) + 2) marketing_data: mở quyền ghi cho telesale + cột nhắc lịch
alter table marketing_data
  add column if not exists next_call_at   timestamptz,   -- hẹn gọi lại / liên hệ tiếp
  add column if not exists last_contact_at timestamptz;  -- lần liên hệ gần nhất

drop policy if exists "md_write" on marketing_data;
create policy "md_write" on marketing_data for all using (
  public.current_user_role()::text in ('marketing','truc_page','telesale','admin')
) with check (
  public.current_user_role()::text in ('marketing','truc_page','telesale','admin')
);

-- 3) Nhật ký gọi + chăm sóc
create table if not exists marketing_activities (
  id uuid default uuid_generate_v4() primary key,
  data_id uuid references marketing_data(id) on delete cascade,
  phone text,
  type text not null default 'call',   -- 'call' = nhật ký gọi | 'care' = nhật ký chăm sóc
  outcome text,                        -- kết quả gọi (chỉ với type='call')
  content text,                        -- nội dung / ghi chú
  next_at timestamptz,                 -- hẹn liên hệ tiếp (nếu có)
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_mkt_act_data on marketing_activities(data_id, created_at desc);
create index if not exists idx_mkt_act_phone on marketing_activities(phone);
create index if not exists idx_mkt_act_creator on marketing_activities(created_by, created_at desc);

alter table marketing_activities enable row level security;
drop policy if exists "mact_select" on marketing_activities;
drop policy if exists "mact_insert" on marketing_activities;
drop policy if exists "mact_update" on marketing_activities;
drop policy if exists "mact_delete" on marketing_activities;

-- Xem: như quyền xem data khách
create policy "mact_select" on marketing_activities for select using (
  public.current_user_role()::text in ('marketing','truc_page','media','telesale','admin','accountant','shareholder')
);
-- Ghi nhật ký: marketing/trực page/telesale/admin — bắt buộc created_by là chính mình
create policy "mact_insert" on marketing_activities for insert with check (
  created_by = auth.uid()
  and public.current_user_role()::text in ('marketing','truc_page','telesale','admin')
);
-- Sửa/xoá: chỉ người tạo hoặc admin
create policy "mact_update" on marketing_activities for update using (
  created_by = auth.uid() or public.current_user_role()::text = 'admin'
) with check (
  created_by = auth.uid() or public.current_user_role()::text = 'admin'
);
create policy "mact_delete" on marketing_activities for delete using (
  created_by = auth.uid() or public.current_user_role()::text = 'admin'
);

do $$ begin alter publication supabase_realtime add table marketing_activities; exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
