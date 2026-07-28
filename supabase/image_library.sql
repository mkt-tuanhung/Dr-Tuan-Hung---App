-- ============================================================
-- Thư viện Hình ảnh (như Google Drive): cây thư mục + file ảnh (R2).
-- Chạy 1 lần, an toàn chạy lại.
-- ============================================================
create table if not exists image_folders (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references image_folders(id) on delete cascade,   -- null = thư mục gốc
  name text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_imgf_parent on image_folders(parent_id);

create table if not exists image_assets (
  id uuid default gen_random_uuid() primary key,
  folder_id uuid references image_folders(id) on delete cascade,   -- null = ở gốc
  name text,
  url text not null,
  size bigint,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_imga_folder on image_assets(folder_id);

alter table image_folders enable row level security;
alter table image_assets  enable row level security;

-- Ai được GHI (tạo/sửa/xoá): designer, editor, media, marketing, admin — hoặc người tạo
create or replace function public.can_manage_images()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p where p.id = auth.uid()
      and (p.role = any(array['designer','editor','media','marketing','admin'])
        or p.role_2 = any(array['designer','editor','media','marketing','admin']))
  );
$$;

drop policy if exists imgf_read on image_folders;
create policy imgf_read on image_folders for select to authenticated using (true);
drop policy if exists imgf_write on image_folders;
create policy imgf_write on image_folders for all to authenticated
  using (public.can_manage_images() or created_by = auth.uid())
  with check (public.can_manage_images() or created_by = auth.uid());

drop policy if exists imga_read on image_assets;
create policy imga_read on image_assets for select to authenticated using (true);
drop policy if exists imga_write on image_assets;
create policy imga_write on image_assets for all to authenticated
  using (public.can_manage_images() or created_by = auth.uid())
  with check (public.can_manage_images() or created_by = auth.uid());

grant select, insert, update, delete on image_folders, image_assets to authenticated;

-- Realtime (bỏ qua nếu đã thêm)
do $$ begin
  begin alter publication supabase_realtime add table image_folders; exception when others then null; end;
  begin alter publication supabase_realtime add table image_assets;  exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
