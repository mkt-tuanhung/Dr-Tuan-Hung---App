-- ============================================================
-- TEST v2 (gắn source Kho Media + kịch bản order + đồng bộ trạng thái Kho).
-- Chạy NỐI TIẾP sau marketing_workspace_v1.test.sql trong cùng phiên psql (dùng lại pg_temp.* và bảng ids).
-- ============================================================
select pg_temp.as_root();
insert into public.media_customers (id, customer_name, customer_phone, source_id, service, source_status, no_image, hide_face) values
  ('10000000-0000-0000-0000-00000000000a', 'Nguyễn Thị Lan', '0900000001', 'Lan01102026_01', 'Hàm mặt', 'chua_dung', false, true),
  ('10000000-0000-0000-0000-00000000000b', 'Trần Văn B', '0900000002', 'B02102026_01', 'Body', 'chua_dung', true, false),
  ('10000000-0000-0000-0000-00000000000c', 'Lê Thị C', '0900000003', 'C03102026_01', 'Tiểu phẫu', 'can_bo_sung', false, false);
insert into public.media_assets (id, drive_id, media_customer_id, name, kind) values
  ('20000000-0000-0000-0000-00000000000a', 'drA1', '10000000-0000-0000-0000-00000000000a', 'truoc_mo.mp4', 'video'),
  ('20000000-0000-0000-0000-00000000000b', 'drB1', '10000000-0000-0000-0000-00000000000b', 'b.mp4', 'video');

select pg_temp.ok((select kho_status from public.mw_lists where board_id = pg_temp.id('b1') and name = 'Đang dựng') = 'dang_dung'
  and (select kho_status from public.mw_lists where id = pg_temp.id('l_done')) = 'da_dung'
  and (select kho_status from public.mw_lists where id = pg_temp.id('l_idea')) = 'none', 'v2 Cột có sẵn được đoán trạng thái Kho theo tên (Đang dựng / Đã đăng / không đổi)');
insert into ids select 'l_edit', id from public.mw_lists where board_id = pg_temp.id('b1') and name = 'Đang dựng';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'Order video gọt hàm');
insert into ids select 'tO', id from public.mw_tasks where title = 'Order video gọt hàm';
insert into public.mw_task_sources (task_id, media_customer_id, media_asset_id) values (pg_temp.id('tO'), '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a');
insert into ids select 'src1', id from public.mw_task_sources where task_id = pg_temp.id('tO');
select pg_temp.ok((select count(*) from public.mw_activity where task_id = pg_temp.id('tO') and entity = 'source' and action = 'added') = 1, 'v2 Media (thành viên, có quyền Kho) gắn source vào thẻ + có nhật ký');
select pg_temp.err($q$ insert into public.mw_task_sources (task_id, media_customer_id) values (pg_temp.id('tO'), '10000000-0000-0000-0000-00000000000b') $q$,
  '%KHÔNG ĐƯỢC SỬ DỤNG HÌNH ẢNH%', 'v2 Nguồn "không được dùng hình ảnh" bị từ chối');
select pg_temp.err($q$ insert into public.mw_task_sources (task_id, media_customer_id, media_asset_id) values (pg_temp.id('tO'), '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b') $q$,
  '%không thuộc nguồn%', 'v2 File phải thuộc đúng nguồn');
select pg_temp.ok((select source_status from public.media_customers where id = '10000000-0000-0000-0000-00000000000a') = 'chua_dung', 'v2 Thẻ ở cột "không đổi" -> Kho giữ nguyên');

-- Người không có quyền Kho / không là thành viên
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.ok((select count(*) from public.mw_task_sources) = 0, 'v2 Viewer (telesale, không có quyền Kho) không thấy source của thẻ');
select pg_temp.err($q$ insert into public.mw_task_sources (task_id, media_customer_id) values (pg_temp.id('tO'), '10000000-0000-0000-0000-00000000000c') $q$,
  '%row-level security%', 'v2 Viewer không gắn được source');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.err($q$ insert into public.mw_task_sources (task_id, media_customer_id) values (pg_temp.id('tO'), '10000000-0000-0000-0000-00000000000c') $q$,
  '%row-level security%', 'v2 Marketing ngoài workspace không gắn được source vào thẻ');

-- Chuyển cột -> cập nhật trạng thái Kho (chỉ tiến)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.mw_move_task(pg_temp.id('tO'), pg_temp.id('l_edit'), null, (select version from public.mw_tasks where id = pg_temp.id('tO')));
select pg_temp.ok((select source_status from public.media_customers where id = '10000000-0000-0000-0000-00000000000a') = 'dang_dung', 'v2 Thẻ vào "Đang dựng" -> source Kho = Đang dựng');
select public.mw_move_task(pg_temp.id('tO'), pg_temp.id('l_done'), null, (select version from public.mw_tasks where id = pg_temp.id('tO')));
select pg_temp.ok((select source_status from public.media_customers where id = '10000000-0000-0000-0000-00000000000a') = 'da_dung', 'v2 Thẻ vào "Đã đăng" -> source Kho = Đã dựng');
select public.mw_move_task(pg_temp.id('tO'), pg_temp.id('l_edit'), null, (select version from public.mw_tasks where id = pg_temp.id('tO')));
select pg_temp.ok((select source_status from public.media_customers where id = '10000000-0000-0000-0000-00000000000a') = 'da_dung', 'v2 Kéo lùi thẻ không hạ trạng thái Kho');
insert into public.mw_task_sources (task_id, media_customer_id) values (pg_temp.id('tO'), '10000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select source_status from public.media_customers where id = '10000000-0000-0000-0000-00000000000c') = 'dang_dung', 'v2 Gắn source vào thẻ đang ở "Đang dựng" -> cập nhật ngay');
select pg_temp.ok((select count(*) from public.mw_activity where task_id = pg_temp.id('tO') and entity = 'kho') >= 3, 'v2 Mỗi lần cập nhật Kho có nhật ký');

-- Nội dung tạo từ thẻ có source khách -> bắt buộc consent
insert into public.mw_contents (workspace_id, task_id, title, consent_required) values (pg_temp.id('ws1'), pg_temp.id('tO'), 'Video gọt hàm từ order', false);
select pg_temp.ok((select consent_required from public.mw_contents where title = 'Video gọt hàm từ order'), 'v2 Nội dung từ thẻ dùng hình khách -> tự bật cần consent');

-- Kịch bản theo cảnh
insert into public.mw_task_scenes (task_id, sort_index, scene, content, source_ref, clip_from, clip_to)
  values (pg_temp.id('tO'), 1, 'Hook 3s', 'Gọt hàm có đau không?', pg_temp.id('src1'), '0:12', '0:15');
select pg_temp.ok((select count(*) from public.mw_task_scenes where task_id = pg_temp.id('tO')) = 1, 'v2 Thêm cảnh kịch bản trỏ source + đoạn cắt');
select pg_temp.err($q$ insert into public.mw_task_scenes (task_id, scene, clip_from) values (pg_temp.id('tO'), 'Sai', '12s') $q$, '%check%', 'v2 Đoạn cắt phải dạng mm:ss');
select pg_temp.err($q$ insert into public.mw_task_scenes (task_id, scene, source_ref) values (pg_temp.id('tA'), 'X', pg_temp.id('src1')) $q$,
  '%source đã gắn vào thẻ này%', 'v2 Cảnh chỉ trỏ source của chính thẻ đó');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.ok((select count(*) from public.mw_task_scenes where task_id = pg_temp.id('tO')) = 1, 'v2 Viewer đọc được kịch bản');
select pg_temp.err($q$ insert into public.mw_task_scenes (task_id, scene) values (pg_temp.id('tO'), 'X') $q$, '%row-level security%', 'v2 Viewer không sửa kịch bản');
select pg_temp.err($q$ select public.mw_apply_kho_status(pg_temp.id('tO')) $q$, '%permission denied%', 'v2 Hàm cập nhật Kho không gọi trực tiếp được');

select pg_temp.as_root();
\echo ==== ALL MARKETING WORKSPACE v2 SQL TESTS PASSED ====
