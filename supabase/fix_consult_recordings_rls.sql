-- ============================================================
-- SỬA LỖI: "new row violates row-level security policy for table consult_recordings"
-- Nguyên nhân: policy cũ chỉ kiểm tra VAI CHÍNH (current_user_role() = profiles.role).
-- Nhân sự kiêm nhiệm Sale Offline qua role_2 (vai phụ) bấm "Lưu ghi âm" bị chặn.
-- Sửa: kiểm tra CẢ role lẫn role_2 (giống các bảng khác trong hệ thống).
-- Chạy trong Supabase SQL Editor. Idempotent — chạy lại nhiều lần không sao.
-- ============================================================

-- Người đang đăng nhập có 1 trong các vai (role HOẶC role_2)?
create or replace function public.has_any_role(roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.role::text = any(roles) or coalesce(p.role_2::text, '') = any(roles))
  );
$$;
grant execute on function public.has_any_role(text[]) to authenticated;

drop policy if exists "cr_select" on consult_recordings;
create policy "cr_select" on consult_recordings for select using (
  created_by = auth.uid()
  or public.has_any_role(array['admin','accountant','shareholder','sale_offline'])
);

drop policy if exists "cr_insert" on consult_recordings;
create policy "cr_insert" on consult_recordings for insert with check (
  public.has_any_role(array['sale_offline','admin'])
);

drop policy if exists "cr_update" on consult_recordings;
create policy "cr_update" on consult_recordings for update using (
  created_by = auth.uid() or public.has_any_role(array['admin'])
) with check (true);

-- cr_delete giữ nguyên theo consult_recordings_trash.sql (chỉ admin xoá vĩnh viễn)

-- Kiểm tra nhanh sau khi chạy: phải thấy 4 policy của bảng
select policyname, cmd from pg_policies where tablename = 'consult_recordings' order by policyname;
