-- ============================================================
-- MARKETING WORKSPACE v3 — CHAT, TÀI LIỆU & WIKI, BASE, AUTOMATION, ĐỊA ĐIỂM THẺ
-- Chạy SAU v1 (+ v2). Chạy lại nhiều lần vẫn an toàn. Không đụng bảng ngoài mw_*.
--
-- Quyền theo workspace (như v1): thành viên xem; Thực hiện / Quản lý / Chủ / Admin sửa.
-- Chat: mọi thành viên (kể cả Chỉ xem) được nhắn; sửa / xoá mềm tin của chính mình.
-- Automation: Quản lý / Chủ / Admin cài; chạy trong database khi thẻ được tạo / vào cột
--   (không tự di chuyển thẻ -> không tạo vòng lặp; có cờ chống chạy lồng). Mỗi lần chạy ghi nhật ký.
-- ============================================================

-- ---------- Địa điểm thẻ (view Map) ----------
alter table public.mw_tasks add column if not exists location text;
do $$ begin
  alter table public.mw_tasks add constraint mw_tasks_location_len check (location is null or length(location) <= 300);
exception when duplicate_object then null; end $$;

-- ---------- CHAT ----------
create table if not exists public.mw_messages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  body         text not null check (length(btrim(body)) between 1 and 4000),
  reply_to     uuid references public.mw_messages(id) on delete set null,
  task_id      uuid references public.mw_tasks(id) on delete set null,   -- thẻ được tạo từ tin nhắn
  edited_at    timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists mw_messages_ws_idx on public.mw_messages (workspace_id, created_at desc);

create or replace function public.mw_message_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_name text;
begin
  if TG_OP = 'INSERT' then
    NEW.author_id := auth.uid(); NEW.edited_at := null; NEW.deleted_at := null; NEW.task_id := null;
    if NEW.reply_to is not null and not exists (select 1 from mw_messages m where m.id = NEW.reply_to and m.workspace_id = NEW.workspace_id) then
      raise exception 'Tin trả lời không cùng workspace' using errcode = '22023'; end if;
    select name into v_name from mw_workspaces where id = NEW.workspace_id;
    for v_uid in select distinct (r.m[1])::uuid from regexp_matches(NEW.body, '@\[[^\]]+\]\(staff:([0-9a-fA-F-]{36})\)', 'g') as r(m) loop
      if exists (select 1 from mw_members mm where mm.workspace_id = NEW.workspace_id and mm.user_id = v_uid)
         or exists (select 1 from mw_workspaces w where w.id = NEW.workspace_id and w.owner_id = v_uid) then
        perform public.mw_notify(v_uid, 'mw_mention', 'Bạn được nhắc trong chat ' || coalesce(v_name, 'Marketing'), left(regexp_replace(NEW.body, '@\[([^\]]+)\]\([^)]+\)', '@\1', 'g'), 200), 'mkt_workspace#chat:' || NEW.workspace_id);
      end if;
    end loop;
    return NEW;
  end if;
  if NEW.workspace_id is distinct from OLD.workspace_id or NEW.author_id is distinct from OLD.author_id or NEW.created_at is distinct from OLD.created_at then
    raise exception 'Không được đổi người gửi / workspace' using errcode = '42501'; end if;
  if OLD.deleted_at is not null then raise exception 'Tin đã xoá' using errcode = '42501'; end if;
  if NEW.body is distinct from OLD.body then
    if OLD.author_id is distinct from auth.uid() then raise exception 'Chỉ người gửi sửa được tin nhắn' using errcode = '42501'; end if;
    NEW.edited_at := now();
  end if;
  if NEW.deleted_at is distinct from OLD.deleted_at and OLD.author_id is distinct from auth.uid() and not public.mw_can_manage_ws(OLD.workspace_id) then
    raise exception 'Chỉ người gửi hoặc quản lý xoá được tin nhắn' using errcode = '42501'; end if;
  if NEW.task_id is distinct from OLD.task_id and not public.mw_can_edit_ws(OLD.workspace_id) then
    raise exception 'Không có quyền tạo thẻ từ tin nhắn' using errcode = '42501'; end if;
  -- task_id chỉ được gắn thẻ cùng workspace
  if NEW.task_id is distinct from OLD.task_id and NEW.task_id is not null and public.mw_task_ws(NEW.task_id) is distinct from NEW.workspace_id then
    raise exception 'Thẻ không thuộc workspace' using errcode = '22023'; end if;
  return NEW;
end $$;
drop trigger if exists mw_message_guard on public.mw_messages;
create trigger mw_message_guard before insert or update on public.mw_messages for each row execute function public.mw_message_guard();

-- ---------- TÀI LIỆU & WIKI (có phiên bản) ----------
create table if not exists public.mw_docs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  parent_id    uuid references public.mw_docs(id) on delete set null,
  title        text not null check (length(btrim(title)) between 1 and 200),
  body         text not null default '' check (length(body) <= 200000),
  sort_index   numeric not null default 0,
  version      int not null default 1,
  created_by   uuid references public.profiles(id) on delete set null,
  updated_by   uuid references public.profiles(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists mw_docs_ws_idx on public.mw_docs (workspace_id, parent_id, sort_index);
create table if not exists public.mw_doc_versions (
  id         bigserial primary key,
  doc_id     uuid not null references public.mw_docs(id) on delete cascade,
  version    int not null,
  title      text not null,
  body       text not null,
  author_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (doc_id, version)
);
create or replace function public.mw_doc_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.created_by := auth.uid(); NEW.updated_by := auth.uid(); NEW.version := 1;
  else
    if NEW.workspace_id is distinct from OLD.workspace_id or NEW.created_by is distinct from OLD.created_by then
      raise exception 'Không được đổi workspace / người tạo' using errcode = '42501'; end if;
    if NEW.title is distinct from OLD.title or NEW.body is distinct from OLD.body then
      -- lưu bản cũ trước khi ghi đè (lịch sử phiên bản)
      insert into mw_doc_versions (doc_id, version, title, body, author_id) values (OLD.id, OLD.version, OLD.title, OLD.body, OLD.updated_by)
        on conflict (doc_id, version) do nothing;
      NEW.version := OLD.version + 1;
    else
      NEW.version := OLD.version;
    end if;
    NEW.updated_by := auth.uid(); NEW.updated_at := now();
  end if;
  if NEW.parent_id is not null and not exists (select 1 from mw_docs d where d.id = NEW.parent_id and d.workspace_id = NEW.workspace_id) then
    raise exception 'Trang cha không cùng workspace' using errcode = '22023'; end if;
  if TG_OP = 'UPDATE' and NEW.parent_id = NEW.id then raise exception 'Trang không làm cha của chính nó' using errcode = '22023'; end if;
  return NEW;
end $$;
drop trigger if exists mw_doc_guard on public.mw_docs;
create trigger mw_doc_guard before insert or update on public.mw_docs for each row execute function public.mw_doc_guard();

-- ---------- BASE (bảng dữ liệu tuỳ biến) ----------
create table if not exists public.mw_bases (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 120),
  -- [{ id, name, type: text|number|date|select|checkbox|url|person, options: [] }]
  fields       jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  created_by   uuid references public.profiles(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists public.mw_base_rows (
  id         uuid primary key default gen_random_uuid(),
  base_id    uuid not null references public.mw_bases(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and length(data::text) <= 20000),
  sort_index numeric not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mw_base_rows_base_idx on public.mw_base_rows (base_id, sort_index);
create or replace function public.mw_base_ws(p_base uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from mw_bases where id = p_base; $$;
create or replace function public.mw_base_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'mw_bases' then
    if TG_OP = 'INSERT' then NEW.created_by := auth.uid();
    elsif NEW.workspace_id is distinct from OLD.workspace_id then raise exception 'Không chuyển Base sang workspace khác' using errcode = '42501'; end if;
  else
    if TG_OP = 'INSERT' then NEW.created_by := auth.uid();
    elsif NEW.base_id is distinct from OLD.base_id then raise exception 'Không chuyển dòng sang Base khác' using errcode = '42501'; end if;
    NEW.updated_by := auth.uid();
  end if;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists mw_base_guard on public.mw_bases;
create trigger mw_base_guard before insert or update on public.mw_bases for each row execute function public.mw_base_guard();
drop trigger if exists mw_base_row_guard on public.mw_base_rows;
create trigger mw_base_row_guard before insert or update on public.mw_base_rows for each row execute function public.mw_base_guard();

-- ---------- AUTOMATION ----------
create table if not exists public.mw_automations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  board_id     uuid not null references public.mw_boards(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 120),
  enabled      boolean not null default true,
  trigger_type text not null check (trigger_type in ('moved_to_list', 'created_in_list')),
  list_id      uuid not null references public.mw_lists(id) on delete cascade,
  -- [{type:'assign',user_id} | {type:'add_label',label_id} | {type:'set_due_days',days} | {type:'set_priority',value}
  --  | {type:'add_checklist',items:[...]} | {type:'notify',user_id}]
  actions      jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 10),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists public.mw_automation_runs (
  id            bigserial primary key,
  automation_id uuid not null references public.mw_automations(id) on delete cascade,
  task_id       uuid references public.mw_tasks(id) on delete set null,
  ok            boolean not null,
  detail        text,
  created_at    timestamptz not null default now()
);
create index if not exists mw_automation_runs_idx on public.mw_automation_runs (automation_id, created_at desc);

create or replace function public.mw_automation_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then NEW.created_by := auth.uid(); end if;
  if public.mw_board_ws(NEW.board_id) is distinct from NEW.workspace_id then raise exception 'Board không thuộc workspace' using errcode = '22023'; end if;
  if not exists (select 1 from mw_lists l where l.id = NEW.list_id and l.board_id = NEW.board_id) then raise exception 'Cột không thuộc board' using errcode = '22023'; end if;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists mw_automation_guard on public.mw_automations;
create trigger mw_automation_guard before insert or update on public.mw_automations for each row execute function public.mw_automation_guard();

-- Chạy các luật khớp sự kiện cho 1 thẻ. Lỗi từng hành động được ghi lại, không chặn thao tác của người dùng.
create or replace function public.mw_run_automations(p_task uuid, p_event text) returns void
language plpgsql security definer set search_path = public as $$
declare a record; act jsonb; v_t mw_tasks%rowtype; v_ws uuid; v_done text[]; v_err text; v_item text;
begin
  if coalesce(current_setting('mw.auto', true), '') = 'on' then return; end if;   -- chống chạy lồng
  select * into v_t from mw_tasks where id = p_task;
  if not found then return; end if;
  v_ws := public.mw_board_ws(v_t.board_id);
  perform set_config('mw.auto', 'on', true);
  for a in select * from mw_automations where enabled and board_id = v_t.board_id and list_id = v_t.list_id and trigger_type = p_event order by created_at loop
    v_done := '{}'; v_err := null;
    begin
      for act in select * from jsonb_array_elements(a.actions) loop
        case act->>'type'
          when 'assign' then
            if exists (select 1 from mw_members m where m.workspace_id = v_ws and m.user_id = (act->>'user_id')::uuid)
               or exists (select 1 from mw_workspaces w where w.id = v_ws and w.owner_id = (act->>'user_id')::uuid) then
              insert into mw_task_assignees (task_id, user_id) values (p_task, (act->>'user_id')::uuid) on conflict do nothing;
              v_done := array_append(v_done, 'giao việc');
            end if;
          when 'add_label' then
            insert into mw_task_labels (task_id, label_id) select p_task, l.id from mw_labels l where l.id = (act->>'label_id')::uuid and l.workspace_id = v_ws on conflict do nothing;
            v_done := array_append(v_done, 'gắn nhãn');
          when 'set_due_days' then
            update mw_tasks set due_at = date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'
                                       + make_interval(days => greatest(0, least(365, (act->>'days')::int))) + interval '17 hours'
             where id = p_task;
            v_done := array_append(v_done, 'đặt hạn');
          when 'set_priority' then
            if act->>'value' in ('low', 'normal', 'high', 'urgent') then
              update mw_tasks set priority = act->>'value' where id = p_task; v_done := array_append(v_done, 'đổi ưu tiên');
            end if;
          when 'add_checklist' then
            for v_item in select jsonb_array_elements_text(act->'items') loop
              if length(btrim(v_item)) between 1 and 300 then
                insert into mw_checklist_items (task_id, title, sort_index) values (p_task, btrim(v_item), extract(epoch from clock_timestamp()));
              end if;
            end loop;
            v_done := array_append(v_done, 'thêm checklist');
          when 'notify' then
            perform public.mw_notify((act->>'user_id')::uuid, 'mw_automation', 'Automation: ' || a.name, v_t.title, 'mkt_workspace#task:' || p_task);
            v_done := array_append(v_done, 'thông báo');
          else null;
        end case;
      end loop;
    exception when others then v_err := sqlerrm;
    end;
    insert into mw_automation_runs (automation_id, task_id, ok, detail)
    values (a.id, p_task, v_err is null, coalesce(v_err, array_to_string(v_done, ', ')));
  end loop;
  perform set_config('mw.auto', '', true);
end $$;

create or replace function public.mw_task_auto_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then perform public.mw_run_automations(NEW.id, 'created_in_list');
  elsif NEW.list_id is distinct from OLD.list_id then perform public.mw_run_automations(NEW.id, 'moved_to_list'); end if;
  return NEW;
end $$;
drop trigger if exists mw_task_auto on public.mw_tasks;
create trigger mw_task_auto after insert or update of list_id on public.mw_tasks for each row execute function public.mw_task_auto_trg();

-- ---------- RLS ----------
alter table public.mw_messages enable row level security;
alter table public.mw_docs enable row level security;
alter table public.mw_doc_versions enable row level security;
alter table public.mw_bases enable row level security;
alter table public.mw_base_rows enable row level security;
alter table public.mw_automations enable row level security;
alter table public.mw_automation_runs enable row level security;
do $$ declare p text; begin
  foreach p in array array['mw_msg_sel','mw_msg_ins','mw_msg_upd','mw_doc_sel','mw_doc_ins','mw_doc_upd','mw_doc_del','mw_docv_sel',
    'mw_base_sel','mw_base_ins','mw_base_upd','mw_base_del','mw_brow_sel','mw_brow_ins','mw_brow_upd','mw_brow_del',
    'mw_auto_sel','mw_auto_ins','mw_auto_upd','mw_auto_del','mw_autorun_sel'] loop
    execute format('drop policy if exists %I on public.%I', p,
      case when p like 'mw_msg%' then 'mw_messages' when p like 'mw_docv%' then 'mw_doc_versions' when p like 'mw_doc%' then 'mw_docs'
           when p like 'mw_brow%' then 'mw_base_rows' when p like 'mw_base%' then 'mw_bases' when p like 'mw_autorun%' then 'mw_automation_runs' else 'mw_automations' end);
  end loop;
end $$;
create policy mw_msg_sel on public.mw_messages for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_msg_ins on public.mw_messages for insert to authenticated with check (public.mw_can_view_ws(workspace_id));
create policy mw_msg_upd on public.mw_messages for update to authenticated
  using (public.mw_can_view_ws(workspace_id) and (author_id = auth.uid() or public.mw_can_edit_ws(workspace_id)))
  with check (public.mw_can_view_ws(workspace_id));
create policy mw_doc_sel on public.mw_docs for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_doc_ins on public.mw_docs for insert to authenticated with check (public.mw_can_edit_ws(workspace_id));
create policy mw_doc_upd on public.mw_docs for update to authenticated using (public.mw_can_edit_ws(workspace_id)) with check (public.mw_can_edit_ws(workspace_id));
create policy mw_doc_del on public.mw_docs for delete to authenticated using (public.mw_can_manage_ws(workspace_id));
create policy mw_docv_sel on public.mw_doc_versions for select to authenticated using (exists (select 1 from public.mw_docs d where d.id = doc_id and public.mw_can_view_ws(d.workspace_id)));
create policy mw_base_sel on public.mw_bases for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_base_ins on public.mw_bases for insert to authenticated with check (public.mw_can_edit_ws(workspace_id));
create policy mw_base_upd on public.mw_bases for update to authenticated using (public.mw_can_edit_ws(workspace_id)) with check (public.mw_can_edit_ws(workspace_id));
create policy mw_base_del on public.mw_bases for delete to authenticated using (public.mw_can_manage_ws(workspace_id));
create policy mw_brow_sel on public.mw_base_rows for select to authenticated using (public.mw_can_view_ws(public.mw_base_ws(base_id)));
create policy mw_brow_ins on public.mw_base_rows for insert to authenticated with check (public.mw_can_edit_ws(public.mw_base_ws(base_id)));
create policy mw_brow_upd on public.mw_base_rows for update to authenticated using (public.mw_can_edit_ws(public.mw_base_ws(base_id))) with check (public.mw_can_edit_ws(public.mw_base_ws(base_id)));
create policy mw_brow_del on public.mw_base_rows for delete to authenticated using (public.mw_can_edit_ws(public.mw_base_ws(base_id)));
create policy mw_auto_sel on public.mw_automations for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_auto_ins on public.mw_automations for insert to authenticated with check (public.mw_can_manage_ws(workspace_id));
create policy mw_auto_upd on public.mw_automations for update to authenticated using (public.mw_can_manage_ws(workspace_id)) with check (public.mw_can_manage_ws(workspace_id));
create policy mw_auto_del on public.mw_automations for delete to authenticated using (public.mw_can_manage_ws(workspace_id));
create policy mw_autorun_sel on public.mw_automation_runs for select to authenticated using (exists (select 1 from public.mw_automations a where a.id = automation_id and public.mw_can_view_ws(a.workspace_id)));

grant select, insert, update on public.mw_messages to authenticated;
grant select, insert, update, delete on public.mw_docs, public.mw_bases, public.mw_base_rows, public.mw_automations to authenticated;
grant select on public.mw_doc_versions, public.mw_automation_runs to authenticated;
revoke all on public.mw_messages, public.mw_docs, public.mw_doc_versions, public.mw_bases, public.mw_base_rows,
  public.mw_automations, public.mw_automation_runs from anon;
revoke all on function public.mw_run_automations(uuid, text) from public, anon, authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.mw_messages'; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

notify pgrst, 'reload schema';
