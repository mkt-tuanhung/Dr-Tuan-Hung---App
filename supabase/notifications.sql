-- ============================================================
-- Hệ thống Thông báo (in-app, realtime)
-- Chạy trong Supabase SQL Editor.
-- ============================================================

create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,  -- người nhận
  actor_id uuid references profiles(id),                            -- người gây ra
  type text not null,
  title text not null,
  body text,
  link text,                                                        -- tab để mở: 'advances' | 'community' ...
  is_read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user on notifications(user_id, created_at desc);

alter table notifications enable row level security;
drop policy if exists "noti_read" on notifications;
drop policy if exists "noti_update" on notifications;
create policy "noti_read" on notifications for select using (user_id = auth.uid());
create policy "noti_update" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Insert chỉ qua trigger (SECURITY DEFINER) — user không tự insert.

-- Bật realtime
do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null; end $$;

-- ---------- Trigger: Duyệt / hoàn ứng khoản chi ----------
create or replace function notify_expense() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (NEW.staff_id, NEW.approved_by, 'expense_approved', 'Khoản chi đã được duyệt',
            'Số tiền ' || to_char(NEW.amount, 'FM999G999G999') || 'đ đã được duyệt', 'advances');
  elsif NEW.status = 'paid' and OLD.status is distinct from 'paid' then
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (NEW.staff_id, NEW.approved_by, 'expense_paid',
            case when NEW.is_advance then 'Đã hoàn ứng cho bạn' else 'Khoản chi đã thanh toán' end,
            'Số tiền ' || to_char(NEW.amount, 'FM999G999G999') || 'đ', 'advances');
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_expense on expenses;
create trigger trg_notify_expense after update on expenses for each row execute function notify_expense();

-- ---------- Trigger: Bài viết mới trong group → báo cho thành viên ----------
create or replace function notify_post() returns trigger language plpgsql security definer set search_path = public as $$
declare gname text; aname text;
begin
  select name into gname from community_groups where id = NEW.group_id;
  select full_name into aname from profiles where id = NEW.author_id;
  insert into notifications(user_id, actor_id, type, title, body, link)
  select m.user_id, NEW.author_id, 'community_post',
         coalesce(aname, 'Ai đó') || ' đã đăng bài trong ' || coalesce(gname, 'group'),
         coalesce(NEW.title, ''), 'community'
  from community_group_members m
  where m.group_id = NEW.group_id and m.user_id <> NEW.author_id;
  return NEW;
end $$;
drop trigger if exists trg_notify_post on community_posts;
create trigger trg_notify_post after insert on community_posts for each row execute function notify_post();

-- ---------- Trigger: Bình luận → báo cho tác giả bài & người được trả lời ----------
create or replace function notify_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare gname text; aname text; post_author uuid; gid uuid; parent_author uuid;
begin
  select p.author_id, p.group_id into post_author, gid from community_posts p where p.id = NEW.post_id;
  select name into gname from community_groups where id = gid;
  select full_name into aname from profiles where id = NEW.author_id;
  if post_author is not null and post_author <> NEW.author_id then
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (post_author, NEW.author_id, 'community_comment',
            coalesce(aname, 'Ai đó') || ' đã bình luận bài viết của bạn' || case when gname is not null then ' trong ' || gname else '' end,
            NEW.content, 'community');
  end if;
  if NEW.parent_id is not null then
    select author_id into parent_author from community_comments where id = NEW.parent_id;
    if parent_author is not null and parent_author <> NEW.author_id and parent_author is distinct from post_author then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (parent_author, NEW.author_id, 'community_reply',
              coalesce(aname, 'Ai đó') || ' đã trả lời bình luận của bạn', NEW.content, 'community');
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_comment on community_comments;
create trigger trg_notify_comment after insert on community_comments for each row execute function notify_comment();
