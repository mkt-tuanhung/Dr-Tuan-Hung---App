-- ============================================================
-- PHÂN QUYỀN THEO VAI TRÒ (kiểu Ethics BOS) — chạy 1 lần trong SQL Editor
--
-- role_permissions : các ô Admin GHI ĐÈ so với quyền mặc định trong code.
--                    Bảng trống = mọi người thấy menu y hệt trước đây.
-- permission_audit : nhật ký cấp / thu hồi quyền — CHỈ GHI THÊM, không sửa/xoá.
--
-- Lưu ý: bảng này điều khiển MENU CHỨC NĂNG nhân sự nhìn thấy. Dữ liệu bên
-- trong từng chức năng vẫn được bảo vệ bởi chính sách RLS theo vai trò sẵn có.
-- ============================================================

create table if not exists public.role_permissions (
  role        text not null,
  module      text not null,
  granted     boolean not null,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (role, module)
);

create table if not exists public.permission_audit (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null check (action in ('grant', 'revoke', 'reset')),
  role        text not null,
  module      text not null,
  before_val  boolean,
  after_val   boolean,
  reason      text not null check (length(trim(reason)) >= 5),
  created_at  timestamptz not null default now()
);
create index if not exists permission_audit_created_idx on public.permission_audit (created_at desc);

alter table public.role_permissions enable row level security;
alter table public.permission_audit enable row level security;

-- Ai đăng nhập cũng đọc được (để app biết hiện menu nào)
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);

-- Chỉ Admin được thêm / sửa / xoá ô ghi đè
drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_admin_write on public.role_permissions
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Nhật ký: Admin đọc + ghi thêm; KHÔNG có policy update/delete => không ai sửa/xoá được
drop policy if exists permission_audit_admin_read on public.permission_audit;
create policy permission_audit_admin_read on public.permission_audit
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists permission_audit_admin_insert on public.permission_audit;
create policy permission_audit_admin_insert on public.permission_audit
  for insert to authenticated
  with check (actor_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Bật realtime để menu nhân sự tự cập nhật khi Admin đổi quyền
do $$ begin
  alter publication supabase_realtime add table public.role_permissions;
exception when duplicate_object then null; end $$;
