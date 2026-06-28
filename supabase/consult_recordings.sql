-- ============================================================
-- Ghi âm tư vấn -> transcript (Whisper) -> AI chấm điểm (GPT)
-- ============================================================
create table if not exists consult_recordings (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references customer_appointments(id) on delete cascade,
  audio_url text not null,
  segment_urls jsonb default '[]'::jsonb,
  duration_sec int,
  transcript text,
  ai_score numeric,
  ai_analysis jsonb,
  status text default 'pending',   -- pending | processing | done | error
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_consult_rec_appt on consult_recordings(appointment_id);
create index if not exists idx_consult_rec_by on consult_recordings(created_by);

drop trigger if exists trg_consult_rec_updated on consult_recordings;
create trigger trg_consult_rec_updated before update on consult_recordings for each row execute function update_updated_at();

alter table consult_recordings enable row level security;
drop policy if exists "cr_select" on consult_recordings;
drop policy if exists "cr_insert" on consult_recordings;
drop policy if exists "cr_update" on consult_recordings;
drop policy if exists "cr_delete" on consult_recordings;
create policy "cr_select" on consult_recordings for select using (
  created_by = auth.uid() or public.current_user_role()::text in ('admin','accountant','shareholder','sale_offline')
);
create policy "cr_insert" on consult_recordings for insert with check (
  public.current_user_role()::text in ('sale_offline','admin')
);
create policy "cr_update" on consult_recordings for update using (
  created_by = auth.uid() or public.current_user_role()::text = 'admin'
) with check (true);
create policy "cr_delete" on consult_recordings for delete using (
  created_by = auth.uid() or public.current_user_role()::text = 'admin'
);

do $$ begin alter publication supabase_realtime add table consult_recordings; exception when duplicate_object then null; end $$;
