-- Thông báo khi được TAG (@nhân sự) trong BÀI VIẾT cộng đồng
create or replace function notify_post_mention() returns trigger language plpgsql security definer set search_path = public as $$
declare aname text; sid uuid;
begin
  select full_name into aname from profiles where id = NEW.author_id;
  for sid in
    select distinct (regexp_matches(coalesce(NEW.content, ''), '@\[[^\]]+\]\(staff:([0-9a-fA-F-]+)\)', 'g'))[1]::uuid
  loop
    if sid <> NEW.author_id then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (sid, NEW.author_id, 'mention',
        coalesce(aname, 'Ai đó') || ' đã nhắc đến bạn trong bài viết' || coalesce(' "' || NEW.title || '"', ''),
        left(regexp_replace(regexp_replace(coalesce(NEW.content, ''), '@\[([^\]]+)\]\((staff|cust):[0-9a-fA-F-]+\)', '@\1', 'g'), '<[^>]+>', '', 'g'), 120),
        'community');
    end if;
  end loop;
  return NEW;
end $$;
drop trigger if exists trg_notify_post_mention on community_posts;
create trigger trg_notify_post_mention after insert on community_posts for each row execute function notify_post_mention();
