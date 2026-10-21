-- ============================================================
-- MARKETING WORKSPACE v2 — GẮN SOURCE KHO MEDIA VÀO THẺ + KỊCH BẢN ORDER THEO CẢNH
-- Chạy SAU marketing_workspace_v1.sql (SQL Editor). Chạy lại nhiều lần vẫn an toàn.
--
-- - mw_task_sources: thẻ ↔ nguồn Kho Media (media_customers) / từng file (media_assets). Chỉ lưu LIÊN KẾT.
--   Ai gắn / xem được: người có quyền Kho Media (Media, Editor, Marketing, Admin) VÀ là thành viên workspace.
--   Nguồn đánh dấu "KHÔNG ĐƯỢC SỬ DỤNG HÌNH ẢNH" (no_image) -> database từ chối gắn.
-- - mw_task_scenes: kịch bản order từng cảnh (Hook / Trước / Sau / CTA…) trỏ đúng source + đoạn cắt.
-- - mw_lists.kho_status: thẻ vào cột này -> tự cập nhật trạng thái source bên Kho Media
--   ('dang_dung' = Đang dựng, 'da_dung' = Đã dựng, 'none' = không đổi). Chỉ TIẾN, không lùi.
-- - Nội dung (Content Studio) tạo từ thẻ có source khách -> tự bật "cần consent".
-- Không sửa bảng / policy cũ của Kho Media; chỉ cập nhật cột source_status qua hàm có kiểm tra.
-- ============================================================

-- Người được dùng Kho Media trong Marketing Workspace
create or replace function public.mw_can_use_kho() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.is_active, true)
                 and (p.role::text in ('media', 'editor', 'marketing', 'admin') or coalesce(p.role_2::text, '') in ('media', 'editor', 'marketing', 'admin')));
$$;

-- ---------- Cột: trạng thái Kho khi thẻ vào cột ----------
alter table public.mw_lists add column if not exists kho_status text;
do $$ begin
  alter table public.mw_lists add constraint mw_lists_kho_status_chk check (kho_status is null or kho_status in ('none', 'dang_dung', 'da_dung'));
exception when duplicate_object then null; end $$;

-- Đoán theo tên cột (chỉ khi tạo cột mới / lần đầu cài): "Đang dựng" -> dang_dung; "Đã đăng" / "Đã dựng" / cột hoàn thành -> da_dung
create or replace function public.mw_guess_kho_status(p_name text, p_done boolean) returns text
language sql immutable as $$
  select case
    when p_name ~ '[đĐ]ã [đĐ]ăng|[đĐ]ã [dD]ựng' or coalesce(p_done, false) then 'da_dung'
    when p_name ~ '[đĐ]ang [dD]ựng|^[dD]ựng' then 'dang_dung'
    else 'none'
  end;
$$;
create or replace function public.mw_list_kho_default() returns trigger language plpgsql as $$
begin
  if NEW.kho_status is null then NEW.kho_status := public.mw_guess_kho_status(NEW.name, NEW.is_done); end if;
  return NEW;
end $$;
drop trigger if exists mw_list_kho_default on public.mw_lists;
create trigger mw_list_kho_default before insert on public.mw_lists for each row execute function public.mw_list_kho_default();
-- Cột đã có trước khi cài: điền 1 lần (chỉ cột còn null -> chạy lại không ghi đè lựa chọn của người dùng)
update public.mw_lists set kho_status = public.mw_guess_kho_status(name, is_done) where kho_status is null;

-- ---------- Bảng ----------
create table if not exists public.mw_task_sources (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references public.mw_tasks(id) on delete cascade,
  media_customer_id uuid not null references public.media_customers(id) on delete cascade,
  media_asset_id    uuid references public.media_assets(id) on delete cascade,
  note              text check (note is null or length(note) <= 500),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create unique index if not exists mw_task_sources_uniq on public.mw_task_sources
  (task_id, media_customer_id, coalesce(media_asset_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists mw_task_sources_src_idx on public.mw_task_sources (media_customer_id);

create table if not exists public.mw_task_scenes (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.mw_tasks(id) on delete cascade,
  sort_index  numeric not null default 0,
  scene       text check (scene is null or length(scene) <= 60),
  content     text check (content is null or length(content) <= 2000),
  source_ref  uuid references public.mw_task_sources(id) on delete set null,
  clip_from   text check (clip_from is null or clip_from ~ '^[0-9]{1,2}:[0-5][0-9](:[0-5][0-9])?$'),
  clip_to     text check (clip_to is null or clip_to ~ '^[0-9]{1,2}:[0-5][0-9](:[0-5][0-9])?$'),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists mw_task_scenes_task_idx on public.mw_task_scenes (task_id, sort_index);

-- ---------- Cập nhật trạng thái source bên Kho (chỉ tiến) ----------
create or replace function public.mw_apply_kho_status(p_task uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_status text; v_n int := 0; v_ws uuid;
begin
  select l.kho_status into v_status from mw_tasks t join mw_lists l on l.id = t.list_id where t.id = p_task;
  if v_status is null or v_status not in ('dang_dung', 'da_dung') then return 0; end if;
  update media_customers m set source_status = v_status
   where m.id in (select s.media_customer_id from mw_task_sources s where s.task_id = p_task)
     and (case coalesce(m.source_status, 'chua_dung') when 'da_dung' then 2 when 'dang_dung' then 1 else 0 end)
       < (case v_status when 'da_dung' then 2 else 1 end);
  get diagnostics v_n = row_count;
  if v_n > 0 then
    v_ws := public.mw_task_ws(p_task);
    perform public.mw_log(v_ws, p_task, 'kho', p_task::text, 'source_status', jsonb_build_object('status', v_status, 'count', v_n));
  end if;
  return v_n;
end $$;

create or replace function public.mw_task_kho_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mw_apply_kho_status(NEW.id);
  return NEW;
end $$;
drop trigger if exists mw_task_kho on public.mw_tasks;
create trigger mw_task_kho after update of list_id on public.mw_tasks
  for each row when (OLD.list_id is distinct from NEW.list_id) execute function public.mw_task_kho_trg();

-- ---------- Gắn / gỡ source ----------
create or replace function public.mw_source_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_code text; v_no_image boolean;
begin
  if TG_OP = 'DELETE' then
    perform public.mw_log(public.mw_task_ws(OLD.task_id), OLD.task_id, 'source', OLD.media_customer_id::text, 'removed', '{}'::jsonb);
    return OLD;
  end if;
  NEW.created_by := auth.uid();
  select coalesce(source_id, ''), coalesce(no_image, false) into v_code, v_no_image from media_customers where id = NEW.media_customer_id;
  if not found then raise exception 'Không tìm thấy nguồn trong Kho Media' using errcode = '22023'; end if;
  if v_no_image then raise exception 'Nguồn này đánh dấu KHÔNG ĐƯỢC SỬ DỤNG HÌNH ẢNH — không gắn vào thẻ được' using errcode = '22023'; end if;
  if NEW.media_asset_id is not null and not exists (select 1 from media_assets a where a.id = NEW.media_asset_id and a.media_customer_id = NEW.media_customer_id) then
    raise exception 'File không thuộc nguồn đã chọn' using errcode = '22023';
  end if;
  v_ws := public.mw_task_ws(NEW.task_id);
  perform public.mw_log(v_ws, NEW.task_id, 'source', NEW.media_customer_id::text, 'added', jsonb_build_object('code', v_code, 'asset', NEW.media_asset_id));
  return NEW;
end $$;
drop trigger if exists mw_source_guard on public.mw_task_sources;
create trigger mw_source_guard before insert or delete on public.mw_task_sources for each row execute function public.mw_source_guard();

-- Sau khi gắn: thẻ đang ở cột có kho_status -> cập nhật luôn; nội dung của thẻ -> cần consent
create or replace function public.mw_source_after() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mw_apply_kho_status(NEW.task_id);
  update mw_contents set consent_required = true
   where task_id = NEW.task_id and not consent_required
     and workflow_status in ('idea', 'brief', 'scripting', 'production', 'editing');
  return NEW;
end $$;
drop trigger if exists mw_source_after on public.mw_task_sources;
create trigger mw_source_after after insert on public.mw_task_sources for each row execute function public.mw_source_after();

-- Nội dung tạo từ thẻ có source khách hàng -> bắt buộc consent
create or replace function public.mw_content_src() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.task_id is not null and exists (select 1 from mw_task_sources s where s.task_id = NEW.task_id) then
    NEW.consent_required := true;
  end if;
  return NEW;
end $$;
drop trigger if exists mw_content_src on public.mw_contents;
create trigger mw_content_src before insert on public.mw_contents for each row execute function public.mw_content_src();

create or replace function public.mw_scene_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then NEW.created_by := auth.uid(); end if;
  if TG_OP = 'UPDATE' and NEW.task_id is distinct from OLD.task_id then raise exception 'Không chuyển cảnh sang thẻ khác' using errcode = '42501'; end if;
  if NEW.source_ref is not null and not exists (select 1 from mw_task_sources s where s.id = NEW.source_ref and s.task_id = NEW.task_id) then
    raise exception 'Source của cảnh phải là source đã gắn vào thẻ này' using errcode = '22023';
  end if;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists mw_scene_guard on public.mw_task_scenes;
create trigger mw_scene_guard before insert or update on public.mw_task_scenes for each row execute function public.mw_scene_guard();

-- ---------- RLS ----------
alter table public.mw_task_sources enable row level security;
alter table public.mw_task_scenes enable row level security;
drop policy if exists mw_src_sel on public.mw_task_sources;
drop policy if exists mw_src_ins on public.mw_task_sources;
drop policy if exists mw_src_del on public.mw_task_sources;
create policy mw_src_sel on public.mw_task_sources for select to authenticated using (public.mw_can_use_kho() and public.mw_can_view_ws(public.mw_task_ws(task_id)));
create policy mw_src_ins on public.mw_task_sources for insert to authenticated with check (public.mw_can_use_kho() and public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_src_del on public.mw_task_sources for delete to authenticated using (public.mw_can_use_kho() and public.mw_can_edit_ws(public.mw_task_ws(task_id)));
drop policy if exists mw_scene_sel on public.mw_task_scenes;
drop policy if exists mw_scene_ins on public.mw_task_scenes;
drop policy if exists mw_scene_upd on public.mw_task_scenes;
drop policy if exists mw_scene_del on public.mw_task_scenes;
create policy mw_scene_sel on public.mw_task_scenes for select to authenticated using (public.mw_can_view_ws(public.mw_task_ws(task_id)));
create policy mw_scene_ins on public.mw_task_scenes for insert to authenticated with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_scene_upd on public.mw_task_scenes for update to authenticated using (public.mw_can_edit_ws(public.mw_task_ws(task_id))) with check (public.mw_can_edit_ws(public.mw_task_ws(task_id)));
create policy mw_scene_del on public.mw_task_scenes for delete to authenticated using (public.mw_can_edit_ws(public.mw_task_ws(task_id)));

grant select, insert, delete on public.mw_task_sources to authenticated;
grant select, insert, update, delete on public.mw_task_scenes to authenticated;
revoke all on public.mw_task_sources, public.mw_task_scenes from anon;
revoke all on function public.mw_apply_kho_status(uuid) from public, anon, authenticated;
grant execute on function public.mw_can_use_kho() to authenticated;

notify pgrst, 'reload schema';
