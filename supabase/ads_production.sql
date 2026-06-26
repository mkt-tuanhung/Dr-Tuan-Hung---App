-- ============================================================
-- SẢN XUẤT ADS: Kho media (Media up nguồn) -> Editor dựng clip -> Ads duyệt
-- ============================================================

-- Dọn module cũ (content_tasks) nếu có — thay bằng kho media + clip
drop table if exists content_tasks cascade;
drop function if exists notify_content_new() cascade;
drop function if exists notify_content_update() cascade;

-- 1) KHO MEDIA: 1 dòng = 1 "media khách hàng" (nguồn video của 1 khách)
create table if not exists media_customers (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references customer_appointments(id) on delete set null, -- liên kết "Thông tin khách hàng"
  customer_name text,
  customer_phone text,
  media_id uuid references profiles(id) on delete set null,   -- người up nguồn
  source_links jsonb default '[]'::jsonb,                     -- link Google Drive nguồn
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_media_customers_appt on media_customers(appointment_id);
create index if not exists idx_media_customers_phone on media_customers(customer_phone);

-- 2) CLIP: 1 dòng = 1 clip editor dựng cho 1 media khách hàng
create table if not exists media_clips (
  id uuid default uuid_generate_v4() primary key,
  media_customer_id uuid references media_customers(id) on delete cascade not null,
  editor_id uuid references profiles(id) on delete set null,
  clip_links jsonb default '[]'::jsonb,                       -- link clip đã dựng
  thumb_links jsonb default '[]'::jsonb,                      -- link ảnh thumbnail
  editor_note text,
  stage text default 'submitted',   -- submitted | revision | approved | done
  ads_id uuid references profiles(id) on delete set null,
  ad_status text,                   -- chua_chay | dang_chay | tam_dung
  ads_feedback text,
  win boolean,
  win_amount numeric default 0,
  score int default 0,
  result_note text,
  submitted_at timestamptz default now(),
  evaluated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_media_clips_store on media_clips(media_customer_id);
create index if not exists idx_media_clips_editor on media_clips(editor_id);

drop trigger if exists trg_media_customers_updated on media_customers;
create trigger trg_media_customers_updated before update on media_customers for each row execute function update_updated_at();
drop trigger if exists trg_media_clips_updated on media_clips;
create trigger trg_media_clips_updated before update on media_clips for each row execute function update_updated_at();

-- 3) RLS (current_user_role() trả ENUM -> cast ::text)
alter table media_customers enable row level security;
alter table media_clips enable row level security;
drop policy if exists "mc_select" on media_customers;
drop policy if exists "mc_write" on media_customers;
drop policy if exists "mc_delete" on media_customers;
drop policy if exists "clip_select" on media_clips;
drop policy if exists "clip_insert" on media_clips;
drop policy if exists "clip_update" on media_clips;
drop policy if exists "clip_delete" on media_clips;

-- Kho media: đội content + chăm sóc (để Hậu phẫu xem "đã có media") đều xem được
create policy "mc_select" on media_customers for select using (
  public.current_user_role()::text in ('media','editor','marketing','admin','accountant','shareholder','dieu_duong','cskh')
  or media_id = auth.uid()
);
create policy "mc_write" on media_customers for all using (
  media_id = auth.uid() or public.current_user_role()::text in ('media','dieu_duong','cskh','marketing','admin')
) with check (
  media_id = auth.uid() or public.current_user_role()::text in ('media','dieu_duong','cskh','marketing','admin')
);
create policy "mc_delete" on media_customers for delete using (
  media_id = auth.uid() or public.current_user_role()::text = 'admin'
);

create policy "clip_select" on media_clips for select using (
  editor_id = auth.uid() or ads_id = auth.uid()
  or public.current_user_role()::text in ('media','editor','marketing','admin','accountant','shareholder')
);
create policy "clip_insert" on media_clips for insert with check (
  public.current_user_role()::text in ('editor','admin')
);
create policy "clip_update" on media_clips for update using (
  editor_id = auth.uid() or ads_id = auth.uid()
  or public.current_user_role()::text in ('editor','marketing','admin','accountant','shareholder')
) with check (
  editor_id = auth.uid() or ads_id = auth.uid()
  or public.current_user_role()::text in ('editor','marketing','admin','accountant','shareholder')
);
create policy "clip_delete" on media_clips for delete using (
  editor_id = auth.uid() or public.current_user_role()::text = 'admin'
);

do $$ begin alter publication supabase_realtime add table media_customers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table media_clips; exception when duplicate_object then null; end $$;

-- 4) Thông báo
-- Editor đẩy clip mới -> báo marketing (Ads) + admin
create or replace function notify_clip_submitted() returns trigger language plpgsql security definer set search_path = public as $$
declare cname text;
begin
  select customer_name into cname from media_customers where id = NEW.media_customer_id;
  perform notify_relevant(NEW.editor_id, 'clip_submitted',
    'Editor đã đẩy clip mới cần duyệt: ' || coalesce(cname, ''), '', 'content', array['marketing']);
  return NEW;
end $$;
drop trigger if exists trg_notify_clip_submitted on media_clips;
create trigger trg_notify_clip_submitted after insert on media_clips for each row execute function notify_clip_submitted();

-- Editor nộp lại / Ads đánh giá-góp ý -> báo đúng người
create or replace function notify_clip_update() returns trigger language plpgsql security definer set search_path = public as $$
declare cname text; mid uuid;
begin
  select customer_name, media_id into cname, mid from media_customers where id = NEW.media_customer_id;

  -- Editor nộp lại sau khi sửa -> báo marketing + admin
  if NEW.stage = 'submitted' and OLD.stage is distinct from 'submitted' then
    perform notify_relevant(NEW.editor_id, 'clip_submitted',
      'Editor nộp lại clip: ' || coalesce(cname, ''), '', 'content', array['marketing']);
  end if;

  -- Ads đánh giá / phản hồi -> báo MEDIA + admin
  if (NEW.evaluated_at is distinct from OLD.evaluated_at and NEW.evaluated_at is not null)
     or (NEW.ads_feedback is distinct from OLD.ads_feedback and coalesce(NEW.ads_feedback,'') <> '')
     or (NEW.stage in ('approved','revision') and NEW.stage is distinct from OLD.stage) then
    if mid is not null then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (mid, NEW.ads_id, 'clip_reviewed',
        'Ads đã đánh giá clip: ' || coalesce(cname, ''),
        coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content');
    end if;
    insert into notifications(user_id, actor_id, type, title, body, link)
    select p.id, NEW.ads_id, 'clip_reviewed',
      'Ads đã đánh giá clip: ' || coalesce(cname, ''), coalesce(NEW.ads_feedback, NEW.result_note, ''), 'content'
    from profiles p where p.role::text = 'admin' and p.id is distinct from NEW.ads_id and p.id is distinct from mid;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_clip_update on media_clips;
create trigger trg_notify_clip_update after update on media_clips for each row execute function notify_clip_update();
