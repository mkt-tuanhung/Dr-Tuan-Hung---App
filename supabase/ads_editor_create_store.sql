-- Cho Editor được tạo/gán kho media (khi Thêm Video Ads tự tạo source)
drop policy if exists "mc_write" on media_customers;
create policy "mc_write" on media_customers for all using (
  media_id = auth.uid() or public.current_user_role()::text in ('media','editor','dieu_duong','cskh','marketing','admin')
) with check (
  media_id = auth.uid() or public.current_user_role()::text in ('media','editor','dieu_duong','cskh','marketing','admin')
);
