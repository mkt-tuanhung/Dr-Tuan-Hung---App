-- ============================================================
-- Gói sửa lỗi: reaction lưu được, thông báo chi tiết + đúng link, thông báo like
-- ============================================================

-- #6 — community_likes đủ 4 policy (thiếu UPDATE khiến upsert reaction bị chặn → mất)
alter table community_likes add column if not exists reaction text default 'like';
alter table community_likes enable row level security;
drop policy if exists "likes_read" on community_likes;
drop policy if exists "likes_insert" on community_likes;
drop policy if exists "likes_update" on community_likes;
drop policy if exists "likes_delete" on community_likes;
drop policy if exists "likes_write_own" on community_likes;
drop policy if exists "all_authenticated" on community_likes;
create policy "likes_read" on community_likes for select using (auth.uid() is not null);
create policy "likes_insert" on community_likes for insert with check (user_id = auth.uid());
create policy "likes_update" on community_likes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "likes_delete" on community_likes for delete using (user_id = auth.uid());

-- #4 + #5 — thông báo nghỉ phép ghi rõ loại + link đúng tab 'attendance'
create or replace function notify_leave_request() returns trigger language plpgsql security definer set search_path = public as $$
declare sname text; tlabel text;
begin
  if NEW.status = 'pending' then
    select full_name into sname from profiles where id = NEW.staff_id;
    tlabel := case NEW.type
      when 'late' then 'Xin đi muộn'
      when 'early' then 'Xin về sớm'
      when 'leave' then 'Xin nghỉ cả ngày'
      when 'half_day' then 'Xin nghỉ nửa ngày' ||
           coalesce(case NEW.half_day_period when 'morning' then ' (buổi sáng)' when 'afternoon' then ' (buổi chiều)' else '' end, '')
      else 'Xin nghỉ phép' end;
    insert into notifications(user_id, actor_id, type, title, body, link, action_type, action_id)
    select p.id, NEW.staff_id, 'leave_request',
           coalesce(sname, 'Nhân sự') || ' — ' || tlabel,
           'Ngày ' || to_char(NEW.date, 'DD/MM/YYYY') || coalesce(' · Lý do: ' || NEW.reason, ''),
           'attendance', 'leave', NEW.id
    from profiles p where p.role in ('admin', 'accountant') and p.id <> NEW.staff_id;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_leave_request on leave_requests;
create trigger trg_notify_leave_request after insert on leave_requests for each row execute function notify_leave_request();

-- #3 — thông báo khi có người thả cảm xúc BÀI VIẾT
create or replace function notify_post_like() returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; aname text; gname text;
begin
  select p.author_id, g.name into author, gname
  from community_posts p left join community_groups g on g.id = p.group_id where p.id = NEW.post_id;
  if author is not null and author <> NEW.user_id then
    select full_name into aname from profiles where id = NEW.user_id;
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (author, NEW.user_id, 'community_like',
            coalesce(aname, 'Ai đó') || ' đã thả cảm xúc bài viết của bạn' || coalesce(' trong ' || gname, ''),
            null, 'community');
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_post_like on community_likes;
create trigger trg_notify_post_like after insert on community_likes for each row execute function notify_post_like();

-- #3 — thông báo khi có người thả cảm xúc BÌNH LUẬN
create or replace function notify_comment_like() returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; aname text;
begin
  select author_id into author from community_comments where id = NEW.comment_id;
  if author is not null and author <> NEW.user_id then
    select full_name into aname from profiles where id = NEW.user_id;
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (author, NEW.user_id, 'community_like',
            coalesce(aname, 'Ai đó') || ' đã thả cảm xúc bình luận của bạn', null, 'community');
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_comment_like on community_comment_likes;
create trigger trg_notify_comment_like after insert on community_comment_likes for each row execute function notify_comment_like();

-- Sửa các thông báo nghỉ phép CŨ đang trỏ sai link
update notifications set link = 'attendance' where action_type = 'leave' and link = 'leave';
