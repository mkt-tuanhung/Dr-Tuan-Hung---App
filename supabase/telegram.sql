-- ============================================================
-- Telegram push: liên kết tài khoản + đẩy thông báo về điện thoại
-- Chạy trong Supabase SQL Editor.
-- ============================================================

-- Lưu chat_id Telegram của từng nhân sự
alter table profiles add column if not exists telegram_chat_id text;

-- Mã liên kết 1 lần (deep link /start <nonce>)
create table if not exists telegram_links (
  nonce text primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);
alter table telegram_links enable row level security;
drop policy if exists "tl_insert" on telegram_links;
create policy "tl_insert" on telegram_links for insert with check (user_id = auth.uid());
-- (Edge Function đọc/xóa qua service role, bỏ qua RLS)
