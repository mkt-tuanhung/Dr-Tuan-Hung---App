-- Khi Ads đánh giá/chấm điểm clip -> báo EDITOR (kèm điểm) + media + admin
create or replace function notify_clip_update() returns trigger language plpgsql security definer set search_path = public as $$
declare cname text; mid uuid; pts int; lvl text;
begin
  select customer_name, media_id into cname, mid from media_customers where id = NEW.media_customer_id;

  -- Editor nộp lại sau khi sửa -> báo marketing + admin
  if NEW.stage = 'submitted' and OLD.stage is distinct from 'submitted' then
    perform notify_relevant(NEW.editor_id, 'clip_submitted',
      'Editor nộp lại clip: ' || coalesce(cname, ''), '', 'content', array['marketing']);
  end if;

  -- Ads đánh giá / chấm điểm / góp ý
  if (NEW.evaluated_at is distinct from OLD.evaluated_at and NEW.evaluated_at is not null)
     or (NEW.ads_feedback is distinct from OLD.ads_feedback and coalesce(NEW.ads_feedback,'') <> '')
     or (NEW.score is distinct from OLD.score)
     or (NEW.stage in ('approved','revision') and NEW.stage is distinct from OLD.stage) then
    pts := case when NEW.win then 10 else coalesce(NEW.score, 0) end;
    lvl := case when NEW.win or pts >= 10 then 'WIN' when pts >= 8 then 'Tốt' when pts >= 5 then 'Trung bình' when pts > 0 then 'Tệ' else 'Chưa chấm' end;

    -- Báo EDITOR kèm điểm số (động lực / lưu ý điều chỉnh)
    if NEW.editor_id is not null then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (NEW.editor_id, NEW.ads_id, 'clip_scored',
        'Ads chấm clip: ' || pts || '/10 · ' || lvl || coalesce(' — ' || NEW.title, ''),
        coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content');
    end if;

    -- Báo MEDIA (chủ source) + admin
    if mid is not null and mid is distinct from NEW.editor_id then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (mid, NEW.ads_id, 'clip_reviewed',
        'Ads đã đánh giá clip: ' || coalesce(cname, ''), coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content');
    end if;
    insert into notifications(user_id, actor_id, type, title, body, link)
    select p.id, NEW.ads_id, 'clip_reviewed',
      'Ads đánh giá clip: ' || coalesce(cname, '') || ' (' || pts || '/10)', coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content'
    from profiles p where p.role::text = 'admin' and p.id is distinct from NEW.ads_id and p.id is distinct from mid and p.id is distinct from NEW.editor_id;
  end if;
  return NEW;
end $$;
