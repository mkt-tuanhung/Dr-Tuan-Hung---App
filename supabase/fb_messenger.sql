-- ============================================================
-- MESSENGER FANPAGE -> CRM
-- Kéo hội thoại Messenger của các fanpage về, TỰ QUÉT SĐT trong nội dung
-- chat và gán vào Data khách hàng (marketing_data) theo SĐT. Console khách
-- có tab "Messenger" xem realtime.
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================

-- Hội thoại: khoá conv_key = page_id:psid (PSID = id người dùng với page)
create table if not exists fb_conversations (
  conv_key         text primary key,
  page_id          text not null,
  psid             text not null,
  thread_id        text,                    -- id thread t_... (dùng khi kéo lịch sử)
  participant_name text,
  phone            text,                    -- SĐT quét được trong hội thoại
  data_id          uuid references marketing_data(id) on delete set null,
  last_message     text,
  last_time        timestamptz,
  synced_at        timestamptz,
  created_at       timestamptz default now()
);
create index if not exists idx_fbconv_page on fb_conversations(page_id, last_time desc);
create index if not exists idx_fbconv_phone on fb_conversations(phone);
create index if not exists idx_fbconv_data on fb_conversations(data_id);

-- Tin nhắn (mid của Facebook làm khoá -> webhook + sync không trùng)
create table if not exists fb_messages (
  id          text primary key,             -- mid m_...
  conv_key    text not null references fb_conversations(conv_key) on delete cascade,
  page_id     text not null,
  is_page     boolean not null default false, -- true = phía page (nhân viên) nhắn
  from_name   text,
  text        text,
  attachments jsonb,
  created_time timestamptz not null,
  created_at  timestamptz default now()
);
create index if not exists idx_fbmsg_conv on fb_messages(conv_key, created_time);

alter table fb_conversations enable row level security;
alter table fb_messages enable row level security;
drop policy if exists "fbconv_select" on fb_conversations;
drop policy if exists "fbconv_update" on fb_conversations;
drop policy if exists "fbmsg_select" on fb_messages;

-- Xem: các vai trò làm việc với Data khách hàng
create policy "fbconv_select" on fb_conversations for select using (
  public.current_user_role()::text in ('marketing','truc_page','media','telesale','admin','accountant','shareholder','cskh')
);
create policy "fbmsg_select" on fb_messages for select using (
  public.current_user_role()::text in ('marketing','truc_page','media','telesale','admin','accountant','shareholder','cskh')
);
-- Ghép tay hội thoại <-> khách (sửa phone/data_id): marketing/trực page/telesale/admin
create policy "fbconv_update" on fb_conversations for update using (
  public.current_user_role()::text in ('marketing','truc_page','telesale','admin')
) with check (
  public.current_user_role()::text in ('marketing','truc_page','telesale','admin')
);
-- Ghi dữ liệu: chỉ service role (webhook/sync) — không mở policy insert cho client.

-- Realtime: tab Messenger tự hiện tin mới
do $$ begin alter publication supabase_realtime add table fb_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table fb_conversations; exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
