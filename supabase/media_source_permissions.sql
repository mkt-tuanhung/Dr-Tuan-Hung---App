-- Cờ quyền sử dụng source (Media bật khi đẩy lên; Designer/Editor nhìn cảnh báo).
alter table media_customers
  add column if not exists no_image  boolean not null default false,   -- KHÔNG ĐƯỢC SỬ DỤNG HÌNH ẢNH
  add column if not exists hide_face boolean not null default false;   -- CHE MẶT

notify pgrst, 'reload schema';
