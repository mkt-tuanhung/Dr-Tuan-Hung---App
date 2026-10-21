-- ============================================================
-- MARKETING WORKSPACE v1 — chạy 1 lần trong Supabase SQL Editor (chạy lại vẫn an toàn)
-- Chỉ THÊM bảng / hàm mới (tiền tố mw_) + 1 cột cờ ở clinic_settings. KHÔNG sửa bảng cũ.
-- Gỡ bỏ: supabase/marketing_workspace_v1_rollback.sql (xoá toàn bộ dữ liệu Marketing Workspace).
--
-- Tổ chức / nhân sự: app là 1 phòng khám (1 tổ chức) -> "thành viên tổ chức" = tài khoản đang
-- hoạt động trong public.profiles. Không tạo hệ thống user mới. Workspace có danh sách thành viên
-- riêng (mw_members); mọi quyền đọc / ghi xét theo thành viên workspace (deny-by-default).
--
-- Vai trò trong workspace: owner | manager | editor | viewer   (Admin app = toàn quyền quản trị)
--   Xem: thành viên bất kỳ · Sửa thẻ / bình luận / checklist: owner, manager, editor
--   Tạo / lưu trữ board, cột, nhãn, chiến dịch, thêm thành viên: owner, manager
--   Tạo workspace: Admin hoặc vai trò Marketing (hàm mw_create_workspace)
-- Người duyệt (mw_reviewers, chỉ Admin cấp): medical (chuyên môn) | marketing | compliance | publisher.
--   Admin KHÔNG tự có quyền duyệt chuyên môn — phải được cấp như mọi người.
--
-- Bảo mật trạng thái: trạng thái duyệt / xuất bản / consent đã xác minh CHỈ đổi được qua hàm RPC
-- (trigger chặn PATCH trực tiếp từ trình duyệt — không giả mạo được "approved" / "published").
-- Duyệt gắn ĐÚNG phiên bản kịch bản / tệp (sha256) / caption; thêm phiên bản mới -> duyệt cũ mất hiệu lực,
-- lịch đăng bị khoá. "Đã đăng" chỉ khi có link bằng chứng + người KHÁC xác minh (chưa có API mạng xã hội).
-- ============================================================

-- ---------- Cờ bật / tắt module (tắt = app y như cũ) ----------
alter table public.clinic_settings add column if not exists mw_enabled boolean not null default false;

-- ---------- Hàm quyền dùng chung (security definer, tránh vòng lặp RLS) ----------
create or replace function public.mw_me_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
                 and coalesce(p.is_active, true) and coalesce(p.employment_status::text, '') <> 'inactive');
$$;

create or replace function public.mw_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
                 and (p.role::text = 'admin' or p.role_2::text = 'admin')
                 and coalesce(p.is_active, true));
$$;

create or replace function public.mw_has_app_role(p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
                 and (p.role::text = p_role or p.role_2::text = p_role) and coalesce(p.is_active, true));
$$;

-- ---------- Bảng ----------
create table if not exists public.mw_workspaces (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 120),
  description  text check (description is null or length(description) <= 2000),
  color        text not null default '#087F83' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  owner_id     uuid not null references public.profiles(id),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.mw_members (
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null check (role in ('owner', 'manager', 'editor', 'viewer')),
  added_by     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists mw_members_user_idx on public.mw_members (user_id);

create or replace function public.mw_ws_role(p_ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not public.mw_me_active() then null
    when exists (select 1 from mw_workspaces w where w.id = p_ws and w.owner_id = auth.uid()) then 'owner'
    when public.mw_is_admin() then 'admin'
    else (select m.role from mw_members m where m.workspace_id = p_ws and m.user_id = auth.uid())
  end;
$$;
create or replace function public.mw_can_view_ws(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.mw_ws_role(p_ws) is not null; $$;
create or replace function public.mw_can_edit_ws(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mw_ws_role(p_ws) in ('owner', 'admin', 'manager', 'editor'), false); $$;
create or replace function public.mw_can_manage_ws(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mw_ws_role(p_ws) in ('owner', 'admin', 'manager'), false); $$;

create table if not exists public.mw_boards (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 120),
  description  text,
  template     text not null default 'blank',
  color        text not null default '#087F83' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_index   numeric not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists mw_boards_ws_idx on public.mw_boards (workspace_id, sort_index);

create table if not exists public.mw_lists (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.mw_boards(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  sort_index   numeric not null default 0,
  wip_limit    int check (wip_limit is null or wip_limit between 1 and 500),
  is_done      boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (id, board_id)
);
create index if not exists mw_lists_board_idx on public.mw_lists (board_id, sort_index);

create table if not exists public.mw_labels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 40),
  color        text not null default '#087F83' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at   timestamptz not null default now()
);
create index if not exists mw_labels_ws_idx on public.mw_labels (workspace_id);

create table if not exists public.mw_tasks (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.mw_boards(id) on delete cascade,
  list_id      uuid not null,
  title        text not null check (length(btrim(title)) between 1 and 300),
  description  text not null default '' check (length(description) <= 20000),
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  start_at     timestamptz,
  due_at       timestamptz,
  sort_index   numeric not null default 0,
  version      int not null default 1,
  cover_color  text check (cover_color is null or cover_color ~ '^#[0-9A-Fa-f]{6}$'),
  estimate_hours numeric check (estimate_hours is null or estimate_hours between 0 and 10000),
  completed_at timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (list_id, board_id) references public.mw_lists (id, board_id)
);
create index if not exists mw_tasks_board_idx on public.mw_tasks (board_id, list_id, sort_index);
create index if not exists mw_tasks_due_idx on public.mw_tasks (due_at);

create table if not exists public.mw_task_assignees (
  task_id  uuid not null references public.mw_tasks(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists mw_task_assignees_user_idx on public.mw_task_assignees (user_id);

create table if not exists public.mw_task_watchers (
  task_id  uuid not null references public.mw_tasks(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table if not exists public.mw_task_labels (
  task_id  uuid not null references public.mw_tasks(id) on delete cascade,
  label_id uuid not null references public.mw_labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists public.mw_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.mw_tasks(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 300),
  done        boolean not null default false,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_at      timestamptz,
  sort_index  numeric not null default 0,
  done_by     uuid references public.profiles(id) on delete set null,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists mw_checklist_task_idx on public.mw_checklist_items (task_id, sort_index);

create table if not exists public.mw_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.mw_tasks(id) on delete cascade,
  author_id  uuid not null references public.profiles(id),
  body       text not null check (length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);
create index if not exists mw_comments_task_idx on public.mw_comments (task_id, created_at);

create table if not exists public.mw_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.mw_tasks(id) on delete cascade,
  url         text not null check (url ~ '^https://'),
  name        text not null check (length(name) between 1 and 300),
  mime        text,
  size_bytes  bigint check (size_bytes is null or size_bytes between 0 and 2147483648),
  sha256      text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists mw_attachments_task_idx on public.mw_attachments (task_id);

-- Nhật ký hoạt động (chỉ ghi thêm, chỉ ghi qua hàm hệ thống)
create table if not exists public.mw_activity (
  id           bigserial primary key,
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  task_id      uuid references public.mw_tasks(id) on delete set null,
  entity       text not null,
  entity_id    text,
  action       text not null,
  actor_id     uuid references public.profiles(id) on delete set null,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists mw_activity_ws_idx on public.mw_activity (workspace_id, created_at desc);
create index if not exists mw_activity_task_idx on public.mw_activity (task_id, created_at desc);

-- ---------- Marketing: người duyệt, chiến dịch, nội dung, phiên bản, duyệt, consent, xuất bản ----------
create table if not exists public.mw_reviewers (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('medical', 'marketing', 'compliance', 'publisher')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create or replace function public.mw_is_reviewer(p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mw_me_active() and exists (select 1 from mw_reviewers r where r.user_id = auth.uid() and r.kind = p_kind);
$$;

create table if not exists public.mw_campaigns (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.mw_workspaces(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 200),
  service       text,
  objective     text,
  channels      text[] not null default '{}',
  start_date    date,
  end_date      date check (end_date is null or start_date is null or end_date >= start_date),
  budget_plan   numeric check (budget_plan is null or budget_plan >= 0),
  budget_actual numeric check (budget_actual is null or budget_actual >= 0),
  kpi_target    text,
  status        text not null default 'planning' check (status in ('planning', 'running', 'paused', 'done', 'archived')),
  owner_id      uuid references public.profiles(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists mw_campaigns_ws_idx on public.mw_campaigns (workspace_id);

create table if not exists public.mw_contents (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.mw_workspaces(id) on delete cascade,
  campaign_id     uuid references public.mw_campaigns(id) on delete set null,
  task_id         uuid references public.mw_tasks(id) on delete set null,
  title           text not null check (length(btrim(title)) between 1 and 300),
  content_type    text not null default 'short_video' check (content_type in ('short_video', 'long_video', 'image', 'carousel', 'article', 'livestream', 'other')),
  platforms       text[] not null default '{}',
  brief           text,
  owner_id        uuid references public.profiles(id) on delete set null,
  medical_review_required boolean not null default true,
  consent_required boolean not null default false,
  -- idea | brief | scripting | production | editing  (người làm tự đổi)
  -- in_review | revision_required | rejected | approved | published (CHỈ qua RPC)
  workflow_status text not null default 'idea' check (workflow_status in
    ('idea', 'brief', 'scripting', 'production', 'editing', 'in_review', 'revision_required', 'rejected', 'approved', 'published', 'archived')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists mw_contents_ws_idx on public.mw_contents (workspace_id, workflow_status);

create table if not exists public.mw_content_versions (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid not null references public.mw_contents(id) on delete cascade,
  kind        text not null check (kind in ('script', 'asset', 'caption')),
  revision    int not null default 0,
  body        text check (body is null or length(body) <= 50000),
  file_url    text check (file_url is null or file_url ~ '^https://'),
  file_name   text,
  mime        text,
  sha256      text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  note        text,
  author_id   uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (content_id, kind, revision),
  check ((kind = 'asset' and file_url is not null and sha256 is not null) or (kind <> 'asset' and body is not null and length(btrim(body)) > 0))
);

create table if not exists public.mw_approval_runs (
  id                  uuid primary key default gen_random_uuid(),
  content_id          uuid not null references public.mw_contents(id) on delete cascade,
  script_version_id   uuid references public.mw_content_versions(id),
  asset_version_id    uuid references public.mw_content_versions(id),
  caption_version_id  uuid references public.mw_content_versions(id),
  snapshot_hash       text not null,
  state               text not null default 'pending' check (state in ('pending', 'approved', 'rejected', 'revision_requested', 'invalidated', 'cancelled')),
  requested_by        uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  closed_at           timestamptz,
  close_reason        text
);
create index if not exists mw_runs_content_idx on public.mw_approval_runs (content_id, created_at desc);

create table if not exists public.mw_approval_steps (
  id        uuid primary key default gen_random_uuid(),
  run_id    uuid not null references public.mw_approval_runs(id) on delete cascade,
  seq       int not null,
  kind      text not null check (kind in ('medical', 'marketing', 'compliance')),
  state     text not null default 'waiting' check (state in ('waiting', 'pending', 'approved', 'rejected', 'revision_requested', 'invalidated', 'cancelled')),
  acted_by  uuid references public.profiles(id) on delete set null,
  acted_at  timestamptz,
  note      text,
  unique (run_id, seq)
);
create index if not exists mw_steps_kind_idx on public.mw_approval_steps (kind, state);

create table if not exists public.mw_consents (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.mw_contents(id) on delete cascade,
  consent_ref  text not null check (length(btrim(consent_ref)) between 1 and 200),  -- MÃ hồ sơ đồng ý (không ghi tên / SĐT / bệnh án)
  scope        text not null check (length(btrim(scope)) between 1 and 500),
  valid_until  date,
  verified_by  uuid references public.profiles(id) on delete set null,
  verified_at  timestamptz,
  revoked_at   timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists mw_consents_content_idx on public.mw_consents (content_id);

create table if not exists public.mw_publications (
  id                 uuid primary key default gen_random_uuid(),
  content_id         uuid not null references public.mw_contents(id) on delete cascade,
  platform           text not null check (platform in ('facebook', 'instagram', 'tiktok', 'youtube', 'zalo', 'website', 'other')),
  caption_version_id uuid references public.mw_content_versions(id),
  asset_version_id   uuid references public.mw_content_versions(id),
  approval_run_id    uuid references public.mw_approval_runs(id),
  scheduled_at       timestamptz,
  -- draft | scheduled (chờ đăng thủ công) | pending_verification | published | blocked | cancelled
  state              text not null default 'draft' check (state in ('draft', 'scheduled', 'pending_verification', 'published', 'blocked', 'cancelled')),
  proof_url          text check (proof_url is null or proof_url ~ '^https?://'),
  proof_by           uuid references public.profiles(id) on delete set null,
  proof_at           timestamptz,
  verified_by        uuid references public.profiles(id) on delete set null,
  verified_at        timestamptz,
  last_error         text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists mw_pubs_content_idx on public.mw_publications (content_id);
create index if not exists mw_pubs_state_idx on public.mw_publications (state, scheduled_at);

-- ---------- Liên kết về workspace ----------
create or replace function public.mw_board_ws(p_board uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from mw_boards where id = p_board; $$;
create or replace function public.mw_task_ws(p_task uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select b.workspace_id from mw_tasks t join mw_boards b on b.id = t.board_id where t.id = p_task; $$;
create or replace function public.mw_content_ws(p_content uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from mw_contents where id = p_content; $$;
-- Người duyệt xem được nội dung ĐANG gửi cho loại duyệt của mình (kể cả không là thành viên workspace)
create or replace function public.mw_reviewer_can_view_content(p_content uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mw_me_active() and exists (
    select 1 from mw_approval_runs r join mw_approval_steps s on s.run_id = r.id
    join mw_reviewers v on v.kind = s.kind and v.user_id = auth.uid()
    where r.content_id = p_content);
$$;

-- ---------- Nhật ký + thông báo (gọi từ trigger / RPC) ----------
create or replace function public.mw_log(p_ws uuid, p_task uuid, p_entity text, p_entity_id text, p_action text, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  -- bỏ qua khi workspace / thẻ đã bị xoá dây chuyền (cascade) -> không làm hỏng lệnh xoá gốc
  insert into mw_activity (workspace_id, task_id, entity, entity_id, action, actor_id, detail)
  select p_ws, (select t.id from mw_tasks t where t.id = p_task), p_entity, p_entity_id, p_action, auth.uid(), coalesce(p_detail, '{}'::jsonb)
  where p_ws is not null and exists (select 1 from mw_workspaces w where w.id = p_ws);
$$;

create or replace function public.mw_notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  if to_regclass('public.notifications') is null then return; end if;
  insert into notifications (user_id, actor_id, type, title, body, link)
  values (p_user, auth.uid(), p_type, left(p_title, 200), left(p_body, 500), p_link);
end $$;

-- Cờ "đang chạy trong RPC hệ thống" — trigger chặn đổi trạng thái được bảo vệ từ PATCH trực tiếp
create or replace function public.mw_in_rpc() returns boolean
language sql stable as $$ select coalesce(current_setting('mw.rpc', true), '') = 'on'; $$;

-- ---------- Trigger bảng ----------
create or replace function public.mw_touch() returns trigger language plpgsql as $$
begin NEW.updated_at := now(); return NEW; end $$;

create or replace function public.mw_ws_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.id is distinct from OLD.id or NEW.owner_id is distinct from OLD.owner_id or NEW.created_at is distinct from OLD.created_at then
    raise exception 'Không được đổi chủ / mã workspace' using errcode = '42501';
  end if;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists mw_ws_guard on public.mw_workspaces;
create trigger mw_ws_guard before update on public.mw_workspaces for each row execute function public.mw_ws_guard();

create or replace function public.mw_member_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from mw_workspaces where id = coalesce(NEW.workspace_id, OLD.workspace_id);
  if TG_OP in ('INSERT', 'UPDATE') then
    if not exists (select 1 from profiles p where p.id = NEW.user_id and coalesce(p.is_active, true)) then
      raise exception 'Nhân sự không tồn tại hoặc đã nghỉ' using errcode = '22023';
    end if;
    if NEW.role = 'owner' and NEW.user_id <> v_owner then
      raise exception 'Chỉ chủ workspace mang vai trò owner' using errcode = '22023';
    end if;
    -- Chỉ owner / admin được cấp vai trò manager
    if NEW.role = 'manager' and not coalesce(public.mw_ws_role(NEW.workspace_id) in ('owner', 'admin'), false) and NEW.user_id <> v_owner then
      raise exception 'Chỉ chủ workspace / Admin cấp được vai trò Quản lý' using errcode = '42501';
    end if;
    if TG_OP = 'INSERT' then NEW.added_by := auth.uid(); end if;
  end if;
  if TG_OP in ('UPDATE', 'DELETE') and OLD.user_id = v_owner and (TG_OP = 'DELETE' or NEW.role <> 'owner') then
    raise exception 'Không thể gỡ / hạ quyền chủ workspace' using errcode = '42501';
  end if;
  perform public.mw_log(coalesce(NEW.workspace_id, OLD.workspace_id), null, 'member', coalesce(NEW.user_id, OLD.user_id)::text,
    lower(TG_OP), jsonb_build_object('role', coalesce(NEW.role, OLD.role), 'old_role', case when TG_OP = 'UPDATE' then OLD.role end));
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists mw_member_guard on public.mw_members;
create trigger mw_member_guard before insert or update or delete on public.mw_members for each row execute function public.mw_member_guard();

drop trigger if exists mw_boards_touch on public.mw_boards;
create trigger mw_boards_touch before update on public.mw_boards for each row execute function public.mw_touch();
drop trigger if exists mw_campaigns_touch on public.mw_campaigns;
create trigger mw_campaigns_touch before update on public.mw_campaigns for each row execute function public.mw_touch();

create or replace function public.mw_board_guard() returns trigger language plpgsql as $$
begin
  if NEW.workspace_id is distinct from OLD.workspace_id then raise exception 'Không được chuyển board sang workspace khác' using errcode = '42501'; end if;
  return NEW;
end $$;
drop trigger if exists mw_board_guard on public.mw_boards;
create trigger mw_board_guard before update on public.mw_boards for each row execute function public.mw_board_guard();

create or replace function public.mw_list_guard() returns trigger language plpgsql as $$
begin
  if NEW.board_id is distinct from OLD.board_id then raise exception 'Không được chuyển cột sang board khác' using errcode = '42501'; end if;
  return NEW;
end $$;
drop trigger if exists mw_list_guard on public.mw_lists;
create trigger mw_list_guard before update on public.mw_lists for each row execute function public.mw_list_guard();

-- Thẻ: version tăng mỗi lần sửa, không đổi board / người tạo; completed_at theo cột "Hoàn thành"; nhật ký
create or replace function public.mw_task_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_done boolean; v_ws uuid; v_changed text[] := '{}';
begin
  if TG_OP = 'INSERT' then
    NEW.created_by := auth.uid();
    NEW.version := 1;
    if NEW.sort_index = 0 then
      select coalesce(max(sort_index), 0) + 1024 into NEW.sort_index from mw_tasks where list_id = NEW.list_id;
    end if;
  else
    if NEW.id is distinct from OLD.id or NEW.created_by is distinct from OLD.created_by or NEW.created_at is distinct from OLD.created_at then
      raise exception 'Không được đổi mã / người tạo thẻ' using errcode = '42501';
    end if;
    if NEW.board_id is distinct from OLD.board_id and not public.mw_in_rpc() then
      raise exception 'Chuyển thẻ sang board khác phải dùng chức năng Di chuyển' using errcode = '42501';
    end if;
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  end if;
  if NEW.list_id is distinct from (case when TG_OP = 'UPDATE' then OLD.list_id end) then
    select is_done into v_done from mw_lists where id = NEW.list_id and board_id = NEW.board_id and archived_at is null;
    if v_done is null then raise exception 'Cột không tồn tại hoặc đã lưu trữ' using errcode = '22023'; end if;
    NEW.completed_at := case when v_done then now() else null end;
  end if;
  return NEW;
end $$;
drop trigger if exists mw_task_guard on public.mw_tasks;
create trigger mw_task_guard before insert or update on public.mw_tasks for each row execute function public.mw_task_guard();

create or replace function public.mw_task_after() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid := public.mw_board_ws(NEW.board_id); v_fields text[] := '{}'; v_from text; v_to text;
begin
  if TG_OP = 'INSERT' then
    perform public.mw_log(v_ws, NEW.id, 'task', NEW.id::text, 'created', jsonb_build_object('title', NEW.title, 'list_id', NEW.list_id));
    return NEW;
  end if;
  if NEW.title is distinct from OLD.title then v_fields := array_append(v_fields, 'title'); end if;
  if NEW.description is distinct from OLD.description then v_fields := array_append(v_fields, 'description'); end if;
  if NEW.priority is distinct from OLD.priority then v_fields := array_append(v_fields, 'priority'); end if;
  if NEW.start_at is distinct from OLD.start_at then v_fields := array_append(v_fields, 'start_at'); end if;
  if NEW.due_at is distinct from OLD.due_at then v_fields := array_append(v_fields, 'due_at'); end if;
  if NEW.cover_color is distinct from OLD.cover_color then v_fields := array_append(v_fields, 'cover_color'); end if;
  if NEW.estimate_hours is distinct from OLD.estimate_hours then v_fields := array_append(v_fields, 'estimate_hours'); end if;
  if NEW.list_id is distinct from OLD.list_id or NEW.board_id is distinct from OLD.board_id then
    select name into v_from from mw_lists where id = OLD.list_id;
    select name into v_to from mw_lists where id = NEW.list_id;
    perform public.mw_log(v_ws, NEW.id, 'task', NEW.id::text, 'moved',
      jsonb_build_object('from', v_from, 'to', v_to, 'from_board', OLD.board_id, 'to_board', NEW.board_id));
  end if;
  if NEW.archived_at is distinct from OLD.archived_at then
    perform public.mw_log(v_ws, NEW.id, 'task', NEW.id::text, case when NEW.archived_at is null then 'restored' else 'archived' end, '{}'::jsonb);
  end if;
  if array_length(v_fields, 1) > 0 then
    perform public.mw_log(v_ws, NEW.id, 'task', NEW.id::text, 'updated',
      jsonb_build_object('fields', to_jsonb(v_fields), 'due_at', case when 'due_at' = any(v_fields) then NEW.due_at end));
  end if;
  return NEW;
end $$;
drop trigger if exists mw_task_after on public.mw_tasks;
create trigger mw_task_after after insert or update on public.mw_tasks for each row execute function public.mw_task_after();

-- Người phụ trách phải là thành viên workspace; báo cho người được giao
create or replace function public.mw_assignee_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid := public.mw_task_ws(coalesce(NEW.task_id, OLD.task_id)); v_title text;
begin
  if TG_OP = 'INSERT' then
    if not exists (select 1 from mw_members m where m.workspace_id = v_ws and m.user_id = NEW.user_id)
       and not exists (select 1 from mw_workspaces w where w.id = v_ws and w.owner_id = NEW.user_id) then
      raise exception 'Người được giao phải là thành viên workspace' using errcode = '22023';
    end if;
    NEW.added_by := auth.uid();
    select title into v_title from mw_tasks where id = NEW.task_id;
    perform public.mw_notify(NEW.user_id, 'mw_assigned', 'Bạn được giao việc Marketing', v_title, 'mkt_workspace#task:' || NEW.task_id);
    perform public.mw_log(v_ws, NEW.task_id, 'assignee', NEW.user_id::text, 'added', '{}'::jsonb);
    return NEW;
  end if;
  perform public.mw_log(v_ws, OLD.task_id, 'assignee', OLD.user_id::text, 'removed', '{}'::jsonb);
  return OLD;
end $$;
drop trigger if exists mw_assignee_guard on public.mw_task_assignees;
create trigger mw_assignee_guard before insert or delete on public.mw_task_assignees for each row execute function public.mw_assignee_guard();

create or replace function public.mw_watcher_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid := public.mw_task_ws(NEW.task_id);
begin
  if not exists (select 1 from mw_members m where m.workspace_id = v_ws and m.user_id = NEW.user_id)
     and not exists (select 1 from mw_workspaces w where w.id = v_ws and w.owner_id = NEW.user_id) then
    raise exception 'Người theo dõi phải là thành viên workspace' using errcode = '22023';
  end if;
  return NEW;
end $$;
drop trigger if exists mw_watcher_guard on public.mw_task_watchers;
create trigger mw_watcher_guard before insert on public.mw_task_watchers for each row execute function public.mw_watcher_guard();

create or replace function public.mw_label_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    perform public.mw_log(public.mw_task_ws(OLD.task_id), OLD.task_id, 'label', OLD.label_id::text, 'removed', '{}'::jsonb);
    return OLD;
  end if;
  if not exists (select 1 from mw_labels l where l.id = NEW.label_id and l.workspace_id = public.mw_task_ws(NEW.task_id)) then
    raise exception 'Nhãn không thuộc workspace của thẻ' using errcode = '22023';
  end if;
  perform public.mw_log(public.mw_task_ws(NEW.task_id), NEW.task_id, 'label', NEW.label_id::text, 'added', '{}'::jsonb);
  return NEW;
end $$;
drop trigger if exists mw_label_guard on public.mw_task_labels;
create trigger mw_label_guard before insert or delete on public.mw_task_labels for each row execute function public.mw_label_guard();

create or replace function public.mw_check_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid := public.mw_task_ws(NEW.task_id);
begin
  if NEW.assignee_id is not null and (TG_OP = 'INSERT' or NEW.assignee_id is distinct from OLD.assignee_id)
     and not exists (select 1 from mw_members m where m.workspace_id = v_ws and m.user_id = NEW.assignee_id)
     and not exists (select 1 from mw_workspaces w where w.id = v_ws and w.owner_id = NEW.assignee_id) then
    raise exception 'Người phụ trách mục checklist phải là thành viên workspace' using errcode = '22023';
  end if;
  if TG_OP = 'UPDATE' and NEW.task_id is distinct from OLD.task_id then raise exception 'Không được chuyển mục sang thẻ khác' using errcode = '42501'; end if;
  if NEW.done and (TG_OP = 'INSERT' or not OLD.done) then NEW.done_by := auth.uid(); NEW.done_at := now(); end if;
  if not NEW.done then NEW.done_by := null; NEW.done_at := null; end if;
  if TG_OP = 'INSERT' and NEW.assignee_id is not null then
    perform public.mw_notify(NEW.assignee_id, 'mw_check_assigned', 'Bạn được giao mục checklist', NEW.title, 'mkt_workspace#task:' || NEW.task_id);
  end if;
  if TG_OP = 'INSERT' then
    perform public.mw_log(v_ws, NEW.task_id, 'checklist', NEW.id::text, 'added', jsonb_build_object('title', NEW.title));
  elsif NEW.done is distinct from OLD.done then
    perform public.mw_log(v_ws, NEW.task_id, 'checklist', NEW.id::text, case when NEW.done then 'checked' else 'unchecked' end, jsonb_build_object('title', NEW.title));
  elsif NEW.title is distinct from OLD.title or NEW.assignee_id is distinct from OLD.assignee_id or NEW.due_at is distinct from OLD.due_at then
    perform public.mw_log(v_ws, NEW.task_id, 'checklist', NEW.id::text, 'updated', jsonb_build_object('title', NEW.title));
  end if;
  return NEW;
end $$;
drop trigger if exists mw_check_guard on public.mw_checklist_items;
create trigger mw_check_guard before insert or update on public.mw_checklist_items for each row execute function public.mw_check_guard();

-- Bình luận: chỉ tác giả sửa nội dung / xoá mềm; @nhắc tên -> thông báo 1 lần cho người XEM ĐƯỢC workspace
create or replace function public.mw_comment_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid := public.mw_task_ws(NEW.task_id); v_uid uuid; v_title text;
begin
  if TG_OP = 'INSERT' then
    NEW.author_id := auth.uid(); NEW.edited_at := null; NEW.deleted_at := null;
    select title into v_title from mw_tasks where id = NEW.task_id;
    for v_uid in
      select distinct (r.m[1])::uuid from regexp_matches(NEW.body, '@\[[^\]]+\]\(staff:([0-9a-fA-F-]{36})\)', 'g') as r(m)
    loop
      if exists (select 1 from mw_members mm where mm.workspace_id = v_ws and mm.user_id = v_uid)
         or exists (select 1 from mw_workspaces w where w.id = v_ws and w.owner_id = v_uid) then
        perform public.mw_notify(v_uid, 'mw_mention', 'Bạn được nhắc trong thẻ Marketing', v_title, 'mkt_workspace#task:' || NEW.task_id);
      end if;
    end loop;
    perform public.mw_log(v_ws, NEW.task_id, 'comment', NEW.id::text, 'created', '{}'::jsonb);
    return NEW;
  end if;
  if NEW.author_id is distinct from OLD.author_id or NEW.task_id is distinct from OLD.task_id or NEW.created_at is distinct from OLD.created_at then
    raise exception 'Không được đổi tác giả / thẻ của bình luận' using errcode = '42501';
  end if;
  if OLD.deleted_at is not null then raise exception 'Bình luận đã xoá' using errcode = '42501'; end if;
  if NEW.body is distinct from OLD.body then NEW.edited_at := now(); end if;
  perform public.mw_log(v_ws, NEW.task_id, 'comment', NEW.id::text, case when NEW.deleted_at is not null then 'deleted' else 'edited' end,
    jsonb_build_object('old_body', left(OLD.body, 2000)));
  return NEW;
end $$;
drop trigger if exists mw_comment_guard on public.mw_comments;
create trigger mw_comment_guard before insert or update on public.mw_comments for each row execute function public.mw_comment_guard();

create or replace function public.mw_attachment_log() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.uploaded_by := auth.uid();
    perform public.mw_log(public.mw_task_ws(NEW.task_id), NEW.task_id, 'attachment', NEW.id::text, 'added', jsonb_build_object('name', NEW.name));
    return NEW;
  end if;
  perform public.mw_log(public.mw_task_ws(OLD.task_id), OLD.task_id, 'attachment', OLD.id::text, 'removed', jsonb_build_object('name', OLD.name, 'url', OLD.url));
  return OLD;
end $$;
drop trigger if exists mw_attachment_log on public.mw_attachments;
create trigger mw_attachment_log before insert or delete on public.mw_attachments for each row execute function public.mw_attachment_log();

-- Nội dung: trạng thái được bảo vệ chỉ đổi qua RPC
create or replace function public.mw_content_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_protected text[] := array['in_review', 'revision_required', 'rejected', 'approved', 'published'];
begin
  if TG_OP = 'INSERT' then
    NEW.created_by := auth.uid();
    if NEW.workflow_status = any(v_protected) then raise exception 'Trạng thái này chỉ do hệ thống duyệt đặt' using errcode = '42501'; end if;
    if NEW.campaign_id is not null and not exists (select 1 from mw_campaigns c where c.id = NEW.campaign_id and c.workspace_id = NEW.workspace_id) then
      raise exception 'Chiến dịch không thuộc workspace' using errcode = '22023'; end if;
    if NEW.task_id is not null and public.mw_task_ws(NEW.task_id) is distinct from NEW.workspace_id then
      raise exception 'Thẻ không thuộc workspace' using errcode = '22023'; end if;
    return NEW;
  end if;
  if NEW.workspace_id is distinct from OLD.workspace_id or NEW.created_by is distinct from OLD.created_by then
    raise exception 'Không được đổi workspace / người tạo' using errcode = '42501'; end if;
  if not public.mw_in_rpc() then
    if NEW.workflow_status is distinct from OLD.workflow_status
       and (NEW.workflow_status = any(v_protected) or OLD.workflow_status = any(v_protected)) then
      raise exception 'Trạng thái duyệt / xuất bản chỉ đổi qua quy trình duyệt' using errcode = '42501'; end if;
    -- Đổi yêu cầu duyệt chuyên môn / consent khi đang trong quy trình duyệt -> không cho
    if (NEW.medical_review_required is distinct from OLD.medical_review_required or NEW.consent_required is distinct from OLD.consent_required)
       and OLD.workflow_status = any(v_protected) then
      raise exception 'Không đổi điều kiện duyệt khi nội dung đang / đã duyệt' using errcode = '42501'; end if;
  end if;
  if NEW.campaign_id is distinct from OLD.campaign_id and NEW.campaign_id is not null
     and not exists (select 1 from mw_campaigns c where c.id = NEW.campaign_id and c.workspace_id = NEW.workspace_id) then
    raise exception 'Chiến dịch không thuộc workspace' using errcode = '22023'; end if;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists mw_content_guard on public.mw_contents;
create trigger mw_content_guard before insert or update on public.mw_contents for each row execute function public.mw_content_guard();

-- Phiên bản: số revision tự tăng; phiên bản mới -> duyệt cũ mất hiệu lực, lịch đăng bị khoá
create or replace function public.mw_version_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  NEW.author_id := auth.uid();
  perform pg_advisory_xact_lock(hashtext(NEW.content_id::text || NEW.kind));
  select coalesce(max(revision), 0) + 1 into NEW.revision from mw_content_versions where content_id = NEW.content_id and kind = NEW.kind;
  NEW.created_at := now();
  return NEW;
end $$;
drop trigger if exists mw_version_before on public.mw_content_versions;
create trigger mw_version_before before insert on public.mw_content_versions for each row execute function public.mw_version_before();

create or replace function public.mw_version_after() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid := public.mw_content_ws(NEW.content_id); v_n int;
begin
  perform set_config('mw.rpc', 'on', true);
  with inv as (
    update mw_approval_runs r set state = 'invalidated', closed_at = now(),
      close_reason = 'Có phiên bản ' || NEW.kind || ' mới (r' || NEW.revision || ')'
    where r.content_id = NEW.content_id and r.state in ('pending', 'approved')
    returning r.id)
  select count(*) into v_n from inv;
  update mw_approval_steps s set state = 'invalidated'
    where s.state in ('waiting', 'pending') and s.run_id in (select id from mw_approval_runs where content_id = NEW.content_id and state = 'invalidated');
  update mw_publications set state = 'blocked', last_error = 'Duyệt cũ mất hiệu lực do có phiên bản ' || NEW.kind || ' mới — cần gửi duyệt lại'
    where content_id = NEW.content_id and state in ('scheduled', 'pending_verification');
  if v_n > 0 then
    update mw_contents set workflow_status = 'revision_required' where id = NEW.content_id and workflow_status in ('in_review', 'approved');
  end if;
  perform set_config('mw.rpc', '', true);
  perform public.mw_log(v_ws, null, 'content_version', NEW.id::text, 'created',
    jsonb_build_object('content_id', NEW.content_id, 'kind', NEW.kind, 'revision', NEW.revision, 'sha256', NEW.sha256, 'invalidated_runs', v_n));
  return NEW;
end $$;
drop trigger if exists mw_version_after on public.mw_content_versions;
create trigger mw_version_after after insert on public.mw_content_versions for each row execute function public.mw_version_after();

create or replace function public.mw_consent_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.created_by := auth.uid(); NEW.verified_by := null; NEW.verified_at := null; NEW.revoked_at := null;
  else
    if not public.mw_in_rpc() and (NEW.verified_by is distinct from OLD.verified_by or NEW.verified_at is distinct from OLD.verified_at
       or NEW.consent_ref is distinct from OLD.consent_ref or NEW.scope is distinct from OLD.scope
       or NEW.valid_until is distinct from OLD.valid_until or NEW.content_id is distinct from OLD.content_id
       or (OLD.revoked_at is not null and NEW.revoked_at is distinct from OLD.revoked_at)) then
      raise exception 'Consent chỉ được thu hồi; xác minh qua quy trình kiểm duyệt' using errcode = '42501';
    end if;
  end if;
  perform public.mw_log(public.mw_content_ws(NEW.content_id), null, 'consent', NEW.id::text,
    case when TG_OP = 'INSERT' then 'created' when NEW.revoked_at is not null and OLD.revoked_at is null then 'revoked'
         when NEW.verified_at is not null and OLD.verified_at is null then 'verified' else 'updated' end,
    jsonb_build_object('content_id', NEW.content_id));
  if TG_OP = 'UPDATE' and NEW.revoked_at is not null and OLD.revoked_at is null then
    perform set_config('mw.rpc', 'on', true);
    update mw_publications set state = 'blocked', last_error = 'Consent đã bị thu hồi'
      where content_id = NEW.content_id and state in ('scheduled', 'pending_verification');
    perform set_config('mw.rpc', '', true);
  end if;
  return NEW;
end $$;
drop trigger if exists mw_consent_guard on public.mw_consents;
create trigger mw_consent_guard before insert or update on public.mw_consents for each row execute function public.mw_consent_guard();

create or replace function public.mw_pub_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.created_by := auth.uid();
    if NEW.state <> 'draft' then raise exception 'Bài đăng mới phải ở trạng thái Nháp' using errcode = '42501'; end if;
    NEW.proof_url := null; NEW.proof_by := null; NEW.proof_at := null; NEW.verified_by := null; NEW.verified_at := null; NEW.approval_run_id := null;
  elsif not public.mw_in_rpc() then
    if NEW.state is distinct from OLD.state or NEW.proof_url is distinct from OLD.proof_url or NEW.proof_by is distinct from OLD.proof_by
       or NEW.verified_by is distinct from OLD.verified_by or NEW.verified_at is distinct from OLD.verified_at
       or NEW.approval_run_id is distinct from OLD.approval_run_id or NEW.content_id is distinct from OLD.content_id then
      raise exception 'Trạng thái xuất bản chỉ đổi qua chức năng Lên lịch / Xác minh' using errcode = '42501';
    end if;
    if OLD.state not in ('draft', 'blocked') then
      raise exception 'Chỉ sửa được bài ở trạng thái Nháp / Bị chặn' using errcode = '42501';
    end if;
  end if;
  if NEW.caption_version_id is not null and not exists (select 1 from mw_content_versions v where v.id = NEW.caption_version_id and v.content_id = NEW.content_id and v.kind = 'caption') then
    raise exception 'Caption không thuộc nội dung này' using errcode = '22023'; end if;
  if NEW.asset_version_id is not null and not exists (select 1 from mw_content_versions v where v.id = NEW.asset_version_id and v.content_id = NEW.content_id and v.kind = 'asset') then
    raise exception 'Tệp không thuộc nội dung này' using errcode = '22023'; end if;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists mw_pub_guard on public.mw_publications;
create trigger mw_pub_guard before insert or update on public.mw_publications for each row execute function public.mw_pub_guard();

-- ---------- RLS ----------
alter table public.mw_workspaces enable row level security;
alter table public.mw_members enable row level security;
alter table public.mw_boards enable row level security;
alter table public.mw_lists enable row level security;
alter table public.mw_labels enable row level security;
alter table public.mw_tasks enable row level security;
alter table public.mw_task_assignees enable row level security;
alter table public.mw_task_watchers enable row level security;
alter table public.mw_task_labels enable row level security;
alter table public.mw_checklist_items enable row level security;
alter table public.mw_comments enable row level security;
alter table public.mw_attachments enable row level security;
alter table public.mw_activity enable row level security;
alter table public.mw_reviewers enable row level security;
alter table public.mw_campaigns enable row level security;
alter table public.mw_contents enable row level security;
alter table public.mw_content_versions enable row level security;
alter table public.mw_approval_runs enable row level security;
alter table public.mw_approval_steps enable row level security;
alter table public.mw_consents enable row level security;
alter table public.mw_publications enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'mw\_%' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Workspace: tạo qua RPC (kiểm tra tổ chức / vai trò), không có policy insert
create policy mw_ws_sel on public.mw_workspaces for select to authenticated using (public.mw_can_view_ws(id));
create policy mw_ws_upd on public.mw_workspaces for update to authenticated using (public.mw_can_manage_ws(id)) with check (public.mw_can_manage_ws(id));

create policy mw_mem_sel on public.mw_members for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_mem_ins on public.mw_members for insert to authenticated with check (public.mw_can_manage_ws(workspace_id));
create policy mw_mem_upd on public.mw_members for update to authenticated using (public.mw_can_manage_ws(workspace_id)) with check (public.mw_can_manage_ws(workspace_id));
create policy mw_mem_del on public.mw_members for delete to authenticated using (public.mw_can_manage_ws(workspace_id));

create policy mw_board_sel on public.mw_boards for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_board_ins on public.mw_boards for insert to authenticated with check (public.mw_can_manage_ws(workspace_id) and created_by = auth.uid());
create policy mw_board_upd on public.mw_boards for update to authenticated using (public.mw_can_manage_ws(workspace_id)) with check (public.mw_can_manage_ws(workspace_id));

create policy mw_list_sel on public.mw_lists for select to authenticated using (public.mw_can_view_ws(public.mw_board_ws(board_id)));
create policy mw_list_ins on public.mw_lists for insert to authenticated with check (public.mw_can_manage_ws(public.mw_board_ws(board_id)));
create policy mw_list_upd on public.mw_lists for update to authenticated using (public.mw_can_manage_ws(public.mw_board_ws(board_id))) with check (public.mw_can_manage_ws(public.mw_board_ws(board_id)));

create policy mw_label_sel on public.mw_labels for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_label_ins on public.mw_labels for insert to authenticated with check (public.mw_can_edit_ws(workspace_id));
create policy mw_label_upd on public.mw_labels for update to authenticated using (public.mw_can_edit_ws(workspace_id)) with check (public.mw_can_edit_ws(workspace_id));
create policy mw_label_del on public.mw_labels for delete to authenticated using (public.mw_can_manage_ws(workspace_id));

create policy mw_task_sel on public.mw_tasks for select to authenticated using (public.mw_can_view_ws(public.mw_board_ws(board_id)));
create policy mw_task_ins on public.mw_tasks for insert to authenticated with check (public.mw_can_edit_ws(public.mw_board_ws(board_id)));
create policy mw_task_upd on public.mw_tasks for update to authenticated using (public.mw_can_edit_ws(public.mw_board_ws(board_id))) with check (public.mw_can_edit_ws(public.mw_board_ws(board_id)));

create policy mw_asg_sel on public.mw_task_assignees for select to authenticated using (public.mw_can_view_ws(public.mw_task_ws(task_id)));
create policy mw_asg_ins on public.mw_task_assignees for insert to authenticated with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_asg_del on public.mw_task_assignees for delete to authenticated using (public.mw_can_edit_ws(public.mw_task_ws(task_id)));

create policy mw_wat_sel on public.mw_task_watchers for select to authenticated using (public.mw_can_view_ws(public.mw_task_ws(task_id)));
-- Tự theo dõi / bỏ theo dõi; người sửa được thẻ thêm người khác
create policy mw_wat_ins on public.mw_task_watchers for insert to authenticated with check (
  (user_id = auth.uid() and public.mw_can_view_ws(public.mw_task_ws(task_id))) or public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_wat_del on public.mw_task_watchers for delete to authenticated using (
  (user_id = auth.uid() and public.mw_can_view_ws(public.mw_task_ws(task_id))) or public.mw_can_edit_ws(public.mw_task_ws(task_id)));

create policy mw_tl_sel on public.mw_task_labels for select to authenticated using (public.mw_can_view_ws(public.mw_task_ws(task_id)));
create policy mw_tl_ins on public.mw_task_labels for insert to authenticated with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_tl_del on public.mw_task_labels for delete to authenticated using (public.mw_can_edit_ws(public.mw_task_ws(task_id)));

create policy mw_chk_sel on public.mw_checklist_items for select to authenticated using (public.mw_can_view_ws(public.mw_task_ws(task_id)));
create policy mw_chk_ins on public.mw_checklist_items for insert to authenticated with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_chk_upd on public.mw_checklist_items for update to authenticated using (public.mw_can_edit_ws(public.mw_task_ws(task_id))) with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_chk_del on public.mw_checklist_items for delete to authenticated using (public.mw_can_edit_ws(public.mw_task_ws(task_id)));

create policy mw_cmt_sel on public.mw_comments for select to authenticated using (public.mw_can_view_ws(public.mw_task_ws(task_id)));
create policy mw_cmt_ins on public.mw_comments for insert to authenticated with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_cmt_upd on public.mw_comments for update to authenticated using (author_id = auth.uid() and public.mw_can_edit_ws(public.mw_task_ws(task_id))) with check (author_id = auth.uid());

create policy mw_att_sel on public.mw_attachments for select to authenticated using (public.mw_can_view_ws(public.mw_task_ws(task_id)));
create policy mw_att_ins on public.mw_attachments for insert to authenticated with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_att_del on public.mw_attachments for delete to authenticated using (
  public.mw_can_manage_ws(public.mw_task_ws(task_id)) or (uploaded_by = auth.uid() and public.mw_can_edit_ws(public.mw_task_ws(task_id))));

create policy mw_act_sel on public.mw_activity for select to authenticated using (public.mw_can_view_ws(workspace_id));

create policy mw_rev_sel on public.mw_reviewers for select to authenticated using (public.mw_me_active());
create policy mw_rev_ins on public.mw_reviewers for insert to authenticated with check (public.mw_is_admin());
create policy mw_rev_del on public.mw_reviewers for delete to authenticated using (public.mw_is_admin());

create policy mw_camp_sel on public.mw_campaigns for select to authenticated using (public.mw_can_view_ws(workspace_id));
create policy mw_camp_ins on public.mw_campaigns for insert to authenticated with check (public.mw_can_manage_ws(workspace_id));
create policy mw_camp_upd on public.mw_campaigns for update to authenticated using (public.mw_can_manage_ws(workspace_id)) with check (public.mw_can_manage_ws(workspace_id));

create policy mw_cnt_sel on public.mw_contents for select to authenticated using (public.mw_can_view_ws(workspace_id) or public.mw_reviewer_can_view_content(id));
create policy mw_cnt_ins on public.mw_contents for insert to authenticated with check (public.mw_can_edit_ws(workspace_id));
create policy mw_cnt_upd on public.mw_contents for update to authenticated using (public.mw_can_edit_ws(workspace_id)) with check (public.mw_can_edit_ws(workspace_id));

create policy mw_ver_sel on public.mw_content_versions for select to authenticated using (
  public.mw_can_view_ws(public.mw_content_ws(content_id)) or public.mw_reviewer_can_view_content(content_id));
create policy mw_ver_ins on public.mw_content_versions for insert to authenticated with check (public.mw_can_edit_ws(public.mw_content_ws(content_id)));
-- Không có policy update / delete: phiên bản bất biến

create policy mw_run_sel on public.mw_approval_runs for select to authenticated using (
  public.mw_can_view_ws(public.mw_content_ws(content_id)) or public.mw_reviewer_can_view_content(content_id));
create policy mw_step_sel on public.mw_approval_steps for select to authenticated using (exists (
  select 1 from public.mw_approval_runs r where r.id = run_id
  and (public.mw_can_view_ws(public.mw_content_ws(r.content_id)) or public.mw_reviewer_can_view_content(r.content_id))));

create policy mw_cons_sel on public.mw_consents for select to authenticated using (
  public.mw_can_view_ws(public.mw_content_ws(content_id)) or public.mw_reviewer_can_view_content(content_id));
create policy mw_cons_ins on public.mw_consents for insert to authenticated with check (public.mw_can_edit_ws(public.mw_content_ws(content_id)));
create policy mw_cons_upd on public.mw_consents for update to authenticated using (
  public.mw_can_manage_ws(public.mw_content_ws(content_id))
  or (public.mw_is_reviewer('compliance') and (public.mw_can_view_ws(public.mw_content_ws(content_id)) or public.mw_reviewer_can_view_content(content_id))))
  with check (public.mw_can_manage_ws(public.mw_content_ws(content_id))
  or (public.mw_is_reviewer('compliance') and (public.mw_can_view_ws(public.mw_content_ws(content_id)) or public.mw_reviewer_can_view_content(content_id))));

create policy mw_pub_sel on public.mw_publications for select to authenticated using (public.mw_can_view_ws(public.mw_content_ws(content_id)));
create policy mw_pub_ins on public.mw_publications for insert to authenticated with check (public.mw_can_edit_ws(public.mw_content_ws(content_id)));
create policy mw_pub_upd on public.mw_publications for update to authenticated using (public.mw_can_edit_ws(public.mw_content_ws(content_id))) with check (public.mw_can_edit_ws(public.mw_content_ws(content_id)));

grant select, insert, update, delete on public.mw_workspaces, public.mw_members, public.mw_boards, public.mw_lists, public.mw_labels,
  public.mw_tasks, public.mw_task_assignees, public.mw_task_watchers, public.mw_task_labels, public.mw_checklist_items, public.mw_comments,
  public.mw_attachments, public.mw_reviewers, public.mw_campaigns, public.mw_contents, public.mw_content_versions, public.mw_consents,
  public.mw_publications to authenticated;
grant select on public.mw_activity, public.mw_approval_runs, public.mw_approval_steps to authenticated;
revoke all on public.mw_workspaces, public.mw_members, public.mw_boards, public.mw_lists, public.mw_labels, public.mw_tasks,
  public.mw_task_assignees, public.mw_task_watchers, public.mw_task_labels, public.mw_checklist_items, public.mw_comments, public.mw_attachments,
  public.mw_activity, public.mw_reviewers, public.mw_campaigns, public.mw_contents, public.mw_content_versions, public.mw_approval_runs,
  public.mw_approval_steps, public.mw_consents, public.mw_publications from anon;
grant usage on sequence public.mw_activity_id_seq to authenticated;

-- ---------- RPC ----------
-- Tạo workspace: tài khoản đang hoạt động + (Admin hoặc vai trò Marketing). Người tạo là chủ.
create or replace function public.mw_create_workspace(p_name text, p_description text default null, p_color text default '#087F83')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.mw_me_active() then raise exception 'Chưa đăng nhập hoặc tài khoản đã khoá' using errcode = '42501'; end if;
  if not (public.mw_is_admin() or public.mw_has_app_role('marketing')) then
    raise exception 'Chỉ Admin hoặc Marketing được tạo workspace' using errcode = '42501'; end if;
  insert into mw_workspaces (name, description, color, owner_id) values (btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_color, '#087F83'), auth.uid())
  returning id into v_id;
  insert into mw_members (workspace_id, user_id, role) values (v_id, auth.uid(), 'owner');
  perform public.mw_log(v_id, null, 'workspace', v_id::text, 'created', jsonb_build_object('name', p_name));
  return v_id;
end $$;

-- Tạo board theo mẫu (cột sẵn)
create or replace function public.mw_create_board(p_ws uuid, p_name text, p_template text default 'blank')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cols text[]; v_done text[]; i int;
begin
  if not public.mw_can_manage_ws(p_ws) then raise exception 'Không có quyền tạo board trong workspace này' using errcode = '42501'; end if;
  v_cols := case p_template
    when 'video' then array['Ý tưởng', 'Chờ brief', 'Viết kịch bản', 'Chờ duyệt kịch bản', 'Lên lịch quay', 'Đang quay', 'Đang dựng', 'Chờ duyệt', 'Cần sửa', 'Sẵn sàng đăng', 'Đã đăng', 'Đo hiệu quả']
    when 'design' then array['Brief mới', 'Thiết kế', 'Review', 'Chỉnh sửa', 'Final', 'Đã giao']
    when 'campaign' then array['Kế hoạch', 'Nghiên cứu', 'Sản xuất', 'Review', 'Đang chạy', 'Báo cáo']
    when 'seo' then array['Backlog', 'Dàn ý', 'Đang viết', 'Kiểm chứng y khoa', 'SEO QA', 'Đăng', 'Theo dõi']
    when 'ads' then array['Đề xuất', 'Kiểm tra pháp lý', 'Duyệt ngân sách', 'Creative', 'QA', 'Chạy', 'Tối ưu', 'Báo cáo']
    when 'event' then array['Đề xuất sự kiện', 'Đã duyệt', 'Lên kế hoạch', 'Hậu cần', 'Đang diễn ra', 'Tổng kết']
    else array['Cần làm', 'Đang làm', 'Chờ duyệt', 'Hoàn thành'] end;
  v_done := array['Hoàn thành', 'Đã đăng', 'Đã giao', 'Báo cáo', 'Tổng kết', 'Theo dõi', 'Đo hiệu quả'];
  insert into mw_boards (workspace_id, name, template, created_by, sort_index)
  values (p_ws, btrim(p_name), coalesce(p_template, 'blank'), auth.uid(),
          (select coalesce(max(sort_index), 0) + 1024 from mw_boards where workspace_id = p_ws))
  returning id into v_id;
  for i in 1..array_length(v_cols, 1) loop
    insert into mw_lists (board_id, name, sort_index, is_done) values (v_id, v_cols[i], i * 1024, v_cols[i] = any(v_done));
  end loop;
  perform public.mw_log(p_ws, null, 'board', v_id::text, 'created', jsonb_build_object('name', p_name, 'template', p_template));
  return v_id;
end $$;

-- Di chuyển thẻ (cùng board hoặc sang board khác cùng workspace). Kiểm tra quyền, phiên bản (xung đột),
-- giới hạn WIP; vị trí = giữa thẻ trước và thẻ sau (p_after_task = thẻ đứng trên; null = lên đầu cột).
create or replace function public.mw_move_task(p_task uuid, p_list uuid, p_after_task uuid, p_expected_version int)
returns table (task_id uuid, version int, list_id uuid, board_id uuid, sort_index numeric)
language plpgsql security invoker set search_path = public as $$
declare v_t mw_tasks%rowtype; v_board uuid; v_wip int; v_cnt int; v_prev numeric; v_next numeric; v_pos numeric; v_ws_from uuid; v_ws_to uuid;
begin
  select * into v_t from mw_tasks t where t.id = p_task for update;
  if not found then raise exception 'Không tìm thấy thẻ hoặc không có quyền' using errcode = '42501'; end if;
  if v_t.version <> p_expected_version then raise exception 'Xung đột: thẻ vừa được người khác thay đổi, hãy tải lại' using errcode = '40001'; end if;
  select l.board_id, l.wip_limit into v_board, v_wip from mw_lists l where l.id = p_list and l.archived_at is null;
  if v_board is null then raise exception 'Cột không tồn tại hoặc đã lưu trữ' using errcode = '22023'; end if;
  v_ws_from := public.mw_board_ws(v_t.board_id); v_ws_to := public.mw_board_ws(v_board);
  if not public.mw_can_edit_ws(v_ws_from) or not public.mw_can_edit_ws(v_ws_to) then raise exception 'Không có quyền di chuyển thẻ' using errcode = '42501'; end if;
  if v_ws_from <> v_ws_to then raise exception 'Chỉ di chuyển trong cùng workspace' using errcode = '22023'; end if;
  if v_wip is not null and p_list <> v_t.list_id then
    select count(*) into v_cnt from mw_tasks t where t.list_id = p_list and t.archived_at is null;
    if v_cnt >= v_wip then raise exception 'Cột đã đạt giới hạn % thẻ (WIP)', v_wip using errcode = '23514'; end if;
  end if;
  if p_after_task is null then
    select min(t.sort_index) into v_next from mw_tasks t where t.list_id = p_list and t.id <> p_task;
    v_pos := coalesce(v_next, 2048) - 1024;
  else
    select t.sort_index into v_prev from mw_tasks t where t.id = p_after_task and t.list_id = p_list;
    if v_prev is null then raise exception 'Vị trí thả không hợp lệ' using errcode = '22023'; end if;
    select min(t.sort_index) into v_next from mw_tasks t where t.list_id = p_list and t.sort_index > v_prev and t.id <> p_task;
    v_pos := case when v_next is null then v_prev + 1024 else (v_prev + v_next) / 2 end;
  end if;
  perform set_config('mw.rpc', 'on', true);
  if v_board <> v_t.board_id then
    -- sang board khác: bỏ nhãn không cùng workspace (cùng workspace nên giữ được)
    update mw_tasks t set board_id = v_board, list_id = p_list, sort_index = v_pos where t.id = p_task;
  else
    update mw_tasks t set list_id = p_list, sort_index = v_pos where t.id = p_task;
  end if;
  perform set_config('mw.rpc', '', true);
  return query select t.id, t.version, t.list_id, t.board_id, t.sort_index from mw_tasks t where t.id = p_task;
end $$;

-- Sao chép thẻ (không mang người duyệt / trạng thái duyệt)
create or replace function public.mw_copy_task(p_task uuid, p_list uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_t mw_tasks%rowtype; v_new uuid;
begin
  select * into v_t from mw_tasks where id = p_task;
  if not found then raise exception 'Không tìm thấy thẻ hoặc không có quyền' using errcode = '42501'; end if;
  insert into mw_tasks (board_id, list_id, title, description, priority, start_at, due_at, cover_color, estimate_hours)
  values (v_t.board_id, coalesce(p_list, v_t.list_id), left(v_t.title || ' (bản sao)', 300), v_t.description, v_t.priority, v_t.start_at, v_t.due_at, v_t.cover_color, v_t.estimate_hours)
  returning id into v_new;
  insert into mw_checklist_items (task_id, title, sort_index) select v_new, title, sort_index from mw_checklist_items where task_id = p_task;
  insert into mw_task_labels (task_id, label_id) select v_new, label_id from mw_task_labels where task_id = p_task;
  return v_new;
end $$;

-- Phiên bản mới nhất từng loại của nội dung
create or replace function public.mw_latest_version(p_content uuid, p_kind text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from mw_content_versions where content_id = p_content and kind = p_kind order by revision desc limit 1;
$$;

create or replace function public.mw_snapshot_hash(p_script uuid, p_asset uuid, p_caption uuid) returns text
language sql stable security definer set search_path = public as $$
  select encode(sha256(convert_to(coalesce(string_agg(v.kind || ':' || v.revision || ':' || coalesce(v.sha256, encode(sha256(convert_to(coalesce(v.body, ''), 'UTF8')), 'hex')), '|' order by v.kind), ''), 'UTF8')), 'hex')
  from mw_content_versions v where v.id in (p_script, p_asset, p_caption);
$$;

-- Gửi duyệt: chốt ĐÚNG phiên bản kịch bản / tệp / caption mới nhất. Bước: chuyên môn (nếu cần) -> marketing -> kiểm duyệt.
create or replace function public.mw_submit_approval(p_content uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_c mw_contents%rowtype; v_s uuid; v_a uuid; v_cap uuid; v_run uuid; v_seq int := 0; v_kind text; v_rv uuid;
begin
  select * into v_c from mw_contents where id = p_content for update;
  if not found or not public.mw_can_edit_ws(v_c.workspace_id) then raise exception 'Không có quyền gửi duyệt nội dung này' using errcode = '42501'; end if;
  -- Đã đăng 1 kênh vẫn gửi duyệt lại được (bản mới cho kênh khác); chỉ chặn nội dung đã lưu trữ
  if v_c.workflow_status = 'archived' then raise exception 'Nội dung đã lưu trữ' using errcode = '22023'; end if;
  v_s := public.mw_latest_version(p_content, 'script');
  v_a := public.mw_latest_version(p_content, 'asset');
  v_cap := public.mw_latest_version(p_content, 'caption');
  if v_s is null and v_a is null then raise exception 'Cần ít nhất 1 phiên bản kịch bản hoặc tệp media trước khi gửi duyệt' using errcode = '22023'; end if;
  if v_cap is null then raise exception 'Cần có caption trước khi gửi duyệt' using errcode = '22023'; end if;
  perform set_config('mw.rpc', 'on', true);
  update mw_approval_runs set state = 'cancelled', closed_at = now(), close_reason = 'Gửi duyệt lại' where content_id = p_content and state = 'pending';
  update mw_approval_steps set state = 'cancelled' where state in ('waiting', 'pending') and run_id in (select id from mw_approval_runs where content_id = p_content and state = 'cancelled');
  insert into mw_approval_runs (content_id, script_version_id, asset_version_id, caption_version_id, snapshot_hash, requested_by)
  values (p_content, v_s, v_a, v_cap, public.mw_snapshot_hash(v_s, v_a, v_cap), auth.uid()) returning id into v_run;
  foreach v_kind in array (case when v_c.medical_review_required then array['medical', 'marketing', 'compliance'] else array['marketing', 'compliance'] end) loop
    v_seq := v_seq + 1;
    insert into mw_approval_steps (run_id, seq, kind, state) values (v_run, v_seq, v_kind, case when v_seq = 1 then 'pending' else 'waiting' end);
  end loop;
  update mw_contents set workflow_status = 'in_review' where id = p_content;
  perform set_config('mw.rpc', '', true);
  -- báo người duyệt bước đầu
  for v_rv in select r.user_id from mw_reviewers r where r.kind = (case when v_c.medical_review_required then 'medical' else 'marketing' end) loop
    perform public.mw_notify(v_rv, 'mw_approval', 'Có nội dung chờ bạn duyệt', v_c.title, 'mkt_workspace#approval:' || v_run);
  end loop;
  perform public.mw_log(v_c.workspace_id, v_c.task_id, 'approval', v_run::text, 'submitted',
    jsonb_build_object('content_id', p_content, 'script', v_s, 'asset', v_a, 'caption', v_cap));
  return v_run;
end $$;

-- Consent hợp lệ (đã xác minh, chưa thu hồi, còn hạn)
create or replace function public.mw_consent_ok(p_content uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from mw_consents c where c.content_id = p_content and c.verified_at is not null
                 and c.revoked_at is null and (c.valid_until is null or c.valid_until >= (now() at time zone 'Asia/Ho_Chi_Minh')::date));
$$;

-- Duyệt 1 bước: đúng loại người duyệt, đúng bước đang chờ, snapshot còn là bản mới nhất
create or replace function public.mw_review_step(p_step uuid, p_decision text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_s mw_approval_steps%rowtype; v_r mw_approval_runs%rowtype; v_c mw_contents%rowtype; v_next mw_approval_steps%rowtype; v_rv uuid;
begin
  if p_decision not in ('approve', 'revision', 'reject') then raise exception 'Quyết định không hợp lệ' using errcode = '22023'; end if;
  select * into v_s from mw_approval_steps where id = p_step for update;
  if not found then raise exception 'Không tìm thấy bước duyệt' using errcode = '42501'; end if;
  if not public.mw_is_reviewer(v_s.kind) then raise exception 'Bạn không được cấp quyền duyệt loại này' using errcode = '42501'; end if;
  select * into v_r from mw_approval_runs where id = v_s.run_id for update;
  if v_r.state <> 'pending' or v_s.state <> 'pending' then raise exception 'Bước này không còn chờ duyệt' using errcode = '22023'; end if;
  select * into v_c from mw_contents where id = v_r.content_id;
  if p_decision <> 'approve' and coalesce(btrim(p_note), '') = '' then raise exception 'Cần ghi lý do khi trả lại / từ chối' using errcode = '22023'; end if;
  perform set_config('mw.rpc', 'on', true);
  -- Snapshot phải còn là phiên bản mới nhất (không duyệt âm thầm bản đã bị thay)
  if v_r.script_version_id is distinct from public.mw_latest_version(v_r.content_id, 'script')
     or v_r.asset_version_id is distinct from public.mw_latest_version(v_r.content_id, 'asset')
     or v_r.caption_version_id is distinct from public.mw_latest_version(v_r.content_id, 'caption') then
    update mw_approval_runs set state = 'invalidated', closed_at = now(), close_reason = 'Phiên bản đã thay đổi' where id = v_r.id;
    update mw_approval_steps set state = 'invalidated' where run_id = v_r.id and state in ('waiting', 'pending');
    perform set_config('mw.rpc', '', true);
    return 'invalidated';
  end if;
  if p_decision = 'approve' and v_s.kind = 'compliance' and v_c.consent_required and not public.mw_consent_ok(v_c.id) then
    perform set_config('mw.rpc', '', true);
    raise exception 'Chưa có consent đã xác minh, còn hạn cho nội dung này' using errcode = '22023';
  end if;
  update mw_approval_steps set state = case p_decision when 'approve' then 'approved' when 'revision' then 'revision_requested' else 'rejected' end,
    acted_by = auth.uid(), acted_at = now(), note = nullif(btrim(p_note), '') where id = p_step;
  if p_decision = 'approve' then
    select * into v_next from mw_approval_steps where run_id = v_r.id and seq > v_s.seq order by seq limit 1;
    if found then
      update mw_approval_steps set state = 'pending' where id = v_next.id;
      for v_rv in select user_id from mw_reviewers where kind = v_next.kind loop
        perform public.mw_notify(v_rv, 'mw_approval', 'Có nội dung chờ bạn duyệt', v_c.title, 'mkt_workspace#approval:' || v_r.id);
      end loop;
    else
      update mw_approval_runs set state = 'approved', closed_at = now() where id = v_r.id;
      update mw_contents set workflow_status = 'approved' where id = v_c.id;
      perform public.mw_notify(v_r.requested_by, 'mw_approved', 'Nội dung đã được duyệt đủ bước', v_c.title, 'mkt_workspace#approval:' || v_r.id);
    end if;
  else
    update mw_approval_runs set state = case p_decision when 'revision' then 'revision_requested' else 'rejected' end, closed_at = now(), close_reason = p_note where id = v_r.id;
    update mw_approval_steps set state = 'cancelled' where run_id = v_r.id and state = 'waiting';
    update mw_contents set workflow_status = case p_decision when 'revision' then 'revision_required' else 'rejected' end where id = v_c.id;
    perform public.mw_notify(v_r.requested_by, 'mw_returned', case p_decision when 'revision' then 'Nội dung bị yêu cầu sửa' else 'Nội dung bị từ chối' end,
      v_c.title || ' — ' || p_note, 'mkt_workspace#approval:' || v_r.id);
  end if;
  perform set_config('mw.rpc', '', true);
  perform public.mw_log(v_c.workspace_id, v_c.task_id, 'approval_step', p_step::text, p_decision,
    jsonb_build_object('run_id', v_r.id, 'kind', v_s.kind, 'snapshot_hash', v_r.snapshot_hash, 'note', p_note));
  return p_decision;
end $$;

-- Xác minh consent (người kiểm duyệt compliance)
create or replace function public.mw_verify_consent(p_consent uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c mw_consents%rowtype;
begin
  if not public.mw_is_reviewer('compliance') then raise exception 'Chỉ người kiểm duyệt (compliance) xác minh consent' using errcode = '42501'; end if;
  select * into v_c from mw_consents where id = p_consent for update;
  -- chỉ xác minh consent của nội dung mình được xem (thành viên hoặc đang có lượt duyệt gửi tới loại của mình)
  if not found or not (public.mw_can_view_ws(public.mw_content_ws(v_c.content_id)) or public.mw_reviewer_can_view_content(v_c.content_id)) then
    raise exception 'Consent không tồn tại' using errcode = '42501'; end if;
  if v_c.revoked_at is not null then raise exception 'Consent đã thu hồi' using errcode = '22023'; end if;
  perform set_config('mw.rpc', 'on', true);
  update mw_consents set verified_by = auth.uid(), verified_at = now() where id = p_consent;
  perform set_config('mw.rpc', '', true);
end $$;

-- Điều kiện đăng: duyệt đủ bước trên ĐÚNG bản mới nhất + caption / tệp của bài đăng thuộc snapshot + consent (nếu cần)
create or replace function public.mw_publication_gate(p_pub uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_p mw_publications%rowtype; v_c mw_contents%rowtype; v_r mw_approval_runs%rowtype;
begin
  select * into v_p from mw_publications where id = p_pub;
  if not found then return 'Không tìm thấy bài đăng'; end if;
  select * into v_c from mw_contents where id = v_p.content_id;
  if not public.mw_can_view_ws(v_c.workspace_id) then return 'Không tìm thấy bài đăng'; end if;
  select * into v_r from mw_approval_runs where content_id = v_c.id and state = 'approved' order by created_at desc limit 1;
  if not found then return 'Nội dung chưa được duyệt đủ bước'; end if;
  if v_r.script_version_id is distinct from public.mw_latest_version(v_c.id, 'script')
     or v_r.asset_version_id is distinct from public.mw_latest_version(v_c.id, 'asset')
     or v_r.caption_version_id is distinct from public.mw_latest_version(v_c.id, 'caption') then
    return 'Đã có phiên bản mới sau khi duyệt — cần duyệt lại'; end if;
  if v_p.caption_version_id is distinct from v_r.caption_version_id then return 'Caption của bài đăng khác caption đã duyệt'; end if;
  if v_p.asset_version_id is not null and v_p.asset_version_id is distinct from v_r.asset_version_id then return 'Tệp của bài đăng khác tệp đã duyệt'; end if;
  if v_c.consent_required and not public.mw_consent_ok(v_c.id) then return 'Thiếu consent hợp lệ (đã xác minh, còn hạn, chưa thu hồi)'; end if;
  return null;
end $$;

create or replace function public.mw_can_publish(p_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mw_can_manage_ws(p_ws) or (public.mw_is_reviewer('publisher') and public.mw_can_view_ws(p_ws));
$$;

-- Lên lịch: chưa có kết nối API mạng xã hội -> lịch đăng THỦ CÔNG (nhắc người đăng), không tự đăng
create or replace function public.mw_schedule_publication(p_pub uuid, p_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare v_p mw_publications%rowtype; v_ws uuid; v_gate text; v_run uuid;
begin
  select * into v_p from mw_publications where id = p_pub for update;
  if not found then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  v_ws := public.mw_content_ws(v_p.content_id);
  if not public.mw_can_view_ws(v_ws) then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  if not public.mw_can_publish(v_ws) then raise exception 'Không có quyền lên lịch đăng' using errcode = '42501'; end if;
  if v_p.state not in ('draft', 'blocked') then raise exception 'Bài đăng không ở trạng thái Nháp / Bị chặn' using errcode = '22023'; end if;
  if p_at is null then raise exception 'Chưa chọn thời gian đăng' using errcode = '22023'; end if;
  v_gate := public.mw_publication_gate(p_pub);
  perform set_config('mw.rpc', 'on', true);
  if v_gate is not null then
    update mw_publications set state = 'blocked', last_error = v_gate where id = p_pub;
    perform set_config('mw.rpc', '', true);
    perform public.mw_log(v_ws, null, 'publication', p_pub::text, 'blocked', jsonb_build_object('reason', v_gate));
    return v_gate;
  end if;
  select id into v_run from mw_approval_runs where content_id = v_p.content_id and state = 'approved' order by created_at desc limit 1;
  update mw_publications set state = 'scheduled', scheduled_at = p_at, approval_run_id = v_run, last_error = null where id = p_pub;
  perform set_config('mw.rpc', '', true);
  perform public.mw_log(v_ws, null, 'publication', p_pub::text, 'scheduled', jsonb_build_object('at', p_at, 'run_id', v_run, 'mode', 'manual'));
  return null;
end $$;

-- Người đăng nộp link bài đã đăng thủ công (kiểm tra lại điều kiện)
create or replace function public.mw_submit_publish_proof(p_pub uuid, p_url text)
returns text language plpgsql security definer set search_path = public as $$
declare v_p mw_publications%rowtype; v_ws uuid; v_gate text;
begin
  select * into v_p from mw_publications where id = p_pub for update;
  if not found then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  v_ws := public.mw_content_ws(v_p.content_id);
  if not public.mw_can_view_ws(v_ws) then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  if not public.mw_can_publish(v_ws) then raise exception 'Không có quyền đăng bài' using errcode = '42501'; end if;
  if v_p.state <> 'scheduled' then raise exception 'Bài phải ở trạng thái Chờ đăng' using errcode = '22023'; end if;
  if p_url !~ '^https?://[^ ]+\.[^ ]+' then raise exception 'Link bằng chứng không hợp lệ' using errcode = '22023'; end if;
  v_gate := public.mw_publication_gate(p_pub);
  perform set_config('mw.rpc', 'on', true);
  if v_gate is not null then
    update mw_publications set state = 'blocked', last_error = v_gate where id = p_pub;
    perform set_config('mw.rpc', '', true);
    return v_gate;
  end if;
  update mw_publications set state = 'pending_verification', proof_url = p_url, proof_by = auth.uid(), proof_at = now() where id = p_pub;
  perform set_config('mw.rpc', '', true);
  perform public.mw_log(v_ws, null, 'publication', p_pub::text, 'proof_submitted', jsonb_build_object('url', p_url));
  return null;
end $$;

-- Người KHÁC xác minh link -> Đã đăng; hoặc trả về Chờ đăng kèm lý do
create or replace function public.mw_verify_publication(p_pub uuid, p_ok boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_p mw_publications%rowtype; v_ws uuid;
begin
  select * into v_p from mw_publications where id = p_pub for update;
  if not found then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  v_ws := public.mw_content_ws(v_p.content_id);
  if not public.mw_can_view_ws(v_ws) then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  if not public.mw_can_publish(v_ws) then raise exception 'Không có quyền xác minh' using errcode = '42501'; end if;
  if v_p.state <> 'pending_verification' then raise exception 'Bài không ở trạng thái Chờ xác minh' using errcode = '22023'; end if;
  if v_p.proof_by = auth.uid() then raise exception 'Người nộp link không tự xác minh được — cần người khác kiểm tra' using errcode = '42501'; end if;
  perform set_config('mw.rpc', 'on', true);
  if p_ok then
    update mw_publications set state = 'published', verified_by = auth.uid(), verified_at = now(), last_error = null where id = p_pub;
    update mw_contents set workflow_status = 'published' where id = v_p.content_id and workflow_status = 'approved';
  else
    if coalesce(btrim(p_note), '') = '' then perform set_config('mw.rpc', '', true); raise exception 'Cần ghi lý do' using errcode = '22023'; end if;
    update mw_publications set state = 'scheduled', proof_url = null, proof_by = null, proof_at = null, last_error = 'Xác minh không đạt: ' || p_note where id = p_pub;
  end if;
  perform set_config('mw.rpc', '', true);
  perform public.mw_log(v_ws, null, 'publication', p_pub::text, case when p_ok then 'verified' else 'verification_failed' end, jsonb_build_object('note', p_note));
end $$;

create or replace function public.mw_cancel_publication(p_pub uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_p mw_publications%rowtype; v_ws uuid;
begin
  select * into v_p from mw_publications where id = p_pub for update;
  if not found then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  v_ws := public.mw_content_ws(v_p.content_id);
  if not public.mw_can_view_ws(v_ws) then raise exception 'Không tìm thấy bài đăng' using errcode = '42501'; end if;
  if not public.mw_can_edit_ws(v_ws) then raise exception 'Không có quyền' using errcode = '42501'; end if;
  if v_p.state = 'published' then raise exception 'Bài đã đăng, không huỷ được trong app' using errcode = '22023'; end if;
  perform set_config('mw.rpc', 'on', true);
  update mw_publications set state = 'cancelled' where id = p_pub;
  perform set_config('mw.rpc', '', true);
  perform public.mw_log(v_ws, null, 'publication', p_pub::text, 'cancelled', '{}'::jsonb);
end $$;

-- Bật / tắt module (Admin)
create or replace function public.mw_set_enabled(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mw_is_admin() then raise exception 'Chỉ Admin bật / tắt Marketing Workspace' using errcode = '42501'; end if;
  insert into clinic_settings (id, mw_enabled) values (true, p_on) on conflict (id) do update set mw_enabled = excluded.mw_enabled;
end $$;

revoke all on function public.mw_create_workspace(text, text, text), public.mw_create_board(uuid, text, text),
  public.mw_move_task(uuid, uuid, uuid, int), public.mw_copy_task(uuid, uuid), public.mw_submit_approval(uuid),
  public.mw_review_step(uuid, text, text), public.mw_verify_consent(uuid), public.mw_schedule_publication(uuid, timestamptz),
  public.mw_submit_publish_proof(uuid, text), public.mw_verify_publication(uuid, boolean, text), public.mw_cancel_publication(uuid),
  public.mw_publication_gate(uuid), public.mw_set_enabled(boolean), public.mw_log(uuid, uuid, text, text, text, jsonb),
  public.mw_notify(uuid, text, text, text, text) from public, anon;
grant execute on function public.mw_create_workspace(text, text, text), public.mw_create_board(uuid, text, text),
  public.mw_move_task(uuid, uuid, uuid, int), public.mw_copy_task(uuid, uuid), public.mw_submit_approval(uuid),
  public.mw_review_step(uuid, text, text), public.mw_verify_consent(uuid), public.mw_schedule_publication(uuid, timestamptz),
  public.mw_submit_publish_proof(uuid, text), public.mw_verify_publication(uuid, boolean, text), public.mw_cancel_publication(uuid),
  public.mw_publication_gate(uuid), public.mw_set_enabled(boolean) to authenticated;
-- mw_log / mw_notify chỉ chạy bên trong trigger / RPC (không cấp cho trình duyệt)

-- Realtime cho các bảng hay đổi
do $$ declare t text; begin
  foreach t in array array['mw_tasks', 'mw_lists', 'mw_comments', 'mw_checklist_items', 'mw_task_assignees', 'mw_approval_steps', 'mw_publications', 'mw_contents'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
end $$;

notify pgrst, 'reload schema';
