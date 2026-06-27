-- ============================================================
-- MODULE DATA KHÁCH HÀNG (lead marketing chạy quảng cáo)
-- Hợp nhất theo SỐ ĐIỆN THOẠI; liên kết động với customer_appointments.
-- ============================================================
create table if not exists marketing_data (
  id uuid default uuid_generate_v4() primary key,
  customer_name text,
  phone text not null,
  truc_page_id uuid references profiles(id) on delete set null,  -- trực page phụ trách
  description text,                                              -- mô tả
  status text default 'tiep_can',                               -- trạng thái lead
  last_exchange text,                                            -- trao đổi gần nhất
  reached_info text,                                            -- thông tin đã tiếp cận
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(phone)
);
create index if not exists idx_marketing_data_phone on marketing_data(phone);
create index if not exists idx_marketing_data_status on marketing_data(status);
create index if not exists idx_marketing_data_trucpage on marketing_data(truc_page_id);

drop trigger if exists trg_marketing_data_updated on marketing_data;
create trigger trg_marketing_data_updated before update on marketing_data for each row execute function update_updated_at();

alter table marketing_data enable row level security;
drop policy if exists "md_select" on marketing_data;
drop policy if exists "md_write" on marketing_data;
drop policy if exists "md_delete" on marketing_data;

-- Xem: marketing, trực page, media, telesale + quản lý
create policy "md_select" on marketing_data for select using (
  public.current_user_role()::text in ('marketing','truc_page','media','telesale','admin','accountant','shareholder')
);
-- Thêm/sửa: marketing, trực page, admin
create policy "md_write" on marketing_data for all using (
  public.current_user_role()::text in ('marketing','truc_page','admin')
) with check (
  public.current_user_role()::text in ('marketing','truc_page','admin')
);
create policy "md_delete" on marketing_data for delete using (
  created_by = auth.uid() or public.current_user_role()::text in ('marketing','truc_page','admin')
);

do $$ begin alter publication supabase_realtime add table marketing_data; exception when duplicate_object then null; end $$;
