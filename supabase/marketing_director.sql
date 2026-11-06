-- ============================================================
-- GIÁM ĐỐC MARKETING — quản lý toàn bộ Video Ads như Admin (chạy lại vẫn an toàn)
--
-- Giám đốc Marketing = nhân sự đang làm, vai trò (role hoặc role_2) 'marketing' VÀ chức vụ (position) 'Giám đốc'.
-- Bổ sung quyền (cộng thêm, không bớt quyền cũ của ai):
--   media_clips     : xem / tạo / sửa / XOÁ mọi clip (trước: Marketing không tạo / xoá được)
--   media_customers : xem / sửa / XOÁ mọi thẻ khách media
-- App: trang Video Ads coi Giám đốc Marketing như Admin (sửa / xoá clip, thống kê, chỉ số quản lý).
-- ============================================================

create or replace function public.is_marketing_director()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and coalesce(p.is_active, true)
      and (p.role::text = 'marketing' or p.role_2::text = 'marketing')
      and p.position = 'Giám đốc'
  )
$$;
revoke all on function public.is_marketing_director() from public;
grant execute on function public.is_marketing_director() to authenticated;

drop policy if exists "mktdir_clip_all" on public.media_clips;
create policy "mktdir_clip_all" on public.media_clips for all to authenticated
  using (public.is_marketing_director()) with check (public.is_marketing_director());

drop policy if exists "mktdir_mc_all" on public.media_customers;
create policy "mktdir_mc_all" on public.media_customers for all to authenticated
  using (public.is_marketing_director()) with check (public.is_marketing_director());

notify pgrst, 'reload schema';

-- Kiểm tra ai đang là Giám đốc Marketing:
--   select full_name, role, role_2, position from profiles
--   where (role::text = 'marketing' or role_2::text = 'marketing') and position = 'Giám đốc' and is_active;
