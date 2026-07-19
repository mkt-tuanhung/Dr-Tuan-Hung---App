-- ============================================================
-- DEMO ANONYMIZE — Ẩn danh toàn bộ dữ liệu khách trên BẢN DEMO
-- ------------------------------------------------------------
-- MỤC ĐÍCH: sau khi CLONE dữ liệu thật sang project Supabase DEMO,
-- chạy file này để thay MỌI thông tin nhận dạng khách (tên, SĐT,
-- transcript, ảnh, ghi âm, ghi chú…) bằng dữ liệu GIẢ. Người mua
-- xem bản demo với tài khoản admin sẽ KHÔNG thấy data khách thật.
--
-- ⚠️ CHỈ CHẠY TRÊN PROJECT DEMO — TUYỆT ĐỐI KHÔNG chạy trên project thật.
-- ⚠️ Chạy TRƯỚC khi tạo tài khoản admin demo và trước khi cấp quyền xem.
--
-- An toàn: mỗi câu lệnh được bọc kiểm tra "bảng/cột có tồn tại không"
-- nên nếu schema chênh lệch đôi chút, nó tự bỏ qua chứ không báo lỗi.
-- ============================================================

-- Helper: chỉ update khi bảng + cột thực sự tồn tại
create or replace function _demo_set(tbl text, col text, expr text) returns void
language plpgsql as $$
begin
  if to_regclass(tbl) is not null and exists (
    select 1 from information_schema.columns c
    where (c.table_schema || '.' || c.table_name) = tbl and c.column_name = col
  ) then
    execute format('update %s set %I = %s', tbl, col, expr);
  end if;
exception when others then
  raise notice 'Bỏ qua %.% (%.)', tbl, col, sqlerrm;
end $$;

-- Kho tên giả (random theo từng dòng) + SĐT giả
-- (định nghĩa dưới dạng biểu thức SQL nhúng vào từng câu update)
--   TÊN : (array[...])[1 + floor(random()*16)::int]
--   SĐT : '09' || lpad((floor(random()*9e7)+1e7)::bigint::text, 8, '0')

do $$
declare
  NAME_EXPR text := $x$ (array[
    'Nguyễn Thị Mai','Trần Văn Hùng','Lê Thị Hồng','Phạm Minh Tuấn',
    'Vũ Thị Lan','Đặng Văn Nam','Bùi Thị Thu','Hoàng Văn Long',
    'Ngô Thị Hà','Đỗ Minh Khôi','Phan Thị Ngọc','Trịnh Văn Sơn',
    'Lý Thị Kim','Cao Văn Đức','Dương Thị Yến','Võ Minh Quân'
  ])[1 + floor(random()*16)::int] $x$;
  PHONE_EXPR text := $x$ '09' || lpad((floor(random()*9e7)+1e7)::bigint::text, 8, '0') $x$;
begin
  -- 1) NHÂN SỰ (không đụng employee_id, role, lương — chỉ ẩn tên/SĐT/ảnh)
  perform _demo_set('public.profiles', 'full_name',  NAME_EXPR);
  perform _demo_set('public.profiles', 'phone',      PHONE_EXPR);
  perform _demo_set('public.profiles', 'avatar_url', 'null');

  -- 2) KHÁCH TƯ VẤN / LỊCH HẸN (giữ nguyên doanh thu, trạng thái, ngày để P&L còn "thật")
  perform _demo_set('public.customer_appointments', 'customer_name',       NAME_EXPR);
  perform _demo_set('public.customer_appointments', 'phone',               PHONE_EXPR);
  perform _demo_set('public.customer_appointments', 'notes',               $x$ 'Ghi chú demo' $x$);
  perform _demo_set('public.customer_appointments', 'consult_note',        'null');
  perform _demo_set('public.customer_appointments', 'consult_image_urls',  'null');

  -- 3) GHI ÂM TƯ VẤN (xoá giọng thật + transcript; giữ ai_score cho bảng xếp hạng)
  perform _demo_set('public.consult_recordings', 'transcript',  $x$ '[Nội dung tư vấn — bản demo]' $x$);
  perform _demo_set('public.consult_recordings', 'audio_url',   'null');
  perform _demo_set('public.consult_recordings', 'segment_urls','null');
  perform _demo_set('public.consult_recordings', 'ai_analysis', 'null');

  -- 4) DÒNG TIỀN
  perform _demo_set('public.cash_flows', 'handover_person', NAME_EXPR);
  perform _demo_set('public.cash_flows', 'notes',           'null');

  -- 5) PHÒNG HỌP (xoá biên bản/ghi hình thật)
  perform _demo_set('public.meetings', 'title',        $x$ 'Cuộc họp demo' $x$);
  perform _demo_set('public.meetings', 'transcript',   'null');
  perform _demo_set('public.meetings', 'ai_result',    'null');
  perform _demo_set('public.meetings', 'recording_url','null');
  perform _demo_set('public.meetings', 'segment_urls', 'null');
  perform _demo_set('public.meetings', 'participants', 'null');

  -- 6) MỔ ĐỐI TÁC
  perform _demo_set('public.partner_surgeries', 'customer_name', NAME_EXPR);
  perform _demo_set('public.partner_surgeries', 'partner_name',  $x$ 'Đối tác demo' $x$);
  perform _demo_set('public.partner_surgeries', 'notes',         'null');

  -- 7) PHÂN CÔNG PHỤ MỔ / TRỰC ĐÊM
  perform _demo_set('public.surgical_assignments', 'customer_name', NAME_EXPR);
  perform _demo_set('public.surgical_assignments', 'notes',         'null');

  -- 7b) DATA KHÁCH HÀNG (marketing_data) + CONTENT TASKS
  perform _demo_set('public.marketing_data', 'customer_name', NAME_EXPR);
  perform _demo_set('public.marketing_data', 'phone',         PHONE_EXPR);
  perform _demo_set('public.marketing_data', 'description',   'null');
  perform _demo_set('public.marketing_data', 'last_exchange', 'null');
  perform _demo_set('public.marketing_data', 'reached_info',  'null');
  perform _demo_set('public.content_tasks', 'customer_name', NAME_EXPR);
  perform _demo_set('public.content_tasks', 'phone',         PHONE_EXPR);

  -- 8) MEDIA / NGUỒN KHÁCH
  perform _demo_set('public.media_customers', 'customer_name',   NAME_EXPR);
  perform _demo_set('public.media_customers', 'customer_phone',  PHONE_EXPR);
  perform _demo_set('public.media_customers', 'note',            'null');
  perform _demo_set('public.media_customers', 'source_links',    'null');
  perform _demo_set('public.media_customers', 'source_feedback', 'null');
  perform _demo_set('public.media_clips', 'editor_note',  'null');
  perform _demo_set('public.media_clips', 'clip_links',   'null');
  perform _demo_set('public.media_clips', 'thumb_links',  'null');
  perform _demo_set('public.media_clips', 'ads_feedback', 'null');

  -- 9) CỘNG ĐỒNG NỘI BỘ
  perform _demo_set('public.community_posts',    'content',    $x$ 'Bài đăng demo' $x$);
  perform _demo_set('public.community_posts',    'image_urls', 'null');
  perform _demo_set('public.community_comments', 'content',    $x$ 'Bình luận demo' $x$);

  -- 10) THU CHI / TẠM ỨNG
  perform _demo_set('public.expenses', 'description',      $x$ 'Chi phí demo' $x$);
  perform _demo_set('public.expenses', 'notes',            'null');
  perform _demo_set('public.expenses', 'proof_image_urls', 'null');

  -- 11) KHO
  perform _demo_set('public.inventory_transactions', 'notes', 'null');

  -- 12) PHIẾU LƯƠNG
  perform _demo_set('public.payslips', 'staff_name', NAME_EXPR);

  -- 13) THÔNG BÁO (thường chứa tên trong nội dung) → làm rỗng
  perform _demo_set('public.notifications', 'title', $x$ 'Thông báo demo' $x$);
  perform _demo_set('public.notifications', 'body',  'null');
end $$;

-- 14) TÀI KHOẢN ĐĂNG NHẬP (auth.users) — ẩn email/SĐT thật của nhân viên
--     Lưu ý: đổi email sẽ ảnh hưởng đăng nhập cũ → hãy TẠO admin demo MỚI sau bước này.
do $$
begin
  if to_regclass('auth.users') is not null then
    update auth.users
      set email = 'nv_' || replace(id::text, '-', '') || '@demo.local',
          phone = null,
          raw_user_meta_data = '{}'::jsonb
      where email is null or email not like '%@demo.local';
  end if;
end $$;

-- Dọn helper
drop function if exists _demo_set(text, text, text);

-- ============================================================
-- XONG. Kiểm tra nhanh: các câu dưới phải KHÔNG còn dữ liệu thật.
--   select customer_name, phone from customer_appointments limit 20;
--   select full_name, phone from profiles limit 20;
-- Sau đó: tạo tài khoản admin demo mới (xem DEMO_SETUP.md) rồi cấp quyền xem.
-- ============================================================
