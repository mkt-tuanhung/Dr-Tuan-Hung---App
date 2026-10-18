-- ============================================================
-- TÀI LIỆU — thư viện tài liệu PDF + trình đọc lật trang (chạy lại vẫn an toàn)
--
-- library_documents : danh sách tài liệu (tên, loại, file PDF trên R2, ảnh bìa, số trang, mục lục)
--                     -> MỌI nhân viên đăng nhập đều xem; chỉ Admin thêm / sửa / tải file.
-- library_pages     : chữ của từng trang (app tự trích khi Admin tải PDF lên) -> dùng để TÌM KIẾM
--                     text_norm = chữ thường, bỏ dấu (tìm "nang mui" ra "Nâng mũi").
-- library_reads     : mỗi nhân viên × tài liệu: các trang đã đọc, trang đang đọc, số giây đọc thật
--                     -> nhân viên ghi dòng của mình (qua hàm log_library_reading);
--                        Admin + Kế toán + Cổ đông xem chi tiết từng người.
-- library_doc_stats(): số nhân viên đã đọc từng tài liệu (chỉ con số tổng, ai cũng xem được).
-- File PDF tải THẲNG lên R2 từ màn "Tài liệu" (nút Quản lý tài liệu của Admin) — không lưu trong database.
-- ============================================================

create table if not exists public.library_documents (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique,
  title        text not null,
  subtitle     text,
  category     text not null default 'noi_bo',   -- noi_bo | khach_hang | quy_trinh | khac
  file_url     text,
  file_size    bigint,
  cover_url    text,
  page_count   int,
  toc          jsonb not null default '[]'::jsonb, -- [{no, title, page, items:[{title, page}]}]
  indexed_at   timestamptz,                        -- lần cuối trích chữ cho tìm kiếm
  sort         int not null default 100,
  active       boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.library_pages (
  doc_id     uuid not null references public.library_documents(id) on delete cascade,
  page       int not null,
  text       text not null default '',
  text_norm  text not null default '',
  primary key (doc_id, page)
);

create table if not exists public.library_reads (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  doc_id      uuid not null references public.library_documents(id) on delete cascade,
  pages_seen  int[] not null default '{}',
  last_page   int not null default 1,
  seconds     int not null default 0,
  opens       int not null default 0,
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  primary key (user_id, doc_id)
);
create index if not exists library_reads_doc_idx on public.library_reads (doc_id);

alter table public.library_documents enable row level security;
alter table public.library_pages enable row level security;
alter table public.library_reads enable row level security;

create or replace function public.library_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text = 'admin' or p.role_2::text = 'admin'))
$$;
create or replace function public.library_can_see_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
    and (p.role::text in ('admin', 'accountant', 'shareholder') or p.role_2::text in ('admin', 'accountant', 'shareholder')))
$$;
grant execute on function public.library_is_admin() to authenticated;
grant execute on function public.library_can_see_team() to authenticated;

drop policy if exists library_documents_read on public.library_documents;
create policy library_documents_read on public.library_documents
  for select to authenticated using (active or public.library_is_admin());
drop policy if exists library_documents_admin on public.library_documents;
create policy library_documents_admin on public.library_documents
  for all to authenticated using (public.library_is_admin()) with check (public.library_is_admin());

drop policy if exists library_pages_read on public.library_pages;
create policy library_pages_read on public.library_pages
  for select to authenticated using (true);
drop policy if exists library_pages_admin on public.library_pages;
create policy library_pages_admin on public.library_pages
  for all to authenticated using (public.library_is_admin()) with check (public.library_is_admin());

drop policy if exists library_reads_read on public.library_reads;
create policy library_reads_read on public.library_reads
  for select to authenticated using (user_id = auth.uid() or public.library_can_see_team());
drop policy if exists library_reads_insert on public.library_reads;
create policy library_reads_insert on public.library_reads
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists library_reads_update on public.library_reads;
create policy library_reads_update on public.library_reads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.library_documents to authenticated;
grant select, insert, update, delete on public.library_pages to authenticated;
grant select, insert, update on public.library_reads to authenticated;

-- Ghi nhận 1 lượt đọc: GỘP trang đã đọc (không mất trang khi mở trên 2 máy), CỘNG dồn số giây.
-- p_seconds giới hạn 0..300 mỗi lần gửi (app gửi ~15 giây/lần) để không bơm số phút ảo.
create or replace function public.log_library_reading(p_doc uuid, p_pages int[] default '{}', p_seconds int default 0, p_last_page int default null, p_open boolean default false)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_sec int := greatest(0, least(coalesce(p_seconds, 0), 300));
  v_pages int[] := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_pages, '{}')) x where x between 1 and 5000), '{}');
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  insert into library_reads as r (user_id, doc_id, pages_seen, last_page, seconds, opens)
  values (auth.uid(), p_doc, v_pages, coalesce(p_last_page, 1), v_sec, case when p_open then 1 else 0 end)
  on conflict (user_id, doc_id) do update set
    pages_seen = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(r.pages_seen || excluded.pages_seen) x),
    last_page  = coalesce(p_last_page, r.last_page),
    seconds    = r.seconds + v_sec,
    opens      = r.opens + case when p_open then 1 else 0 end,
    last_at    = now();
end
$$;
revoke all on function public.log_library_reading(uuid, int[], int, int, boolean) from public;
grant execute on function public.log_library_reading(uuid, int[], int, int, boolean) to authenticated;

-- Số nhân viên đã đọc + tổng phút của từng tài liệu (con số tổng, không lộ chi tiết từng người)
create or replace function public.library_doc_stats()
returns table (doc_id uuid, readers int, total_seconds bigint)
language sql stable security definer set search_path = public as $$
  select r.doc_id, count(*)::int, sum(r.seconds)::bigint
  from library_reads r join profiles p on p.id = r.user_id and p.is_active
  where auth.uid() is not null and cardinality(r.pages_seen) > 0
  group by r.doc_id
$$;
revoke all on function public.library_doc_stats() from public;
grant execute on function public.library_doc_stats() to authenticated;

-- 2 tài liệu ban đầu (mục lục theo trang "Mục lục" của từng file). Chạy lại KHÔNG ghi đè chỉnh sửa của Admin.
insert into public.library_documents (slug, title, subtitle, category, cover_url, page_count, sort, toc) values
('so-tay-cskh-dai-phau', 'Sổ tay Chăm sóc Khách hàng — Đại phẫu',
 'Quy trình chăm sóc theo từng mốc, tin nhắn mẫu và cách xử lý tình huống cho 5 nhóm dịch vụ đại phẫu.',
 'noi_bo', '/tai-lieu/so-tay-cskh-dai-phau.jpg', 181, 10,
 $j$[
  {"no":"00","title":"Nguyên tắc chăm sóc","page":4,"items":[
    {"title":"Vai trò & giới hạn của CSKH","page":5},{"title":"Chuẩn giao tiếp","page":7},{"title":"Hành trình khách hàng chung","page":10},
    {"title":"Phân mức cảnh báo & quy trình chuyển bác sĩ","page":12},{"title":"Hồ sơ & bảo mật","page":15},{"title":"Tin nhắn mẫu chung","page":17},
    {"title":"Tình huống chung & cách xử lý","page":20}]},
  {"no":"01","title":"Xương hàm mặt","page":27,"items":[
    {"title":"Tổng quan chăm sóc","page":28},{"title":"Quy trình chăm sóc theo mốc","page":32},{"title":"Tin nhắn mẫu theo mốc","page":36},{"title":"Tình huống điển hình và cách xử lý","page":41}]},
  {"no":"02","title":"Nâng mũi","page":51,"items":[
    {"title":"Tổng quan chăm sóc","page":52},{"title":"Quy trình chăm sóc theo mốc","page":55},{"title":"Tin nhắn mẫu theo mốc","page":57},{"title":"Tình huống điển hình và cách xử lý","page":60}]},
  {"no":"03","title":"Nâng ngực","page":68,"items":[
    {"title":"Tổng quan chăm sóc","page":69},{"title":"Quy trình chăm sóc theo mốc","page":72},{"title":"Tin nhắn mẫu theo mốc","page":74},{"title":"Tình huống điển hình và cách xử lý","page":78}]},
  {"no":"04","title":"Hút mỡ & tạo hình","page":90,"items":[
    {"title":"Tổng quan chăm sóc","page":91},{"title":"Quy trình chăm sóc theo mốc","page":94},{"title":"Tin nhắn mẫu theo mốc","page":96},{"title":"Tình huống điển hình và cách xử lý","page":100}]},
  {"no":"05","title":"Căng da mặt","page":110,"items":[
    {"title":"Tổng quan chăm sóc","page":111},{"title":"Quy trình chăm sóc theo mốc","page":114},{"title":"Tin nhắn mẫu theo mốc","page":116},{"title":"Tình huống điển hình và cách xử lý","page":120}]},
  {"no":"06","title":"Tình huống thường gặp","page":129,"items":[
    {"title":"Tổng quan","page":130},{"title":"Câu hỏi sinh hoạt hằng ngày","page":132},{"title":"Tại phòng khám và khi thay băng","page":135},
    {"title":"Hậu phẫu tại nhà","page":137},{"title":"Giao tiếp và quan hệ với KH","page":141},{"title":"Tin nhắn mẫu","page":144}]},
  {"no":"07","title":"Xử lý sự cố","page":146,"items":[
    {"title":"Tổng quan","page":147},{"title":"Quy trình 6 bước","page":149},{"title":"Sự cố thường gặp","page":151},{"title":"Tin nhắn mẫu","page":157}]},
  {"no":"08","title":"Đồng hành dài lâu","page":159,"items":[
    {"title":"Tư duy đồng hành","page":160},{"title":"Lắng nghe & ngôn ngữ phục vụ","page":163},{"title":"Hình ảnh, ưu đãi & giới thiệu bạn bè","page":166},
    {"title":"Quy trình chăm lại theo mốc","page":168},{"title":"Tin nhắn mẫu","page":170},{"title":"Tình huống & cách xử lý","page":172}]}
 ]$j$::jsonb),
('cam-nang-dai-phau-khach-hang', 'Cẩm nang Đại phẫu — dành cho Khách hàng',
 'Hiểu đúng phương pháp, chuẩn bị chu đáo và hồi phục an tâm — đồng hành cùng Bác sĩ Tuấn Hùng.',
 'khach_hang', '/tai-lieu/cam-nang-dai-phau-khach-hang.jpg', 220, 20,
 $j$[
  {"no":"","title":"Giới thiệu","page":4,"items":[
    {"title":"Lời ngỏ","page":4},{"title":"Về Bác sĩ Tuấn Hùng","page":5},{"title":"Triết lý điều trị","page":7},{"title":"Hành trình đồng hành cùng bạn","page":8},
    {"title":"Hồ sơ chuyên môn & hội nghị","page":9},{"title":"Cách sử dụng cẩm nang","page":11}]},
  {"no":"01","title":"Xương hàm mặt","page":12,"items":[
    {"title":"Gọt hàm","page":17},{"title":"Hạ gò má","page":22},{"title":"Bóc cơ cắn","page":26},{"title":"Độn góc hàm","page":30},{"title":"Trượt cằm","page":34},
    {"title":"Trượt thu ngắn cằm","page":38},{"title":"Chỉnh hàm hô","page":45},{"title":"Điều trị khớp cắn ngược","page":51},{"title":"Nhổ răng khôn","page":55},
    {"title":"Cẩm nang hậu phẫu Xương hàm mặt","page":58},{"title":"Hình ảnh thực tế","page":66},{"title":"Câu hỏi thường gặp","page":70}]},
  {"no":"02","title":"Nâng mũi","page":72,"items":[
    {"title":"Nâng mũi cấu trúc sụn tự thân","page":77},{"title":"Nâng mũi kết hợp sống nhân tạo","page":82},{"title":"Chỉnh sửa đầu mũi – cánh mũi","page":87},
    {"title":"Sửa mũi đã phẫu thuật","page":90},{"title":"Cẩm nang hậu phẫu Nâng mũi","page":93},{"title":"Hình ảnh thực tế","page":98},{"title":"Câu hỏi thường gặp","page":99}]},
  {"no":"03","title":"Nâng ngực","page":101,"items":[
    {"title":"Motiva Ergonomix®","page":110},{"title":"Motiva Ergonomix2®","page":112},{"title":"Mentor MemoryGel™","page":114},{"title":"Mentor MemoryGel™ Xtra","page":116},
    {"title":"Mentor MemoryGel BOOST™","page":118},{"title":"Treo sa trễ","page":123},{"title":"Cẩm nang hậu phẫu Nâng ngực & Treo sa trễ","page":127},
    {"title":"Hình ảnh thực tế","page":134},{"title":"Câu hỏi thường gặp","page":138}]},
  {"no":"04","title":"Hút mỡ & tạo hình","page":140,"items":[
    {"title":"Hút mỡ công nghệ Body-jet","page":143},{"title":"Tạo hình thành bụng","page":148},{"title":"Cấy mỡ tự thân","page":152},
    {"title":"Cẩm nang hậu phẫu Hút mỡ & Tạo hình","page":155},{"title":"Hình ảnh thực tế","page":162},{"title":"Câu hỏi thường gặp","page":171}]},
  {"no":"05","title":"Căng da mặt","page":173,"items":[
    {"title":"Căng da thái dương","page":177},{"title":"Căng da mặt tầng giữa","page":180},{"title":"Căng da mặt tầng dưới","page":183},{"title":"Căng da toàn phần","page":187},
    {"title":"Cẩm nang hậu phẫu Căng da mặt","page":193},{"title":"Hình ảnh thực tế","page":198},{"title":"Câu hỏi thường gặp","page":199}]},
  {"no":"06","title":"Chuẩn bị & đồng hành","page":201,"items":[
    {"title":"Câu hỏi thường gặp","page":209}]}
 ]$j$::jsonb)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select title, page_count, file_url is not null as co_file, indexed_at from public.library_documents order by sort;
