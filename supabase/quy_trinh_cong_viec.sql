-- ============================================================
-- QUY TRÌNH CÔNG VIỆC — video hướng dẫn quy trình vận hành nội bộ (QT01, QT02…) (chạy lại vẫn an toàn)
--
-- proc_handbook_videos   : danh sách quy trình (tên, mô tả, nhóm, link video R2, ảnh thumb, thời lượng)
--                          -> MỌI nhân viên đăng nhập đều xem được; chỉ Admin sửa / tải video.
-- proc_handbook_progress : tiến độ xem + số lần xem của từng nhân viên
--                          -> nhân viên đọc / ghi dòng của chính mình; Admin + Kế toán + Cổ đông xem cả.
-- Cùng trình phát + quy tắc (không tua / tăng tốc ở lần xem đầu, ghi vi phạm) với Sổ Tay CSKH / Chuyên môn.
-- Video tải THẲNG lên R2 từ màn "Quy Trình Công Việc" (nút Quản lý video của Admin, file "QT01_…", "QT02_…").
-- Ảnh thumb mặc định nằm trong app: /quy-trinh-cong-viec/qt-01.jpg … (thumbnail_url để trống).
-- SAU file này chạy lại supabase/dao_tao_quy_tac.sql (đếm lượt xem + ghi vi phạm cho module 'proc').
-- ============================================================

create table if not exists public.proc_handbook_videos (
  episode        int primary key check (episode between 1 and 99),
  title          text not null,
  subtitle       text,
  topic          text,                               -- nhóm dịch vụ (lọc / chia mục trên app)
  video_url      text,
  thumbnail_url  text,
  duration_sec   int,
  active         boolean not null default true,
  updated_by     uuid references public.profiles(id) on delete set null,
  updated_at     timestamptz not null default now()
);

create table if not exists public.proc_handbook_progress (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  episode       int not null references public.proc_handbook_videos(episode) on delete cascade,
  position_sec  numeric not null default 0,      -- chỗ đang xem dở
  max_sec       numeric not null default 0,      -- xa nhất đã xem tới
  completed     boolean not null default false,  -- xem >= 90%
  completed_at  timestamptz,
  views         int not null default 0,          -- số lần bấm xem / xem lại
  updated_at    timestamptz not null default now(),
  primary key (user_id, episode)
);

alter table public.proc_handbook_videos enable row level security;
alter table public.proc_handbook_progress enable row level security;

drop policy if exists proc_handbook_videos_read on public.proc_handbook_videos;
create policy proc_handbook_videos_read on public.proc_handbook_videos
  for select to authenticated using (true);

drop policy if exists proc_handbook_videos_admin on public.proc_handbook_videos;
create policy proc_handbook_videos_admin on public.proc_handbook_videos
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role::text = 'admin' or p.role_2::text = 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role::text = 'admin' or p.role_2::text = 'admin')));

drop policy if exists proc_handbook_progress_read on public.proc_handbook_progress;
create policy proc_handbook_progress_read on public.proc_handbook_progress
  for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid()
         and (p.role::text in ('admin', 'accountant', 'shareholder') or p.role_2::text in ('admin', 'accountant', 'shareholder'))));

drop policy if exists proc_handbook_progress_write on public.proc_handbook_progress;
create policy proc_handbook_progress_write on public.proc_handbook_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists proc_handbook_progress_update on public.proc_handbook_progress;
create policy proc_handbook_progress_update on public.proc_handbook_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.proc_handbook_videos to authenticated;
grant insert, update, delete on public.proc_handbook_videos to authenticated;   -- RLS chỉ cho Admin
grant select, insert, update on public.proc_handbook_progress to authenticated;

-- Các quy trình (tên & mô tả theo trang bìa từng video). Chạy lại KHÔNG ghi đè chỉnh sửa của Admin.
insert into public.proc_handbook_videos (episode, title, subtitle, topic, duration_sec) values
  (1, 'Tiếp nhận, xử lý data & cập nhật tín hiệu quảng cáo', 'Từ tin nhắn đầu tiên tới tín hiệu quảng cáo chính xác', null, 375)
on conflict (episode) do nothing;

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select episode, title, video_url is not null as co_video from public.proc_handbook_videos order by episode;
