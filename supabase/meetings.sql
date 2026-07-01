-- ============================================================
-- Module MEETING: phòng họp video (LiveKit) + AI biên bản/PRD/action items
-- ============================================================
create table if not exists meetings (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  room_name text not null unique,          -- tên phòng LiveKit
  created_by uuid references profiles(id) on delete set null,
  status text default 'scheduled',         -- scheduled | live | ended
  started_at timestamptz,
  ended_at timestamptz,
  recording_url text,                       -- file ghi hình/âm (R2) để transcribe
  segment_urls jsonb default '[]'::jsonb,
  transcript text,
  ai_status text default 'idle',            -- idle | processing | done | error
  ai_result jsonb,                          -- { summary, decisions[], prd, action_items[] }
  participants jsonb default '[]'::jsonb,   -- danh sách đã tham gia
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_meetings_created_by on meetings(created_by);
create index if not exists idx_meetings_status on meetings(status);

drop trigger if exists trg_meetings_updated on meetings;
create trigger trg_meetings_updated before update on meetings for each row execute function update_updated_at();

alter table meetings enable row level security;
-- Công cụ họp nội bộ: mọi nhân sự đang hoạt động đều xem & tạo được
drop policy if exists "meet_select" on meetings;
create policy "meet_select" on meetings for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.is_active, true) = true)
);
drop policy if exists "meet_insert" on meetings;
create policy "meet_insert" on meetings for insert with check (created_by = auth.uid());
drop policy if exists "meet_update" on meetings;
create policy "meet_update" on meetings for update using (created_by = auth.uid() or public.is_admin()) with check (true);
drop policy if exists "meet_delete" on meetings;
create policy "meet_delete" on meetings for delete using (created_by = auth.uid() or public.is_admin());

do $$ begin alter publication supabase_realtime add table meetings; exception when duplicate_object then null; end $$;
