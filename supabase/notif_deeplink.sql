-- ============================================================
-- THÔNG BÁO TRỎ ĐÚNG ITEM (deep-link focus)
--
-- Trước đây bấm thông báo chỉ mở đúng lắm là cả module, hoặc mở nhầm tab cũ
-- ('content' không còn tồn tại -> "đang xây dựng"). File này làm 2 việc:
--   1) Ghi link kèm ID để app cuộn & làm nổi bật ĐÚNG item:
--        - Lịch hẹn:  link = 'appointments#<id lịch hẹn>'
--        - Clip Ads:  link = 'content_video#<id clip>'
--   2) Backfill link cũ 'content' -> 'content_video' cho thông báo đã có.
--
-- (Phía web đã tự chuẩn hoá phần tab; ID chỉ dùng để focus nên chạy file này
--  để có thêm tính năng "nhảy đúng lịch hẹn/clip".)
-- Chạy trong Supabase SQL Editor.
-- ============================================================

-- 1) Thêm lịch hẹn -> báo kèm ID để focus đúng lịch hẹn
create or replace function notify_new_appointment() returns trigger language plpgsql security definer set search_path = public as $$
declare aname text; lbl text; lnk text;
begin
  if NEW.status in ('scheduled', 'coc') then
    select full_name into aname from profiles where id = NEW.created_by;
    if NEW.status = 'coc' then lbl := 'thêm khách cọc'; lnk := null;
    else lbl := 'thêm lịch hẹn'; lnk := 'appointments#' || NEW.id; end if;
    perform notify_relevant(
      NEW.created_by, 'new_appointment',
      coalesce(aname, 'Nhân sự') || ' đã ' || lbl || ': ' || coalesce(NEW.customer_name, ''),
      coalesce(NEW.service, ''), lnk,
      array['sale_offline', 'telesale', 'cskh']);
  end if;
  return NEW;
end $$;

-- 2) Editor đẩy clip mới -> báo marketing, focus đúng clip
create or replace function notify_clip_submitted() returns trigger language plpgsql security definer set search_path = public as $$
declare cname text;
begin
  select customer_name into cname from media_customers where id = NEW.media_customer_id;
  update media_customers set source_status = 'dang_dung'
    where id = NEW.media_customer_id and coalesce(source_status, 'chua_dung') = 'chua_dung';
  perform notify_relevant(NEW.editor_id, 'clip_submitted',
    'Editor đã đẩy clip mới cần duyệt: ' || coalesce(cname, ''), '', 'content_video#' || NEW.id, array['marketing']);
  return NEW;
end $$;

-- 3) Ads chấm/duyệt clip -> báo editor (điểm) + media + admin, focus đúng clip
create or replace function notify_clip_update() returns trigger language plpgsql security definer set search_path = public as $$
declare cname text; mid uuid; pts int; lvl text; lnk text;
begin
  select customer_name, media_id into cname, mid from media_customers where id = NEW.media_customer_id;
  lnk := 'content_video#' || NEW.id;

  if NEW.stage = 'submitted' and OLD.stage is distinct from 'submitted' then
    perform notify_relevant(NEW.editor_id, 'clip_submitted',
      'Editor nộp lại clip: ' || coalesce(cname, ''), '', lnk, array['marketing']);
  end if;

  -- Ads đánh giá / chấm điểm
  if (NEW.evaluated_at is distinct from OLD.evaluated_at and NEW.evaluated_at is not null)
     or (NEW.ads_feedback is distinct from OLD.ads_feedback and coalesce(NEW.ads_feedback,'') <> '')
     or (NEW.score is distinct from OLD.score)
     or (NEW.stage in ('approved','revision') and NEW.stage is distinct from OLD.stage) then
    pts := case when NEW.win then 10 else coalesce(NEW.score, 0) end;
    lvl := case when NEW.win or pts >= 10 then 'WIN' when pts >= 8 then 'Tốt' when pts >= 5 then 'Trung bình' when pts > 0 then 'Tệ' else 'Chưa chấm' end;
    if NEW.editor_id is not null then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (NEW.editor_id, NEW.ads_id, 'clip_scored',
        'Ads chấm clip: ' || pts || '/10 · ' || lvl || coalesce(' — ' || NEW.title, ''),
        coalesce(NEW.ads_feedback, NEW.result_note, ''), lnk);
    end if;
    if mid is not null and mid is distinct from NEW.editor_id then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (mid, NEW.ads_id, 'clip_reviewed', 'Ads đã đánh giá clip: ' || coalesce(cname, ''), coalesce(NEW.ads_feedback, NEW.result_note, ''), lnk);
    end if;
    insert into notifications(user_id, actor_id, type, title, body, link)
    select p.id, NEW.ads_id, 'clip_reviewed', 'Ads đánh giá clip: ' || coalesce(cname, '') || ' (' || pts || '/10)', coalesce(NEW.ads_feedback, NEW.result_note, ''), lnk
    from profiles p where p.role::text = 'admin' and p.id is distinct from NEW.ads_id and p.id is distinct from mid and p.id is distinct from NEW.editor_id;
  end if;

  -- Duyệt chạy Ads -> source Đã dựng + thưởng editor 500k
  if NEW.approved_to_run is true and OLD.approved_to_run is distinct from true then
    update media_customers set source_status = 'da_dung' where id = NEW.media_customer_id;
    if NEW.editor_id is not null then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (NEW.editor_id, NEW.ads_id, 'clip_approved',
        'Video của bạn đã được duyệt chạy Ads',
        coalesce(NEW.title, '') || ' — thưởng 500.000đ', lnk);
    end if;
  end if;
  return NEW;
end $$;

-- 4) Backfill link cũ cho thông báo clip đã có (chỉ sửa được phần tab)
update notifications set link = 'content_video'
where link = 'content'
  and type in ('clip_scored', 'clip_reviewed', 'clip_submitted', 'clip_approved');
