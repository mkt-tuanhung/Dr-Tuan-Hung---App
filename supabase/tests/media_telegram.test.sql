-- ============================================================
-- TEST thông báo nhóm Telegram Media (supabase/media_telegram_notify.sql).
-- Chạy nối tiếp sau test v1 + v2 + v3 trong cùng phiên psql (dùng pg_temp.* và ids).
-- ============================================================
select pg_temp.as_root();
-- Workspace: mọi thay đổi đã vào hàng đợi
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'mw' and payload->>'entity' = 'task' and payload->>'action' = 'created') > 0, 'TG Workspace: order (thẻ) mới vào hàng đợi');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'mw' and payload->>'entity' = 'task' and payload->>'action' = 'moved') > 0, 'TG Workspace: chuyển cột vào hàng đợi');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'mw' and payload->>'entity' = 'comment') > 0, 'TG Workspace: bình luận / @nhắc vào hàng đợi');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'mw' and payload->>'entity' = 'assignee') > 0, 'TG Workspace: giao việc vào hàng đợi');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'mw_chat') > 0, 'TG Workspace: chat vào hàng đợi');
select pg_temp.ok((select count(distinct group_key) from public.media_tg_outbox where kind = 'mw' and group_key = 'task:' || pg_temp.id('tAuto')) = 1, 'TG Workspace: gom theo thẻ (group_key)');
-- Tắt riêng 1 workspace -> không báo
update public.mw_workspaces set tg_media = false where id = pg_temp.id('ws1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'Thẻ không báo Telegram');
select pg_temp.as_root();
select pg_temp.ok(not exists (select 1 from public.media_tg_outbox where payload->'detail'->>'title' = 'Thẻ không báo Telegram'), 'TG Workspace tắt báo -> không vào hàng đợi');
update public.mw_workspaces set tg_media = true where id = pg_temp.id('ws1');

-- Kho Media: thẻ không có link source (Editor tự tạo) -> không báo; thêm link -> báo 1 lần
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.media_customers (customer_name, media_id, source_id, service) values ('Khách TG', '00000000-0000-0000-0000-0000000000c1', 'TG01102026_01', 'Hàm mặt');
insert into ids select 'srcTG', id from public.media_customers where source_id = 'TG01102026_01';
select pg_temp.as_root();
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'kho_source' and payload->>'source_id' = pg_temp.id('srcTG')::text) = 0, 'TG Kho: chưa có link source -> chưa báo');
update public.media_customers set source_links = '["https://drive.google.com/drive/folders/x"]' where id = pg_temp.id('srcTG');
update public.media_customers set source_links = '["https://drive.google.com/drive/folders/x","https://drive.google.com/drive/folders/y"]' where id = pg_temp.id('srcTG');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'kho_source' and payload->>'source_id' = pg_temp.id('srcTG')::text) = 1, 'TG Kho: Media thêm source -> báo đúng 1 lần');
insert into public.media_assets (drive_id, media_customer_id, name, kind) values ('tg-drive-1', pg_temp.id('srcTG'), 'IMG_01.jpg', 'image'), ('tg-drive-2', pg_temp.id('srcTG'), 'VID_01.mp4', 'video');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'kho_file' and group_key = 'src:' || pg_temp.id('srcTG')) = 2, 'TG Kho: file mới vào hàng đợi, gom theo source');

-- Clip: up mới / duyệt / lên Ads (1 lần)
insert into public.media_clips (media_customer_id, editor_id, title) values (pg_temp.id('srcTG'), '00000000-0000-0000-0000-0000000000c1', 'Clip TG V1');
insert into ids select 'clipTG', id from public.media_clips where title = 'Clip TG V1';
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'clip_new' and payload->>'clip_id' = pg_temp.id('clipTG')::text) = 1, 'TG Clip: Editor up clip mới');
update public.media_clips set stage = 'approved' where id = pg_temp.id('clipTG');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'clip_approved' and payload->>'clip_id' = pg_temp.id('clipTG')::text) = 1, 'TG Clip: được duyệt');
update public.media_clips set ad_status = 'dang_chay' where id = pg_temp.id('clipTG');
update public.media_clips set fb_status = 'ACTIVE' where id = pg_temp.id('clipTG');
update public.media_clips set fb_status = 'PAUSED' where id = pg_temp.id('clipTG');
update public.media_clips set fb_status = 'ACTIVE' where id = pg_temp.id('clipTG');
select pg_temp.ok((select count(*) from public.media_tg_outbox where kind = 'clip_running' and payload->>'clip_id' = pg_temp.id('clipTG')::text) = 1, 'TG Clip: lên Ads báo đúng 1 lần (bật/tắt lại không báo trùng)');
update public.media_clips set score = 7 where id = pg_temp.id('clipTG');
select pg_temp.ok((select count(*) from public.media_tg_outbox where payload->>'clip_id' = pg_temp.id('clipTG')::text) = 3, 'TG Clip: sửa khác (chấm điểm) không sinh tin thừa');

-- Quyền: người dùng app không đọc / không lấy được hàng đợi
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.err('select * from public.media_tg_outbox', '%permission denied%', 'TG Hàng đợi: người dùng app không đọc được');
select pg_temp.err('select * from public.media_tg_claim(10)', '%permission denied%', 'TG Hàng đợi: người dùng app không gọi được hàm nhận việc');
select pg_temp.err($q$ select public.media_tg_enqueue('mw', null, null, '{}'::jsonb) $q$, '%permission denied%', 'TG Hàng đợi: người dùng app không tự chèn tin');
select pg_temp.as_root();

-- Nhận việc: 1 lượt lấy hết, lượt chạy chồng ngay sau không lấy trùng
select pg_temp.ok((select count(*) from public.media_tg_claim(500)) > 0, 'TG Nhận việc: lấy được tin chờ');
select pg_temp.ok((select count(*) from public.media_tg_claim(500)) = (select count(*) from public.media_tg_outbox where sent_at is null and claimed_at is null), 'TG Nhận việc: lượt chồng không lấy lại tin đang gửi');

-- Tắt toàn bộ -> không ghi hàng đợi; lỗi thông báo không làm hỏng thao tác gốc
update public.clinic_settings set media_tg_enabled = false;
insert into public.media_clips (media_customer_id, title) values (pg_temp.id('srcTG'), 'Clip khi tắt');
select pg_temp.ok(not exists (select 1 from public.media_tg_outbox o join public.media_clips c on c.id = (o.payload->>'clip_id')::uuid where c.title = 'Clip khi tắt'), 'TG Tắt toàn bộ -> không báo');
update public.clinic_settings set media_tg_enabled = true;
select pg_temp.ok((select media_tg_chat_id from public.clinic_settings) = '-5363639582', 'TG Nhóm Media đã cấu hình');
\echo ==== ALL MEDIA TELEGRAM SQL TESTS PASSED ====
