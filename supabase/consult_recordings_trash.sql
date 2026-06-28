-- ============================================================
-- Ghi âm tư vấn: xoá mềm + duyệt xoá (Sale xin xoá -> admin duyệt) + thùng rác
-- ============================================================
alter table consult_recordings
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references profiles(id) on delete set null,
  add column if not exists delete_requested_by uuid references profiles(id) on delete set null,
  add column if not exists delete_requested_at timestamptz;

-- Xoá vĩnh viễn (hard delete) CHỈ admin
drop policy if exists "cr_delete" on consult_recordings;
create policy "cr_delete" on consult_recordings for delete using (public.current_user_role()::text = 'admin');

-- Chặn non-admin đổi deleted_at (chỉ admin được xoá mềm / khôi phục)
create or replace function guard_consult_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.deleted_at is distinct from old.deleted_at) and public.current_user_role()::text <> 'admin' then
    raise exception 'Chỉ admin được xoá hoặc khôi phục ghi âm';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_consult_delete on consult_recordings;
create trigger trg_guard_consult_delete before update on consult_recordings
  for each row execute function guard_consult_delete();

-- Sale gửi yêu cầu xoá -> báo admin (in-app + Telegram)
create or replace function notify_consult_delete_req() returns trigger language plpgsql security definer set search_path = public as $$
declare reqname text;
begin
  if new.delete_requested_by is not null and old.delete_requested_by is null then
    select full_name into reqname from profiles where id = new.delete_requested_by;
    perform notify_relevant(new.delete_requested_by, 'consult_delete_req',
      'Yêu cầu xoá ghi âm tư vấn',
      coalesce(reqname, 'Sale') || ' xin xoá 1 ghi âm tư vấn — cần admin duyệt.',
      'khach_tu_van', array[]::text[]);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_consult_delete_req on consult_recordings;
create trigger trg_notify_consult_delete_req after update on consult_recordings
  for each row execute function notify_consult_delete_req();
