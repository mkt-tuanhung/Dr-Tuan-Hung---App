-- ============================================================
-- MODULE BÁO CÁO CÔNG VIỆC: Media -> Editor -> Ads (sản xuất content quảng cáo)
-- ============================================================
-- LƯU Ý: Nếu Supabase báo lỗi "unsafe use of new value 'editor'" thì chạy
-- RIÊNG dòng ALTER TYPE bên dưới TRƯỚC, rồi chạy phần còn lại.

-- 1) Thêm vai trò Editor
alter type user_role add value if not exists 'editor';

-- 2) Bảng công việc content (1 dòng = 1 video cho 1 khách)
create table if not exists content_tasks (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references customer_appointments(id) on delete set null,
  customer_name text,
  customer_phone text,
  media_id uuid references profiles(id) on delete set null,   -- người quay/chụp tạo task
  source_links jsonb default '[]'::jsonb,                     -- link Drive source
  media_note text,
  editor_id uuid references profiles(id) on delete set null,  -- editor nhận việc
  edited_links jsonb default '[]'::jsonb,                     -- link clip đã dựng
  editor_note text,
  ads_id uuid references profiles(id) on delete set null,     -- nhân viên Ads xử lý
  stage text default 'source_ready',  -- source_ready | editing | review | revision | approved | done
  ad_status text,                     -- chua_chay | dang_chay | tam_dung
  revision_count int default 0,
  revision_note text,
  win boolean,
  score int default 0,
  win_amount numeric default 0,       -- tiền thưởng editor khi WIN (admin/ads nhập)
  result_note text,
  edited_at timestamptz,
  approved_at timestamptz,
  evaluated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_content_tasks_stage on content_tasks(stage);
create index if not exists idx_content_tasks_editor on content_tasks(editor_id);
create index if not exists idx_content_tasks_media on content_tasks(media_id);

drop trigger if exists trg_content_updated on content_tasks;
create trigger trg_content_updated before update on content_tasks for each row execute function update_updated_at();

-- 3) RLS — current_user_role() trả về ENUM nên phải cast ::text khi so với text
alter table content_tasks enable row level security;
drop policy if exists "content_select" on content_tasks;
drop policy if exists "content_insert" on content_tasks;
drop policy if exists "content_update" on content_tasks;
drop policy if exists "content_delete" on content_tasks;

-- Xem: người liên quan (media/editor/ads của task) + đội content (editor, marketing) + quản lý
create policy "content_select" on content_tasks for select using (
  media_id = auth.uid() or editor_id = auth.uid() or ads_id = auth.uid()
  or public.current_user_role()::text in ('admin', 'accountant', 'shareholder', 'editor', 'marketing')
);
-- Tạo: media (tự đứng tên) hoặc admin
create policy "content_insert" on content_tasks for insert with check (
  media_id = auth.uid() and public.current_user_role()::text in ('media', 'marketing', 'admin')
);
-- Sửa: người liên quan + đội content + quản lý (editor tự nhận, ads chấm...)
create policy "content_update" on content_tasks for update using (
  media_id = auth.uid() or editor_id = auth.uid() or ads_id = auth.uid()
  or public.current_user_role()::text in ('admin', 'accountant', 'shareholder', 'editor', 'marketing')
) with check (
  media_id = auth.uid() or editor_id = auth.uid() or ads_id = auth.uid()
  or public.current_user_role()::text in ('admin', 'accountant', 'shareholder', 'editor', 'marketing')
);
-- Xoá: media chủ task hoặc admin
create policy "content_delete" on content_tasks for delete using (
  media_id = auth.uid() or public.current_user_role()::text = 'admin'
);

do $$ begin alter publication supabase_realtime add table content_tasks; exception when duplicate_object then null; end $$;

-- 4) Tìm/gợi ý khách hàng (từ lịch hẹn/tái khám) — bỏ RLS, dùng cho ô tìm trong báo cáo Media
create or replace function search_content_customers(q text)
returns table(appointment_id uuid, customer_name text, phone text, service text, last_date date)
language sql stable security definer set search_path = public as $$
  select id, customer_name, phone, service, coalesce(surgery_date, appointment_date)::date
  from customer_appointments
  where (coalesce(q, '') = '' or customer_name ilike '%' || q || '%' or phone ilike '%' || q || '%')
  order by coalesce(updated_at, created_at) desc nulls last
  limit 12;
$$;

-- 5) Thông báo theo luồng
-- Media thêm source -> báo Editor (+admin)
create or replace function notify_content_new() returns trigger language plpgsql security definer set search_path = public as $$
declare mname text;
begin
  select full_name into mname from profiles where id = NEW.media_id;
  perform notify_relevant(NEW.media_id, 'content_new',
    coalesce(mname, 'Media') || ' thêm video cần dựng: ' || coalesce(NEW.customer_name, ''),
    '', 'content', array['editor']);
  return NEW;
end $$;
drop trigger if exists trg_notify_content_new on content_tasks;
create trigger trg_notify_content_new after insert on content_tasks for each row execute function notify_content_new();

-- Chuyển trạng thái -> báo đúng người
create or replace function notify_content_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Editor nộp clip -> chờ Ads duyệt (báo marketing + admin)
  if NEW.stage = 'review' and OLD.stage is distinct from 'review' then
    perform notify_relevant(NEW.editor_id, 'content_review',
      'Video chờ duyệt: ' || coalesce(NEW.customer_name, ''), '', 'content', array['marketing']);
  end if;
  -- Ads yêu cầu sửa -> báo editor cụ thể
  if NEW.stage = 'revision' and OLD.stage is distinct from 'revision' and NEW.editor_id is not null then
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (NEW.editor_id, NEW.ads_id, 'content_revision',
      'Video cần chỉnh sửa: ' || coalesce(NEW.customer_name, ''), coalesce(NEW.revision_note, ''), 'content');
  end if;
  -- Chấm WIN -> báo editor (kèm tiền thưởng)
  if NEW.win is true and OLD.win is distinct from true and NEW.editor_id is not null then
    insert into notifications(user_id, actor_id, type, title, body, link)
    values (NEW.editor_id, NEW.ads_id, 'content_win',
      '🏆 Video WIN! +' || to_char(coalesce(NEW.win_amount, 0), 'FM999G999G999') || 'đ',
      coalesce(NEW.result_note, ''), 'content');
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_content_update on content_tasks;
create trigger trg_notify_content_update after update on content_tasks for each row execute function notify_content_update();
