-- Tạo bucket 'avatars' cho phép lưu trữ ảnh đại diện
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

-- Cho phép ai cũng có thể xem ảnh
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Cho phép nhân sự đã đăng nhập được upload ảnh
create policy "Authenticated Users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- Cho phép nhân sự tự sửa ảnh của mình
create policy "Users can update own avatar"
  on storage.objects for update
  using ( bucket_id = 'avatars' and auth.uid() = owner );
