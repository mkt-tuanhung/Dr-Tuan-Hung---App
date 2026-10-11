-- ============================================================
-- CÔNG VIỆC & DUYỆT (theo Ethics BOS D10 "Vận hành - Quản lý công việc")
-- Chạy 1 lần trong Supabase SQL Editor (chạy lại nhiều lần vẫn an toàn).
--
-- Bảng:
--   tasks          — công việc: tiêu đề, mô tả, người phụ trách, hạn, ưu tiên,
--                    trạng thái (Cần làm → Đang làm → Chờ duyệt → Hoàn thành / Huỷ),
--                    gắn khách (SĐT) / lịch hẹn, lặp lại hằng ngày / tuần / tháng.
--   task_comments  — bình luận + nhật ký đổi trạng thái. CHỈ GHI THÊM
--                    (không có quyền sửa / xoá).
--
-- Ai thấy / làm gì (RLS):
--   Xem ............ người tạo, người phụ trách, Admin (role hoặc role_2 = admin)
--   Tạo ............ mọi tài khoản đang hoạt động (người tạo = chính mình)
--   Sửa ............ người tạo, người phụ trách, Admin
--   Xoá ............ người tạo hoặc Admin, chỉ khi còn "Cần làm" hoặc "Đã huỷ"
--   Bình luận ...... ai xem được công việc thì đọc + viết được (tên mình)
--
-- Tự động ở database:
--   • updated_at luôn cập nhật; người tạo không đổi được sau khi tạo
--   • completed_at = lúc chuyển sang "Hoàn thành" (về null nếu mở lại)
--   • Công việc lặp lại khi "Hoàn thành" → tạo sẵn lần tiếp theo (Cần làm,
--     hạn cộng thêm 1 ngày / tuần / tháng). Mỗi công việc chỉ sinh 1 lần kế tiếp.
--   • Mỗi lần đổi trạng thái → ghi 1 dòng hệ thống vào task_comments (kind = 'status')
-- ============================================================

-- ---------- Bảng công việc ----------
create table if not exists public.tasks (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null check (length(btrim(title)) > 0),
  description            text,
  status                 text not null default 'todo'
                           check (status in ('todo', 'in_progress', 'review', 'done', 'cancelled')),
  priority               text not null default 'normal'
                           check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id            uuid references public.profiles(id) on delete set null,
  created_by             uuid default auth.uid() references public.profiles(id) on delete set null,
  due_at                 timestamptz,
  related_phone          text,
  related_appointment_id uuid,   -- lịch hẹn liên quan (không ràng buộc khoá ngoại)
  recurrence             text check (recurrence in ('daily', 'weekly', 'monthly')),
  recurrence_parent_id   uuid references public.tasks(id) on delete set null,  -- sinh ra từ công việc nào
  next_task_id           uuid references public.tasks(id) on delete set null,  -- lần lặp kế tiếp đã tạo
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_status_idx   on public.tasks (status);
create index if not exists tasks_due_idx      on public.tasks (due_at);
create index if not exists tasks_creator_idx  on public.tasks (created_by);

-- ---------- Bình luận + nhật ký trạng thái (chỉ ghi thêm) ----------
create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid default auth.uid() references public.profiles(id) on delete set null,
  kind        text not null default 'comment' check (kind in ('comment', 'status')),
  body        text not null check (length(btrim(body)) > 0),
  from_status text,
  to_status   text,
  created_at  timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

-- ---------- Hàm kiểm tra quyền (security definer: không vướng RLS của profiles) ----------
create or replace function public.work_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
                 and (p.role::text = 'admin' or p.role_2::text = 'admin'));
$$;

create or replace function public.work_is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.is_active, true));
$$;

grant execute on function public.work_is_admin(), public.work_is_active_user() to authenticated;

-- ---------- Trigger trước khi ghi: updated_at, completed_at, lặp lại ----------
create or replace function public.tasks_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_step interval;
  v_due  timestamptz;
  v_n    int := 0;
  v_next uuid;
begin
  NEW.updated_at := now();
  NEW.title := btrim(NEW.title);

  if TG_OP = 'UPDATE' then
    -- Không cho đổi người tạo / liên kết lặp lại (chỉ cho về null — khoá ngoại
    -- "on delete set null" cần đặt null khi bản ghi kia bị xoá)
    if NEW.created_by is not null and NEW.created_by is distinct from OLD.created_by then
      NEW.created_by := OLD.created_by;
    end if;
    if NEW.recurrence_parent_id is not null and NEW.recurrence_parent_id is distinct from OLD.recurrence_parent_id then
      NEW.recurrence_parent_id := OLD.recurrence_parent_id;
    end if;
    if NEW.next_task_id is not null and NEW.next_task_id is distinct from OLD.next_task_id then
      NEW.next_task_id := OLD.next_task_id;
    end if;
  else
    NEW.next_task_id := null;
    -- Chỉ trigger lặp lại (lồng bên trong) mới được gắn công việc gốc
    if pg_trigger_depth() <= 1 then NEW.recurrence_parent_id := null; end if;
  end if;

  -- Thời điểm hoàn thành
  if NEW.status = 'done' then
    if TG_OP = 'UPDATE' and OLD.status = 'done' then
      NEW.completed_at := coalesce(OLD.completed_at, now());
    else
      NEW.completed_at := now();
    end if;
  else
    NEW.completed_at := null;
  end if;

  -- Công việc lặp lại vừa được hoàn thành -> tạo lần tiếp theo (1 lần duy nhất)
  if TG_OP = 'UPDATE' and NEW.status = 'done' and OLD.status <> 'done'
     and NEW.recurrence is not null and NEW.next_task_id is null then
    v_step := case NEW.recurrence when 'daily' then interval '1 day'
                                  when 'weekly' then interval '7 days'
                                  else interval '1 month' end;
    v_due := coalesce(NEW.due_at, now()) + v_step;
    -- Hạn cũ đã quá xa -> nhảy tới lần gần nhất chưa qua (tối đa 400 bước)
    while v_due < now() and v_n < 400 loop
      v_due := v_due + v_step; v_n := v_n + 1;
    end loop;

    insert into tasks (title, description, status, priority, assignee_id, created_by, due_at,
                       related_phone, recurrence, recurrence_parent_id)
    values (NEW.title, NEW.description, 'todo', NEW.priority, NEW.assignee_id, NEW.created_by, v_due,
            NEW.related_phone, NEW.recurrence, NEW.id)
    returning id into v_next;
    NEW.next_task_id := v_next;
  end if;

  return NEW;
end $$;

drop trigger if exists trg_tasks_before_write on public.tasks;
create trigger trg_tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ---------- Trigger sau khi ghi: nhật ký trạng thái vào task_comments ----------
create or replace function public.tasks_log_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lbl jsonb := '{"todo":"Cần làm","in_progress":"Đang làm","review":"Chờ duyệt","done":"Hoàn thành","cancelled":"Đã huỷ"}';
begin
  if TG_OP = 'INSERT' then
    insert into task_comments (task_id, author_id, kind, body, from_status, to_status)
    values (NEW.id, coalesce(auth.uid(), NEW.created_by), 'status',
            case when NEW.recurrence_parent_id is not null then 'Tạo tự động từ công việc định kỳ'
                 else 'Tạo công việc' end,
            null, NEW.status);
  elsif NEW.status is distinct from OLD.status then
    insert into task_comments (task_id, author_id, kind, body, from_status, to_status)
    values (NEW.id, auth.uid(), 'status',
            'Chuyển trạng thái: ' || coalesce(lbl ->> OLD.status, OLD.status) || ' → ' || coalesce(lbl ->> NEW.status, NEW.status),
            OLD.status, NEW.status);
  end if;
  return null;
end $$;

drop trigger if exists trg_tasks_log_status on public.tasks;
create trigger trg_tasks_log_status after insert or update of status on public.tasks
  for each row execute function public.tasks_log_status();

-- ---------- Quyền (RLS) ----------
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

drop policy if exists tasks_read   on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;

create policy tasks_read on public.tasks for select to authenticated
  using (auth.uid() = created_by or auth.uid() = assignee_id or public.work_is_admin());

create policy tasks_insert on public.tasks for insert to authenticated
  with check (created_by = auth.uid() and public.work_is_active_user());

-- Sau khi sửa vẫn phải là người tạo / người phụ trách / Admin (không "giao đi rồi mất dấu")
create policy tasks_update on public.tasks for update to authenticated
  using (auth.uid() = created_by or auth.uid() = assignee_id or public.work_is_admin())
  with check (auth.uid() = created_by or auth.uid() = assignee_id or public.work_is_admin());

create policy tasks_delete on public.tasks for delete to authenticated
  using ((auth.uid() = created_by or public.work_is_admin()) and status in ('todo', 'cancelled'));

drop policy if exists task_comments_read   on public.task_comments;
drop policy if exists task_comments_insert on public.task_comments;

-- Đọc / viết bình luận khi xem được công việc (truy vấn con chịu RLS của tasks)
create policy task_comments_read on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

-- Người dùng chỉ viết bình luận thường; dòng 'status' do trigger hệ thống ghi
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and kind = 'comment'
              and exists (select 1 from public.tasks t where t.id = task_id));
-- KHÔNG có policy update/delete: bình luận chỉ ghi thêm.

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert on public.task_comments to authenticated;
revoke update, delete, truncate on public.task_comments from authenticated;

-- ---------- Realtime (bỏ qua nếu đã thêm hoặc không có publication) ----------
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_comments;
exception when duplicate_object then null; when undefined_object then null; end $$;
