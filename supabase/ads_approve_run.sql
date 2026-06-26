-- Duyệt chạy Ads + tự cập nhật trạng thái source
alter table media_clips add column if not exists approved_to_run boolean default false;

-- Editor đẩy clip -> source "Đang dựng" + báo marketing
create or replace function notify_clip_submitted() returns trigger language plpgsql security definer set search_path = public as $$
declare cname text;
begin
  select customer_name into cname from media_customers where id = NEW.media_customer_id;
  update media_customers set source_status = 'dang_dung'
    where id = NEW.media_customer_id and coalesce(source_status, 'chua_dung') = 'chua_dung';
  perform notify_relevant(NEW.editor_id, 'clip_submitted',
    'Editor đã đẩy clip mới cần duyệt: ' || coalesce(cname, ''), '', 'content', array['marketing']);
  return NEW;
end $$;

-- Ads chấm/duyệt: báo editor (điểm) + media + admin; duyệt chạy -> source "Đã dựng" + thưởng 500k
create or replace function notify_clip_update() returns trigger language plpgsql security definer set search_path = public as $$
declare cname text; mid uuid; pts int; lvl text;
begin
  select customer_name, media_id into cname, mid from media_customers where id = NEW.media_customer_id;

  if NEW.stage = 'submitted' and OLD.stage is distinct from 'submitted' then
    perform notify_relevant(NEW.editor_id, 'clip_submitted',
      'Editor nộp lại clip: ' || coalesce(cname, ''), '', 'content', array['marketing']);
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
        coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content');
    end if;
    if mid is not null and mid is distinct from NEW.editor_id then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (mid, NEW.ads_id, 'clip_reviewed', 'Ads đã đánh giá clip: ' || coalesce(cname, ''), coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content');
    end if;
    insert into notifications(user_id, actor_id, type, title, body, link)
    select p.id, NEW.ads_id, 'clip_reviewed', 'Ads đánh giá clip: ' || coalesce(cname, '') || ' (' || pts || '/10)', coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content'
    from profiles p where p.role::text = 'admin' and p.id is distinct from NEW.ads_id and p.id is distinct from mid and p.id is distinct from NEW.editor_id;
  end if;

  -- Duyệt chạy Ads -> source Đã dựng + thưởng editor 500k
  if NEW.approved_to_run is true and OLD.approved_to_run is distinct from true then
    update media_customers set source_status = 'da_dung' where id = NEW.media_customer_id;
    if NEW.editor_id is not null then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (NEW.editor_id, NEW.ads_id, 'clip_approved',
        'Video của bạn đã được duyệt chạy Ads',
        coalesce(NEW.title, '') || ' — thưởng 500.000đ', 'content');
    end if;
  end if;
  return NEW;
end $$;
