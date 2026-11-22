-- ============================================================
-- GALA THI VĂN NGHỆ — BỘ TIÊU CHÍ CHI TIẾT (8 tiêu chí, tổng 100) + 3 TIẾT MỤC
-- Chạy SAU file event_gala_van_nghe.sql. Chạy lại được (idempotent).
--
-- 1) Thêm cột "description" (gợi ý chấm) cho tiêu chí.
-- 2) Chương trình MỚI tạo sau này: tự có 8 tiêu chí chi tiết.
-- 3) Chương trình mới nhất CHƯA có điểm & CHƯA công bố:
--      - thay 4 tiêu chí cũ bằng 8 tiêu chí chi tiết
--      - thêm 3 tiết mục (bỏ qua tiết mục đã có cùng tên)
--    Chương trình đã có điểm -> giữ nguyên (không đổi thang điểm giữa chừng).
-- ============================================================
begin;

alter table public.gala_criteria add column if not exists description text not null default '';

-- Bộ tiêu chí chuẩn (dùng chung cho trigger + cập nhật chương trình hiện có)
create or replace function public.gala_apply_default_criteria(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gala_criteria(event_id, label, max_points, sort_order, description) values
    (p_event, 'Nội dung & thông điệp',             15, 1, 'Kịch bản / bài diễn rõ ý, có câu chuyện, truyền tải được thông điệp ý nghĩa.'),
    (p_event, 'Kỹ năng biểu diễn',                  20, 2, 'Diễn xuất, vũ đạo hoặc giọng hát: chính xác, đúng nhịp, biểu cảm tự nhiên.'),
    (p_event, 'Sáng tạo & dàn dựng',                15, 3, 'Ý tưởng mới lạ, bố cục sân khấu, đội hình và chuyển cảnh hợp lý.'),
    (p_event, 'Phong cách & thần thái',             10, 4, 'Tự tin, cuốn hút, làm chủ sân khấu, ánh mắt và cử chỉ.'),
    (p_event, 'Phối hợp & đồng đều',                10, 5, 'Các thành viên ăn ý, đồng đều; không lỗi nhịp, không rời rạc.'),
    (p_event, 'Trang phục, đạo cụ & hoá trang',     10, 6, 'Phù hợp nội dung, chỉn chu, tạo điểm nhấn thị giác.'),
    (p_event, 'Cảm xúc & tương tác khán giả',       10, 7, 'Tạo được tiếng cười / xúc động / hào hứng; khán giả hưởng ứng.'),
    (p_event, 'Tinh thần tập thể & văn hoá Dr Tuấn Hùng', 10, 8, 'Thể hiện tinh thần đoàn kết, giá trị và năng lượng của Dr Tuấn Hùng.')
  on conflict (event_id, label) do nothing;
end $$;
revoke all on function public.gala_apply_default_criteria(uuid) from public, anon, authenticated;

-- Chương trình mới -> 8 tiêu chí chi tiết
create or replace function public.gala_seed_criteria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.gala_apply_default_criteria(new.id);
  return new;
end $$;

-- Chương trình hiện có (mới nhất, chưa có điểm, chưa công bố)
do $$
declare v_event uuid;
begin
  select e.id into v_event
  from public.gala_events e
  where not e.published
    and not exists (select 1 from public.gala_scores s where s.event_id = e.id)
  order by e.created_at desc
  limit 1;

  if v_event is null then
    raise notice 'Không có chương trình phù hợp (chưa có điểm & chưa công bố) — chỉ cập nhật bộ tiêu chí cho chương trình mới.';
    return;
  end if;

  -- Thay bộ tiêu chí (chỉ khi bộ hiện tại khác bộ chi tiết)
  if not exists (select 1 from public.gala_criteria where event_id = v_event and label = 'Kỹ năng biểu diễn') then
    delete from public.gala_criteria where event_id = v_event;
    perform public.gala_apply_default_criteria(v_event);
  end if;

  -- 3 tiết mục
  insert into public.gala_performances(event_id, title, team_name, description, order_no)
  select v_event, t.title, t.team, t.descr,
         coalesce((select max(order_no) from public.gala_performances where event_id = v_event), 0)
           + row_number() over (order by t.ord)
  from (values
    ('Vở kịch: Tìm lại chính mình', 'Điều dưỡng', 'Kịch', 1),
    ('Điệu nhảy: Ôi tình yêu',      'Telesale',   'Nhảy', 2),
    ('Nhảy hiện đại',               'Sale',       'Nhảy hiện đại', 3)
  ) as t(title, team, descr, ord)
  where not exists (
    select 1 from public.gala_performances p where p.event_id = v_event and p.title = t.title
  );

  raise notice 'Đã cập nhật chương trình %', v_event;
end $$;

commit;
