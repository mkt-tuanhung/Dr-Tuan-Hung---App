-- ============================================================
-- SỔ TAY CHUYÊN MÔN — video mô phỏng phương pháp, giải thích chuyên môn từng dịch vụ (chạy lại vẫn an toàn)
--
-- pro_handbook_videos   : danh sách bài (tên, mô tả, nhóm dịch vụ, link video R2, ảnh thumb, thời lượng)
--                         -> MỌI nhân viên đăng nhập đều xem được; chỉ Admin sửa / tải video.
-- pro_handbook_progress : tiến độ xem của từng nhân viên (xem tiếp từ chỗ dừng, đã xem xong)
--                         -> nhân viên đọc / ghi dòng của chính mình; Admin + Kế toán + Cổ đông xem cả.
-- Cùng trình phát với Sổ Tay CSKH (HandbookPage.jsx). Video tải THẲNG lên R2 từ màn "Sổ Tay Chuyên môn"
-- (nút Quản lý video của Admin, chọn nhiều file "Bai01_…", "Bai02_…" 1 lần).
-- Ảnh thumb mặc định nằm trong app: /so-tay-chuyen-mon/bai-01.jpg … bai-20.jpg (thumbnail_url để trống).
-- ============================================================

create table if not exists public.pro_handbook_videos (
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

create table if not exists public.pro_handbook_progress (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  episode       int not null references public.pro_handbook_videos(episode) on delete cascade,
  position_sec  numeric not null default 0,      -- chỗ đang xem dở
  max_sec       numeric not null default 0,      -- xa nhất đã xem tới
  completed     boolean not null default false,  -- xem >= 90%
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (user_id, episode)
);

alter table public.pro_handbook_videos enable row level security;
alter table public.pro_handbook_progress enable row level security;

drop policy if exists pro_handbook_videos_read on public.pro_handbook_videos;
create policy pro_handbook_videos_read on public.pro_handbook_videos
  for select to authenticated using (true);

drop policy if exists pro_handbook_videos_admin on public.pro_handbook_videos;
create policy pro_handbook_videos_admin on public.pro_handbook_videos
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role::text = 'admin' or p.role_2::text = 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role::text = 'admin' or p.role_2::text = 'admin')));

drop policy if exists pro_handbook_progress_read on public.pro_handbook_progress;
create policy pro_handbook_progress_read on public.pro_handbook_progress
  for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid()
         and (p.role::text in ('admin', 'accountant', 'shareholder') or p.role_2::text in ('admin', 'accountant', 'shareholder'))));

drop policy if exists pro_handbook_progress_write on public.pro_handbook_progress;
create policy pro_handbook_progress_write on public.pro_handbook_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists pro_handbook_progress_update on public.pro_handbook_progress;
create policy pro_handbook_progress_update on public.pro_handbook_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.pro_handbook_videos to authenticated;
grant insert, update, delete on public.pro_handbook_videos to authenticated;   -- RLS chỉ cho Admin
grant select, insert, update on public.pro_handbook_progress to authenticated;

-- Các bài (tên & mô tả theo trang bìa từng video; bài 17–20 thêm 19/10/2026). Chạy lại KHÔNG ghi đè chỉnh sửa của Admin.
insert into public.pro_handbook_videos (episode, title, subtitle, topic, duration_sec) values
  (1,  'Giải phẫu nền tảng & khớp cắn', 'Hiểu cấu trúc xương mặt trước khi giới thiệu bất kỳ phương pháp nào',            'Xương hàm mặt', 209),
  (2,  'Gọt hàm V-line',                'Thu gọn góc hàm và đường viền hàm dưới bằng ba bước',                            'Xương hàm mặt', 146),
  (3,  'Hạ gò má',                      'Thu gọn thân và cung gò má bằng đường cắt chữ L',                               'Xương hàm mặt', 148),
  (4,  'Trượt cằm',                     'Di chuyển chính xương cằm để chỉnh độ nhô, độ dài và sự cân đối',                'Xương hàm mặt', 175),
  (5,  'Chỉnh hàm BSSO',                'Chẻ dọc cành lên xương hàm dưới để đưa hàm dưới ra trước hoặc lùi sau',           'Xương hàm mặt', 187),
  (6,  'Le Fort I',                     'Tách và di chuyển toàn bộ xương hàm trên mang răng',                             'Xương hàm mặt', 158),
  (7,  'Chỉnh hàm hô Wassmund',         'Lùi khối răng cửa – nanh cùng xương ổ răng hàm trên',                            'Xương hàm mặt', 145),
  (8,  'Nhổ răng khôn',                 'Răng số 8 mọc lệch, mọc ngầm: vì sao cần nhổ và nhổ như thế nào',                'Xương hàm mặt', 169),
  (9,  'Bóc cơ cắn',                    'Lấy bớt một phần lớp sâu của cơ cắn để góc hàm thon gọn hơn',                    'Xương hàm mặt', 141),
  (10, 'Căng da mặt',                   'Nâng lớp nâng đỡ sâu, trải da nhẹ nhàng để gương mặt tươi tự nhiên',             'Căng da mặt',   159),
  (11, 'Nâng mũi cấu trúc',             'Sống mũi nhân tạo Softxil hoặc Surgiform, đầu mũi dựng bằng sụn tự thân',         'Mũi',           234),
  (12, 'Phẫu thuật mí mắt',             'Tạo nếp mí tự nhiên; xử lý da thừa, bọng mỡ và sụp mi khi có chỉ định',           'Mắt',           242),
  (13, 'Nâng ngực',                     'Chọn túi theo nền ngực và độ dày mô; đặt túi đúng mặt phẳng, đúng khoang',        'Ngực',          218),
  (14, 'Các dòng túi ngực',             'Năm dòng túi gel silicone tại phòng khám: cấu tạo, điểm mạnh, điều cần lưu ý',    'Ngực',          222),
  (15, 'Hút mỡ body-jet',               'Tạo đường nét bằng tia nước hình quạt — không phải phương pháp giảm cân',        'Hút mỡ & tạo hình', 194),
  (16, 'Tạo hình thành bụng',           'Cắt bỏ da – mỡ thừa, khâu phục hồi cân cơ bụng và tạo lại rốn',                   'Hút mỡ & tạo hình', 213),
  (17, 'Nâng mũi cấu trúc sụn sườn',    'Bán phần và toàn phần: khung đỡ bằng sụn sườn tự thân',                         'Mũi',           166),
  (18, 'Sửa mũi hỏng',                  'Giải phóng mô sẹo, dựng lại khung đỡ đã mất',                                   'Mũi',           161),
  (19, 'Thu gọn cánh mũi',              'Cắt chêm chân cánh mũi, cắt ngưỡng lỗ mũi hoặc kết hợp',                        'Mũi',           122),
  (20, 'Đục xương · mài gồ',            'Hạ gồ từng bước, khép mái xương, giữ van mũi',                                  'Mũi',           150)
on conflict (episode) do nothing;

-- 19/10/2026: Bài 11 làm lại (Nâng mũi cấu trúc · Softxil / Surgiform) + tách nhóm "Mũi & Mắt" thành "Mũi" và "Mắt".
-- Chỉ đổi khi Admin CHƯA tự sửa (vẫn là giá trị cũ) -> không ghi đè chỉnh sửa tay.
update public.pro_handbook_videos
   set title = 'Nâng mũi cấu trúc',
       subtitle = 'Sống mũi nhân tạo Softxil hoặc Surgiform, đầu mũi dựng bằng sụn tự thân',
       duration_sec = 234, updated_at = now()
 where episode = 11 and title = 'Nâng mũi';
update public.pro_handbook_videos set topic = 'Mũi' where episode = 11 and topic = 'Mũi & Mắt';
update public.pro_handbook_videos set topic = 'Mắt' where episode = 12 and topic = 'Mũi & Mắt';

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select episode, topic, title, video_url is not null as co_video from public.pro_handbook_videos order by episode;
