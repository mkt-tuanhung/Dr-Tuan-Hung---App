-- ============================================================
-- Web Push: lưu subscription của từng máy + tự gửi khi có thông báo mới.
-- Chạy trong Supabase SQL Editor.
--
-- TRƯỚC KHI CHẠY phần trigger ở cuối, cần đặt các secret cho edge function
-- push-web (Project Settings -> Edge Functions -> Secrets, hoặc CLI):
--   VAPID_PUBLIC_KEY  = BONeGkhgR3fx-OIJdbvi8SF0RBtM_lbMFwe1tHL6AxQzopqRLbTZ5vXdQYT9-wcTrs4r-NDlaZAUqnYldfeCm-E
--   VAPID_PRIVATE_KEY = (khoá bí mật — xem hướng dẫn, KHÔNG commit vào code)
--   VAPID_SUBJECT     = mailto:admin@drhung.app   (tuỳ chọn)
-- Và deploy function: supabase functions deploy push-web
-- ============================================================

create table if not exists push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists idx_push_sub_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;
drop policy if exists "push_sub_select" on push_subscriptions;
drop policy if exists "push_sub_insert" on push_subscriptions;
drop policy if exists "push_sub_update" on push_subscriptions;
drop policy if exists "push_sub_delete" on push_subscriptions;
create policy "push_sub_select" on push_subscriptions for select using (user_id = auth.uid());
create policy "push_sub_insert" on push_subscriptions for insert with check (user_id = auth.uid());
create policy "push_sub_update" on push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_sub_delete" on push_subscriptions for delete using (user_id = auth.uid());

-- ============================================================
-- Trigger: mỗi khi INSERT vào notifications -> gọi edge function push-web
-- để đẩy thông báo về máy. Dùng pg_net (không chặn transaction).
--
-- THAY <PROJECT_REF> và <ANON_KEY> (và <WEBHOOK_SECRET> nếu có bật) bên dưới.
--   <PROJECT_REF>: vd https://wlblywjdghjwwuumzecc.supabase.co -> wlblywjdghjwwuumzecc
-- ============================================================
create extension if not exists pg_net;

create or replace function notify_push_web() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-web',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-webhook-secret', '<WEBHOOK_SECRET>'   -- bỏ dòng này nếu không đặt WEBHOOK_SECRET
    ),
    body    := to_jsonb(NEW)
  );
  return NEW;
end $$;

drop trigger if exists trg_notify_push_web on notifications;
create trigger trg_notify_push_web after insert on notifications
  for each row execute function notify_push_web();
