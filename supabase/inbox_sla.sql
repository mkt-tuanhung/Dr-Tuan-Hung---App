-- ============================================================
-- CẢNH BÁO INBOX CHẬM PHẢN HỒI -> nhóm Telegram trực page — chạy 1 lần trong SQL Editor (chạy lại vẫn an toàn)
--
-- Chỉ dựa trên tin nhắn MỚI do fb-inbox-poll (mỗi phút) / webhook fb-messenger-webhook ghi vào
-- fb_messages (không cần kéo toàn bộ hộp thư):
--   khách nhắn  -> fb_conversations.sla_waiting_since = lúc khách nhắn đầu tiên chưa được trả lời
--   page trả lời -> xoá sla_waiting_since (nếu đã cảnh báo thì chờ báo "✅ đã phản hồi sau X phút")
-- Tin cũ hơn 6 giờ (kéo bù lịch sử) KHÔNG tính -> không cảnh báo tràn.
--
-- Edge Function inbox-sla-alert (cron mỗi phút) áp khung giờ trực, gửi Telegram.
-- Cron chỉ gọi hàm khi THẬT SỰ có khách đang chờ trong giờ trực (điều kiện ngay trong SQL)
-- -> lúc không có tin thì không tốn lượt gọi nào.
--
-- Nhóm Telegram: clinic_settings.inbox_alert_chat_id (bot của app phải ở trong nhóm).
-- Lịch cron CHÉP cấu hình gọi hàm (URL + key) từ lịch 'getfly-sync-10min' -> không cần dán key.
-- ============================================================

-- ---------- Trạng thái chờ trên từng hội thoại ----------
alter table public.fb_conversations add column if not exists last_customer_at timestamptz;
alter table public.fb_conversations add column if not exists last_page_at timestamptz;
alter table public.fb_conversations add column if not exists sla_waiting_since timestamptz;   -- null = không ai chờ
alter table public.fb_conversations add column if not exists sla_level smallint not null default 0; -- 1 = đã báo 3', 2 = 10', 3 = 30'
alter table public.fb_conversations add column if not exists sla_soft_key text;              -- đã nhắc nhẹ trong khung nghỉ nào (vd 2026-10-12:lunch)
alter table public.fb_conversations add column if not exists sla_replied_at timestamptz;     -- đã trả lời sau khi bị nhắc -> chờ báo ✅
alter table public.fb_conversations add column if not exists sla_reply_minutes int;
create index if not exists idx_fbconv_sla_waiting on public.fb_conversations (sla_waiting_since) where sla_waiting_since is not null;
create index if not exists idx_fbconv_sla_replied on public.fb_conversations (sla_replied_at) where sla_replied_at is not null;

create or replace function public.fb_inbox_sla_track()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_time < now() - interval '6 hours' then return null; end if;   -- tin cũ kéo bù: bỏ qua
  if new.is_page then
    update fb_conversations c set
      last_page_at = greatest(coalesce(c.last_page_at, new.created_time), new.created_time),
      sla_replied_at = case when c.sla_waiting_since is not null and new.created_time >= c.sla_waiting_since
                              and (c.sla_level > 0 or c.sla_soft_key is not null) then new.created_time else c.sla_replied_at end,
      sla_reply_minutes = case when c.sla_waiting_since is not null and new.created_time >= c.sla_waiting_since
                                 and (c.sla_level > 0 or c.sla_soft_key is not null)
                               then ceil(extract(epoch from new.created_time - c.sla_waiting_since) / 60)::int else c.sla_reply_minutes end,
      sla_level = case when c.sla_waiting_since is not null and new.created_time >= c.sla_waiting_since then 0 else c.sla_level end,
      sla_soft_key = case when c.sla_waiting_since is not null and new.created_time >= c.sla_waiting_since then null else c.sla_soft_key end,
      sla_waiting_since = case when c.sla_waiting_since is not null and new.created_time >= c.sla_waiting_since then null else c.sla_waiting_since end
    where c.conv_key = new.conv_key;
  else
    update fb_conversations c set
      last_customer_at = greatest(coalesce(c.last_customer_at, new.created_time), new.created_time),
      sla_waiting_since = case when c.sla_waiting_since is null and (c.last_page_at is null or new.created_time > c.last_page_at)
                               then new.created_time else c.sla_waiting_since end
    where c.conv_key = new.conv_key;
  end if;
  return null;
end $$;

drop trigger if exists fb_messages_inbox_sla on public.fb_messages;
create trigger fb_messages_inbox_sla after insert on public.fb_messages
  for each row execute function public.fb_inbox_sla_track();

-- ---------- Nhóm Telegram nhận cảnh báo ----------
do $$ begin
  if to_regclass('public.clinic_settings') is not null then
    alter table public.clinic_settings add column if not exists inbox_alert_chat_id text;
    alter table public.clinic_settings add column if not exists inbox_alert_enabled boolean not null default true;
  end if;
end $$;

-- ---------- Lịch kiểm tra mỗi phút ----------
do $$
declare cmd text;
begin
  if to_regclass('cron.job') is null then
    raise notice 'Chưa bật pg_cron — bỏ qua tạo lịch';
    return;
  end if;
  select command into cmd from cron.job where jobname = 'getfly-sync-10min';
  if cmd is null then
    raise notice 'Chưa có lịch getfly-sync-10min để chép cấu hình — tạo lịch inbox-sla-1min thủ công';
    return;
  end if;
  cmd := replace(cmd, '/functions/v1/getfly-sync', '/functions/v1/inbox-sla-alert');
  cmd := replace(cmd, '''{}''::jsonb', '''{}''::jsonb, timeout_milliseconds := 30000');
  -- Chỉ gọi khi có khách đang chờ trong 9:00–23:00 giờ VN, hoặc có hội thoại chờ báo ✅
  cmd := regexp_replace(cmd, ';\s*$', '') || $w$
  where exists (
    select 1 from public.fb_conversations
    where (sla_waiting_since > now() - interval '24 hours'
           and (now() at time zone 'Asia/Ho_Chi_Minh')::time >= '09:00' and (now() at time zone 'Asia/Ho_Chi_Minh')::time < '23:00')
       or sla_replied_at is not null);$w$;
  perform cron.unschedule(jobid) from cron.job where jobname = 'inbox-sla-1min';
  perform cron.schedule('inbox-sla-1min', '* * * * *', cmd);
end $$;

-- ---------- Hỏi Facebook mỗi phút (fb-inbox-poll) ----------
-- App chưa qua Xét duyệt của Meta thì webhook chỉ nhận tin của người có vai trò trong app
-- -> đọc hộp thư bằng token từng page. Mỗi page 1 lần gọi / phút, chỉ ghi khi có tin mới.
do $$
declare cmd text;
begin
  if to_regclass('cron.job') is null then return; end if;
  select command into cmd from cron.job where jobname = 'getfly-sync-10min';
  if cmd is null then
    raise notice 'Chưa có lịch getfly-sync-10min để chép cấu hình — tạo lịch fb-inbox-poll-1min thủ công';
    return;
  end if;
  cmd := replace(cmd, '/functions/v1/getfly-sync', '/functions/v1/fb-inbox-poll');
  cmd := replace(cmd, '''{}''::jsonb', '''{}''::jsonb, timeout_milliseconds := 30000');
  perform cron.unschedule(jobid) from cron.job where jobname = 'fb-inbox-poll-1min';
  perform cron.schedule('fb-inbox-poll-1min', '* * * * *', cmd);
end $$;

-- Kiểm tra:
--   select jobname, schedule, active from cron.job where jobname in ('inbox-sla-1min', 'fb-inbox-poll-1min');
--   select participant_name, sla_waiting_since, sla_level from public.fb_conversations where sla_waiting_since is not null;
