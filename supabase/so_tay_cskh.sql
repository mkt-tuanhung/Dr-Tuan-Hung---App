-- ============================================================
-- SỔ TAY CSKH — 7 tập video cẩm nang chăm sóc khách hàng (chạy lại vẫn an toàn)
--
-- cskh_handbook_videos   : danh sách tập (tên, mô tả, link video R2, ảnh thumb, thời lượng)
--                          -> MỌI nhân viên đăng nhập đều xem được; chỉ Admin sửa / tải video.
-- cskh_handbook_progress : tiến độ xem của từng nhân viên (xem tiếp từ chỗ dừng, đã xem xong)
--                          -> nhân viên đọc / ghi dòng của chính mình; Admin + Kế toán + Cổ đông xem cả.
-- Video tải THẲNG lên R2 từ màn "Sổ Tay CSKH" (nút Quản lý video của Admin) — không lưu trong database.
-- Ảnh thumb mặc định nằm trong app: /so-tay-cskh/tap-01.jpg … tap-07.jpg (thumbnail_url để trống).
-- ============================================================

create table if not exists public.cskh_handbook_videos (
  episode        int primary key check (episode between 1 and 99),
  title          text not null,
  subtitle       text,
  video_url      text,
  thumbnail_url  text,
  duration_sec   int,
  active         boolean not null default true,
  updated_by     uuid references public.profiles(id) on delete set null,
  updated_at     timestamptz not null default now()
);

create table if not exists public.cskh_handbook_progress (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  episode       int not null references public.cskh_handbook_videos(episode) on delete cascade,
  position_sec  numeric not null default 0,      -- chỗ đang xem dở
  max_sec       numeric not null default 0,      -- xa nhất đã xem tới
  completed     boolean not null default false,  -- xem >= 90%
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (user_id, episode)
);

alter table public.cskh_handbook_videos enable row level security;
alter table public.cskh_handbook_progress enable row level security;

drop policy if exists cskh_handbook_videos_read on public.cskh_handbook_videos;
create policy cskh_handbook_videos_read on public.cskh_handbook_videos
  for select to authenticated using (true);

drop policy if exists cskh_handbook_videos_admin on public.cskh_handbook_videos;
create policy cskh_handbook_videos_admin on public.cskh_handbook_videos
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role::text = 'admin' or p.role_2::text = 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role::text = 'admin' or p.role_2::text = 'admin')));

drop policy if exists cskh_handbook_progress_read on public.cskh_handbook_progress;
create policy cskh_handbook_progress_read on public.cskh_handbook_progress
  for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid()
         and (p.role::text in ('admin', 'accountant', 'shareholder') or p.role_2::text in ('admin', 'accountant', 'shareholder'))));

drop policy if exists cskh_handbook_progress_write on public.cskh_handbook_progress;
create policy cskh_handbook_progress_write on public.cskh_handbook_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists cskh_handbook_progress_update on public.cskh_handbook_progress;
create policy cskh_handbook_progress_update on public.cskh_handbook_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.cskh_handbook_videos to authenticated;
grant insert, update, delete on public.cskh_handbook_videos to authenticated;   -- RLS chỉ cho Admin
grant select, insert, update on public.cskh_handbook_progress to authenticated;

-- 7 tập ban đầu (tên & mô tả theo trang bìa từng video). Chạy lại KHÔNG ghi đè chỉnh sửa của Admin.
insert into public.cskh_handbook_videos (episode, title, subtitle, duration_sec) values
  (1, 'Vai trò & chuẩn giao tiếp CSKH',            'Đúng phạm vi, đúng lời, đúng lúc: nền móng của mọi ca chăm sóc', 231),
  (2, 'Hành trình khách hàng & phân mức cảnh báo', 'Biết khách đang ở mốc nào, nhận ra lúc nào phải gọi bác sĩ',      268),
  (3, 'Chăm sóc khách hàng Xương hàm mặt',          'Đồng hành từ sau buổi tư vấn đến mốc 12 tháng hồi phục',           273),
  (4, 'Chăm sóc khách hàng Nâng mũi',               'Về nhà trong ngày, đồng hành đến mốc 12 tháng',                    237),
  (5, 'Chăm sóc khách hàng Nâng ngực',              'Chuẩn chuyên môn, tế nhị trong từng lời hỏi thăm',                 231),
  (6, 'Chăm sóc khách hàng Hút mỡ & tạo hình',      'Đi lại sớm, uống đủ nước, mặc gen đúng, theo dõi sát',             230),
  (7, 'Chăm sóc khách hàng Căng da mặt',            'Canh 24 giờ đầu, giữ huyết áp, trân trọng từng lời xưng hô',       232)
on conflict (episode) do nothing;

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select episode, title, video_url is not null as co_video from public.cskh_handbook_videos order by episode;
