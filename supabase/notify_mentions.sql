-- ============================================================
-- Thông báo khi được TAG (@) trong bình luận cộng đồng
-- (client không insert được notifications do RLS → dùng trigger DB)
-- ============================================================

create or replace function notify_comment_mention() returns trigger language plpgsql security definer set search_path = public as $$
declare aname text; ptitle text; sid uuid;
begin
  select full_name into aname from profiles where id = NEW.author_id;
  select title into ptitle from community_posts where id = NEW.post_id;

  for sid in
    select distinct (regexp_matches(NEW.content, '@\[[^\]]+\]\(staff:([0-9a-fA-F-]+)\)', 'g'))[1]::uuid
  loop
    if sid <> NEW.author_id then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (sid, NEW.author_id, 'mention',
        coalesce(aname, 'Ai đó') || ' đã nhắc đến bạn trong 1 bình luận' || coalesce(' (bài "' || ptitle || '")', ''),
        left(regexp_replace(NEW.content, '@\[([^\]]+)\]\((staff|cust):[0-9a-fA-F-]+\)', '@\1', 'g'), 120),
        'community');
    end if;
  end loop;
  return NEW;
end $$;
drop trigger if exists trg_notify_comment_mention on community_comments;
create trigger trg_notify_comment_mention after insert on community_comments for each row execute function notify_comment_mention();
