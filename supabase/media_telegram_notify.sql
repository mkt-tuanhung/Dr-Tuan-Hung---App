-- ============================================================
-- BÁO VỀ NHÓM TELEGRAM "MEDIA" — chạy 1 lần trong Supabase SQL Editor (chạy lại vẫn an toàn)
--
-- Báo khi:
--   1) Marketing Workspace có thay đổi: order (thẻ) mới, chuyển cột, giao việc, bình luận / @nhắc tên,
--      checklist, tệp, gửi duyệt / duyệt, xuất bản, chat workspace… (workspace có thể tắt riêng trong
--      "Thành viên & cấu hình")
--   2) Editor up clip mới (media_clips thêm mới)
--   3) Media thêm source mới / file mới vào Kho Media (media_customers, media_assets thêm mới)
--   4) MỌI thay đổi trạng thái clip: Ads duyệt / cần sửa / hoàn tất, duyệt chạy, Đang chạy / Tạm dừng Ads,
--      trạng thái Facebook, đăng bài, Win, chấm điểm
--   5) MỌI thay đổi trạng thái source Kho Media (Chưa dựng → Đang dựng → Đã dựng, Lỗi, Cần bổ sung)
--   6) Đổi trạng thái nội dung trong Content Studio (Ý tưởng → Kịch bản → … → Đã đăng)
-- Mỗi tin có nút "Xem chi tiết" mở app đúng thẻ / clip / source.
--
-- Cách chạy: trigger chỉ ghi vào hàng đợi media_tg_outbox (không gọi mạng trong giao dịch -> không làm chậm app);
-- lịch cron 'media-tg-1min' gọi Edge Function media-telegram MỖI PHÚT, CHỈ khi hàng đợi có tin -> gom tin
-- cùng thẻ / cùng source trong 1 phút thành 1 tin Telegram.
--
-- Cần: deploy Edge Function media-telegram (Verify JWT = ON); secret TELEGRAM_BOT_TOKEN (đã có);
--      bot của app phải được thêm vào nhóm Media. Nhóm: clinic_settings.media_tg_chat_id.
-- ============================================================

-- ---------- Cấu hình ----------
alter table public.clinic_settings add column if not exists media_tg_chat_id text;
alter table public.clinic_settings add column if not exists media_tg_enabled boolean not null default true;
insert into public.clinic_settings (id) values (true) on conflict (id) do nothing;
update public.clinic_settings set media_tg_chat_id = '-5363639582' where media_tg_chat_id is null or media_tg_chat_id = '';

do $$ begin
  if to_regclass('public.mw_workspaces') is not null then
    alter table public.mw_workspaces add column if not exists tg_media boolean not null default true;
  end if;
end $$;

-- ---------- Hàng đợi ----------
create table if not exists public.media_tg_outbox (
  id          bigserial primary key,
  kind        text not null,       -- mw | mw_chat | clip_new | clip_approved | clip_running | kho_source | kho_file
  group_key   text,                -- gom tin trong 1 lượt gửi (thẻ / source / clip)
  dedupe_key  text unique,         -- chống báo trùng (clip lên Ads chỉ báo 1 lần)
  actor_id    uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  tries       int not null default 0,
  last_error  text
);
create index if not exists media_tg_outbox_pending_idx on public.media_tg_outbox (id) where sent_at is null;
alter table public.media_tg_outbox enable row level security;   -- không có policy: chỉ service role đọc / ghi
revoke all on public.media_tg_outbox from anon, authenticated;

create or replace function public.media_tg_enqueue(p_kind text, p_group text, p_actor uuid, p_payload jsonb, p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Không bao giờ làm hỏng lệnh gốc vì thông báo
  begin
    if not coalesce((select media_tg_enabled from clinic_settings limit 1), true) then return; end if;
    insert into media_tg_outbox (kind, group_key, actor_id, payload, dedupe_key)
    values (p_kind, p_group, p_actor, coalesce(p_payload, '{}'::jsonb), p_dedupe)
    on conflict (dedupe_key) do nothing;
  exception when others then
    raise warning 'media_tg_enqueue: %', sqlerrm;
  end;
end $$;
revoke all on function public.media_tg_enqueue(text, text, uuid, jsonb, text) from public, anon, authenticated;

-- Edge Function nhận việc (khoá theo lượt để 2 lượt chạy chồng không gửi trùng)
create or replace function public.media_tg_claim(p_limit int default 200)
returns setof public.media_tg_outbox language sql security definer set search_path = public as $$
  update media_tg_outbox o set claimed_at = now(), tries = o.tries + 1
  where o.id in (
    select id from media_tg_outbox
    where sent_at is null and tries < 5 and (claimed_at is null or claimed_at < now() - interval '5 minutes')
    order by id limit greatest(1, least(p_limit, 500))
    for update skip locked)
  returning o.*;
$$;
revoke all on function public.media_tg_claim(int) from public, anon, authenticated;
grant execute on function public.media_tg_claim(int) to service_role;

-- ---------- 1) Marketing Workspace: mọi dòng nhật ký hoạt động ----------
do $$ begin
  if to_regclass('public.mw_activity') is null then
    raise notice 'Chưa cài Marketing Workspace — bỏ qua phần workspace';
    return;
  end if;
  execute $f$
    create or replace function public.mw_activity_tg() returns trigger language plpgsql security definer set search_path = public as $b$
    begin
      if coalesce((select tg_media from mw_workspaces where id = NEW.workspace_id), false) then
        perform public.media_tg_enqueue('mw', coalesce('task:' || NEW.task_id, 'ws:' || NEW.workspace_id || ':' || NEW.entity), NEW.actor_id,
          jsonb_build_object('activity_id', NEW.id, 'workspace_id', NEW.workspace_id, 'task_id', NEW.task_id, 'entity', NEW.entity,
            'entity_id', NEW.entity_id, 'action', NEW.action, 'detail', NEW.detail,
            'auto', coalesce(current_setting('mw.auto', true), '') = 'on'));   -- do luật Automation làm
      end if;
      return null;
    end $b$;
  $f$;
  drop trigger if exists mw_activity_tg on public.mw_activity;
  create trigger mw_activity_tg after insert on public.mw_activity for each row execute function public.mw_activity_tg();
end $$;

do $$ begin
  if to_regclass('public.mw_messages') is null then
    raise notice 'Chưa chạy marketing_workspace_v3_collab.sql — bỏ qua chat workspace';
    return;
  end if;
  execute $f$
    create or replace function public.mw_message_tg() returns trigger language plpgsql security definer set search_path = public as $b$
    begin
      if NEW.deleted_at is null and coalesce((select tg_media from mw_workspaces where id = NEW.workspace_id), false) then
        perform public.media_tg_enqueue('mw_chat', 'chat:' || NEW.workspace_id, NEW.author_id,
          jsonb_build_object('message_id', NEW.id, 'workspace_id', NEW.workspace_id, 'body', left(NEW.body, 800)));
      end if;
      return null;
    end $b$;
  $f$;
  drop trigger if exists mw_message_tg on public.mw_messages;
  create trigger mw_message_tg after insert on public.mw_messages for each row execute function public.mw_message_tg();
end $$;

-- Content Studio: đổi trạng thái nội dung (gom theo thẻ nếu nội dung tạo từ thẻ)
do $$ begin
  if to_regclass('public.mw_contents') is null then return; end if;
  execute $f$
    create or replace function public.mw_content_tg() returns trigger language plpgsql security definer set search_path = public as $b$
    begin
      if NEW.workflow_status is distinct from OLD.workflow_status
         and coalesce((select tg_media from mw_workspaces where id = NEW.workspace_id), false) then
        perform public.media_tg_enqueue('mw', coalesce('task:' || NEW.task_id, 'content:' || NEW.id), auth.uid(),
          jsonb_build_object('workspace_id', NEW.workspace_id, 'task_id', NEW.task_id, 'entity', 'content', 'entity_id', NEW.id, 'action', 'status',
            'detail', jsonb_build_object('content_id', NEW.id, 'title', NEW.title, 'from', OLD.workflow_status, 'to', NEW.workflow_status)));
      end if;
      return null;
    end $b$;
  $f$;
  drop trigger if exists mw_content_tg on public.mw_contents;
  create trigger mw_content_tg after update of workflow_status on public.mw_contents for each row execute function public.mw_content_tg();
end $$;

-- ---------- 2) + 4) Clip: up mới / MỌI thay đổi trạng thái ----------
create or replace function public.media_clip_tg() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb; o jsonb; f text;
begin
  if TG_OP = 'INSERT' then
    perform public.media_tg_enqueue('clip_new', 'clip:' || NEW.id, coalesce(auth.uid(), NEW.editor_id), jsonb_build_object('clip_id', NEW.id));
    return null;
  end if;
  j := to_jsonb(NEW); o := to_jsonb(OLD);
  -- Cột nào không có trên DB thì bỏ qua (to_jsonb không có khoá đó)
  foreach f in array array['stage', 'approved_to_run', 'ad_status', 'fb_status', 'ads_auto_status', 'post_status', 'result_status', 'win', 'score'] loop
    if j ? f and (j -> f) is distinct from (o -> f) then
      perform public.media_tg_enqueue('clip_status', 'clip:' || NEW.id, auth.uid(),
        jsonb_build_object('clip_id', NEW.id, 'field', f, 'from', o -> f, 'to', j -> f));
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists media_clip_tg on public.media_clips;
create trigger media_clip_tg after insert or update on public.media_clips for each row execute function public.media_clip_tg();

-- ---------- 3) Kho Media: source mới + file mới ----------
create or replace function public.media_tg_nlinks(p jsonb) returns int language sql immutable as $$
  select case when jsonb_typeof(p) = 'array' then jsonb_array_length(p) else 0 end;
$$;
-- Chỉ báo khi có LINK SOURCE (thẻ Editor tự tạo lúc up clip không có source -> không báo); thêm link sau cũng báo, 1 lần / source
create or replace function public.media_source_tg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.media_tg_nlinks(NEW.source_links) > 0 and (TG_OP = 'INSERT' or public.media_tg_nlinks(OLD.source_links) = 0) then
    perform public.media_tg_enqueue('kho_source', 'src:' || NEW.id, coalesce(auth.uid(), NEW.media_id), jsonb_build_object('source_id', NEW.id), 'kho_source:' || NEW.id);
  end if;
  -- Đổi trạng thái source (Chưa dựng / Đang dựng / Đã dựng / Lỗi / Cần bổ sung)
  if TG_OP = 'UPDATE' and (to_jsonb(NEW) -> 'source_status') is distinct from (to_jsonb(OLD) -> 'source_status') then
    perform public.media_tg_enqueue('kho_status', 'src:' || NEW.id, auth.uid(),
      jsonb_build_object('source_id', NEW.id, 'from', to_jsonb(OLD) ->> 'source_status', 'to', to_jsonb(NEW) ->> 'source_status'));
  end if;
  return null;
end $$;
drop trigger if exists media_source_tg on public.media_customers;
create trigger media_source_tg after insert or update on public.media_customers for each row execute function public.media_source_tg();

do $$ begin
  if to_regclass('public.media_assets') is null then return; end if;
  execute $f$
    create or replace function public.media_asset_tg() returns trigger language plpgsql security definer set search_path = public as $b$
    begin
      perform public.media_tg_enqueue('kho_file', 'src:' || coalesce(NEW.media_customer_id::text, 'none'), auth.uid(),
        jsonb_build_object('asset_id', NEW.id, 'source_id', NEW.media_customer_id, 'name', left(NEW.name, 200), 'kind', NEW.kind));
      return null;
    end $b$;
  $f$;
  drop trigger if exists media_asset_tg on public.media_assets;
  create trigger media_asset_tg after insert on public.media_assets for each row execute function public.media_asset_tg();
end $$;

-- ---------- Lịch gửi mỗi phút (chỉ gọi hàm khi có tin chờ) ----------
-- Chép cấu hình gọi hàm (URL + key) từ lịch 'getfly-sync-10min' -> không cần dán key.
do $$
declare cmd text;
begin
  if to_regclass('cron.job') is null then
    raise notice 'Chưa bật pg_cron — bỏ qua tạo lịch';
    return;
  end if;
  select command into cmd from cron.job where jobname = 'getfly-sync-10min';
  if cmd is null then
    raise notice 'Chưa có lịch getfly-sync-10min để chép cấu hình — tạo lịch media-tg-1min thủ công';
    return;
  end if;
  cmd := replace(cmd, '/functions/v1/getfly-sync', '/functions/v1/media-telegram');
  cmd := replace(cmd, '''{}''::jsonb', '''{}''::jsonb, timeout_milliseconds := 60000');
  cmd := regexp_replace(cmd, ';\s*$', '') || $w$
  where exists (select 1 from public.media_tg_outbox where sent_at is null and tries < 5);$w$;
  perform cron.unschedule(jobid) from cron.job where jobname = 'media-tg-1min';
  perform cron.schedule('media-tg-1min', '* * * * *', cmd);
end $$;

-- Dọn tin đã gửi cũ hơn 30 ngày (mỗi đêm 3h VN)
do $$ begin
  if to_regclass('cron.job') is null then return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'media-tg-cleanup';
  perform cron.schedule('media-tg-cleanup', '0 20 * * *', $c$delete from public.media_tg_outbox where created_at < now() - interval '30 days'$c$);
end $$;

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select jobname, schedule, active from cron.job where jobname like 'media-tg%';
--   select id, kind, created_at, sent_at, tries, last_error from public.media_tg_outbox order by id desc limit 20;
-- Đổi nhóm:   update public.clinic_settings set media_tg_chat_id = '-100...';
-- Tắt hẳn:    update public.clinic_settings set media_tg_enabled = false;
