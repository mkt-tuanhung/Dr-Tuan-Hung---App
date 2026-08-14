-- ============================================================
-- BÁO CÁO NGÀY CHIA SẺ ĐƯỢC — telesale bấm "Tạo link + QR" là ra
-- trang /bao-cao/<mã> cho sếp quét QR xem KHÔNG CẦN đăng nhập.
-- Bảo mật: KHÔNG có policy SELECT công khai — người ngoài chỉ đọc được
-- qua hàm get_daily_report khi biết đúng mã (mã ngẫu nhiên 20 ký tự).
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================
create table if not exists daily_reports (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  day date not null,
  title text,
  payload jsonb not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_daily_reports_slug on daily_reports(slug);

alter table daily_reports enable row level security;
drop policy if exists "dr_insert" on daily_reports;
drop policy if exists "dr_select" on daily_reports;
drop policy if exists "dr_delete" on daily_reports;

-- Tạo báo cáo: telesale / marketing / trực page / admin, phải đứng tên mình
create policy "dr_insert" on daily_reports for insert with check (
  created_by = auth.uid()
  and public.current_user_role()::text in ('telesale','marketing','truc_page','admin')
);
-- Xem trong app: người tạo hoặc admin
create policy "dr_select" on daily_reports for select using (
  created_by = auth.uid() or public.current_user_role()::text = 'admin'
);
create policy "dr_delete" on daily_reports for delete using (
  created_by = auth.uid() or public.current_user_role()::text = 'admin'
);

-- Đọc công khai theo mã (cho trang /bao-cao/<mã> — sếp không cần đăng nhập)
create or replace function public.get_daily_report(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('title', title, 'day', day, 'payload', payload, 'created_at', created_at)
  from daily_reports where slug = p_slug limit 1;
$$;
grant execute on function public.get_daily_report(text) to anon, authenticated;

notify pgrst, 'reload schema';
