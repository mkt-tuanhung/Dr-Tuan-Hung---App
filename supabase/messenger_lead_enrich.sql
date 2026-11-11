-- ============================================================
-- KHÁCH TỰ TẠO TỪ MESSENGER: bổ sung thông tin từ hội thoại (thay vì chỉ "Tự tạo từ hội thoại Messenger").
-- Khi fb_conversations được gắn data_id (đã quét được SĐT) -> trigger:
--   • customer_name  = tên Facebook (nếu trống)
--   • description    = các câu KHÁCH nhắn đầu tiên (nhu cầu)
--   • reached_info   = tóm tắt hội thoại: bắt đầu lúc, khách nhắn gì, page trả lời gì
--   • ghi 1 nhật ký "Tóm tắt hội thoại Messenger" -> nhóm Telegram DATA KHÁCH HÀNG nhận NOTE MỚI
-- Chỉ áp cho khách nguồn Messenger do hệ thống tự tạo (không đụng khách đã có thông tin). Idempotent.
-- ============================================================
create or replace function public.messenger_conv_summary(p_conv text) returns jsonb
language sql stable security definer set search_path = public as $$
  with m as (
    select is_page, coalesce(nullif(trim(text), ''), case when attachments is not null then '[ảnh/tệp]' end) t, created_time
    from fb_messages where conv_key = p_conv
  )
  select jsonb_build_object(
    'first', (select min(created_time) from m),
    'cust_first', (select string_agg(t, ' | ' order by created_time) from (select t, created_time from m where not is_page and t is not null order by created_time limit 4) a),
    'cust_last', (select string_agg(t, ' | ' order by created_time) from (select t, created_time from m where not is_page and t is not null order by created_time desc limit 8) b),
    'page_last', (select string_agg(t, ' | ' order by created_time) from (select t, created_time from m where is_page and t is not null order by created_time desc limit 4) c),
    'n', (select count(*) from m)
  );
$$;

create or replace function public.enrich_messenger_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s jsonb; k record; summary text; t0 text;
begin
  if new.data_id is null or (tg_op = 'UPDATE' and old.data_id is not distinct from new.data_id) then return new; end if;
  select id, phone, customer_name, description, reached_info, source into k from marketing_data where id = new.data_id;
  if k.id is null or coalesce(k.source, '') <> 'Messenger' then return new; end if;
  if coalesce(k.description, '') not in ('', 'Tự tạo từ hội thoại Messenger') then return new; end if;  -- đã có người điền

  s := public.messenger_conv_summary(new.conv_key);
  t0 := to_char((s->>'first')::timestamptz at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY');
  summary := 'Hội thoại Messenger' || coalesce(' với ' || new.participant_name, '')
    || coalesce(' · bắt đầu ' || t0, '') || coalesce(' · ' || (s->>'n') || ' tin', '')
    || coalesce(E'\nKhách nhắn: ' || left(s->>'cust_last', 900), '')
    || coalesce(E'\nPage trả lời: ' || left(s->>'page_last', 600), '');

  update marketing_data set
    customer_name = coalesce(nullif(trim(customer_name), ''), new.participant_name),
    description   = coalesce(left(s->>'cust_first', 400), description),
    reached_info  = case when coalesce(reached_info, '') = '' then summary else reached_info end
  where id = k.id;

  insert into marketing_activities (data_id, phone, type, content)
  values (k.id, k.phone, 'care', '💬 Tóm tắt hội thoại Messenger (hệ thống tự tạo khách)' || E'\n' || summary);
  return new;
exception when others then
  return new;   -- không chặn việc gắn hội thoại
end $$;

drop trigger if exists trg_enrich_messenger_lead on public.fb_conversations;
create trigger trg_enrich_messenger_lead after insert or update of data_id on public.fb_conversations
  for each row execute function public.enrich_messenger_lead();
