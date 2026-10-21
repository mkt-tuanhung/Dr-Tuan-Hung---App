-- ============================================================
-- TEST Marketing Workspace v1 trên PostgreSQL THẬT (cục bộ) — KHÔNG chạy trên Supabase production.
-- Chạy: xem supabase/tests/README.md (tạo DB trống -> supabase_stub.sql -> marketing_workspace_v1.sql -> file này).
-- Mỗi kiểm tra in "PASS <tên>"; sai thì dừng với "FAIL <tên>".
-- Người dùng giả lập bằng JWT claims (giống PostgREST / Supabase): role authenticated + sub = id nhân sự.
-- ============================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ---------- Dữ liệu nhân sự ----------
insert into public.profiles (id, full_name, role, role_2, is_active, employment_status) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000b1', 'Marketing Lead', 'marketing', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000c1', 'Editor Media', 'media', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000d1', 'Viewer', 'telesale', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000e1', 'Outsider MKT', 'marketing', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000f1', 'Bác sĩ duyệt', 'bac_si', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000f2', 'Compliance', 'cskh', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000f3', 'Publisher', 'marketing', null, true, 'official'),
  ('00000000-0000-0000-0000-0000000000f4', 'Đã nghỉ', 'marketing', null, false, 'inactive')
on conflict (id) do nothing;

-- ---------- Tiện ích test ----------
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', '', false); execute 'set role anon'; end $$;
create or replace function pg_temp.as_root() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end $$;
create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin if coalesce(p_cond, false) then raise notice 'PASS %', p_name; else raise exception 'FAIL %', p_name; end if; end $$;
-- Câu lệnh phải BÁO LỖI (khớp mẫu) — lỗi khác hoặc không lỗi = FAIL
create or replace function pg_temp.err(p_sql text, p_like text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike p_like then raise notice 'PASS % (%)', p_name, sqlerrm; return; end if;
    raise exception 'FAIL % — lỗi khác mong đợi: %', p_name, sqlerrm;
  end;
  raise exception 'FAIL % — không báo lỗi', p_name;
end $$;
-- Số dòng ảnh hưởng của 1 câu UPDATE/DELETE (RLS lọc -> 0)
create or replace function pg_temp.rows(p_sql text) returns int language plpgsql as $$
declare n int; begin execute p_sql; get diagnostics n = row_count; return n; end $$;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon;
create or replace function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;

-- ============ P0 tích hợp / quyền ============
select pg_temp.as_anon();
select pg_temp.err('select * from public.mw_workspaces', '%permission denied%', 'T01 anon không đọc được workspace');
select pg_temp.as_root();

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select pg_temp.err($q$ select public.mw_create_workspace('X') $q$, '%khoá%', 'T01 tài khoản đã nghỉ không tạo được workspace');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.err($q$ select public.mw_create_workspace('X') $q$, '%Chỉ Admin hoặc Marketing%', 'Vai trò media không tự tạo workspace');
select pg_temp.err($q$ insert into public.mw_workspaces (name, owner_id) values ('X', '00000000-0000-0000-0000-0000000000c1') $q$, '%row-level security%', 'Không chèn workspace trực tiếp (phải qua RPC)');

-- Marketing Lead tạo workspace + board mẫu video, thêm thành viên
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ids values ('ws1', public.mw_create_workspace('Marketing chính', 'Workspace test'));
insert into ids values ('b1', public.mw_create_board(pg_temp.id('ws1'), 'Sản xuất video', 'video'));
insert into ids values ('b2', public.mw_create_board(pg_temp.id('ws1'), 'Thiết kế', 'design'));
select pg_temp.ok((select count(*) from public.mw_lists where board_id = pg_temp.id('b1')) = 12, 'Board mẫu video có 12 cột');
insert into public.mw_members (workspace_id, user_id, role) values
  (pg_temp.id('ws1'), '00000000-0000-0000-0000-0000000000c1', 'editor'),
  (pg_temp.id('ws1'), '00000000-0000-0000-0000-0000000000d1', 'viewer'),
  (pg_temp.id('ws1'), '00000000-0000-0000-0000-0000000000f3', 'editor');
select pg_temp.err($q$ insert into public.mw_members (workspace_id, user_id, role) values (pg_temp.id('ws1'), '00000000-0000-0000-0000-0000000000f4', 'editor') $q$,
  '%đã nghỉ%', 'Không thêm nhân sự đã nghỉ vào workspace');
select pg_temp.err($q$ delete from public.mw_members where workspace_id = pg_temp.id('ws1') and user_id = '00000000-0000-0000-0000-0000000000b1' $q$,
  '%chủ workspace%', 'Không gỡ được chủ workspace');
insert into ids select 'l_idea', id from public.mw_lists where board_id = pg_temp.id('b1') and name = 'Ý tưởng';
insert into ids select 'l_script', id from public.mw_lists where board_id = pg_temp.id('b1') and name = 'Viết kịch bản';
insert into ids select 'l_done', id from public.mw_lists where board_id = pg_temp.id('b1') and name = 'Đã đăng';
insert into ids select 'l_b2', id from public.mw_lists where board_id = pg_temp.id('b2') order by sort_index limit 1;

-- Workspace thứ 2 của người khác (Outsider)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into ids values ('ws2', public.mw_create_workspace('Workspace riêng'));
insert into ids values ('b3', public.mw_create_board(pg_temp.id('ws2'), 'Bảng riêng', 'blank'));
insert into ids select 'l_b3', id from public.mw_lists where board_id = pg_temp.id('b3') order by sort_index limit 1;
insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b3'), pg_temp.id('l_b3'), 'Việc bí mật');
select pg_temp.ok((select count(*) from public.mw_workspaces where id = pg_temp.id('ws1')) = 0, 'T02 người ngoài không thấy workspace khác (không lộ metadata)');
select pg_temp.ok((select count(*) from public.mw_boards where workspace_id = pg_temp.id('ws1')) = 0, 'T02 người ngoài không thấy board');
select pg_temp.err($q$ insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'chen') $q$, '%row-level security%', 'T02 người ngoài không tạo thẻ trong workspace khác');

-- ============ P0 thẻ / kéo thả ============
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_tasks (board_id, list_id, title, priority) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'Thẻ A', 'high');
insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'Thẻ B');
insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'Thẻ C');
insert into ids select 'tA', id from public.mw_tasks where title = 'Thẻ A';
insert into ids select 'tB', id from public.mw_tasks where title = 'Thẻ B';
insert into ids select 'tC', id from public.mw_tasks where title = 'Thẻ C';
select pg_temp.ok((select created_by from public.mw_tasks where id = pg_temp.id('tA')) = '00000000-0000-0000-0000-0000000000c1', 'T04 tạo thẻ: người tạo do DB đặt');
select pg_temp.ok((select count(*) from public.mw_tasks where board_id = pg_temp.id('b3')) = 0, 'T02 thành viên ws1 không thấy thẻ ws2');

-- Kéo C lên giữa A và B
select public.mw_move_task(pg_temp.id('tC'), pg_temp.id('l_idea'), pg_temp.id('tA'), 1);
select pg_temp.ok((select array_agg(title order by sort_index) from public.mw_tasks where list_id = pg_temp.id('l_idea')) = array['Thẻ A', 'Thẻ C', 'Thẻ B'],
  'T05 sắp xếp lại trong cột giữ đúng thứ tự');
-- Xung đột phiên bản (2 người cùng kéo)
select pg_temp.err($q$ select public.mw_move_task(pg_temp.id('tC'), pg_temp.id('l_script'), null, 1) $q$, '%Xung đột%', 'T05 kéo đồng thời: bản cũ bị từ chối');
select public.mw_move_task(pg_temp.id('tC'), pg_temp.id('l_script'), null, 2);
select pg_temp.ok((select list_id from public.mw_tasks where id = pg_temp.id('tC')) = pg_temp.id('l_script'), 'Chuyển cột lưu vào DB');
select pg_temp.ok(exists (select 1 from public.mw_activity where task_id = pg_temp.id('tC') and action = 'moved'), 'Nhật ký ghi lần chuyển cột');
-- Sang board khác cùng workspace
select public.mw_move_task(pg_temp.id('tB'), pg_temp.id('l_b2'), null, (select version from public.mw_tasks where id = pg_temp.id('tB')));
select pg_temp.ok((select board_id from public.mw_tasks where id = pg_temp.id('tB')) = pg_temp.id('b2'), 'T06 chuyển thẻ sang board khác cùng workspace');
select pg_temp.err($q$ update public.mw_tasks set board_id = pg_temp.id('b1') where id = pg_temp.id('tB') $q$, '%Di chuyển%', 'Không đổi board bằng PATCH trực tiếp');
-- Giới hạn WIP
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
update public.mw_lists set wip_limit = 1 where id = pg_temp.id('l_script');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.err($q$ select public.mw_move_task(pg_temp.id('tA'), pg_temp.id('l_script'), null, (select version from public.mw_tasks where id = pg_temp.id('tA'))) $q$,
  '%WIP%', 'Cột đạt giới hạn WIP thì chặn chuyển');
-- Cột Hoàn thành -> completed_at
select public.mw_move_task(pg_temp.id('tA'), pg_temp.id('l_done'), null, (select version from public.mw_tasks where id = pg_temp.id('tA')));
select pg_temp.ok((select completed_at is not null from public.mw_tasks where id = pg_temp.id('tA')), 'Vào cột "Đã đăng" (is_done) -> ghi thời điểm hoàn thành');
-- Sửa hạn (lịch) đồng bộ: 1 bản ghi
update public.mw_tasks set due_at = '2026-11-01T10:00:00+07' where id = pg_temp.id('tC');
select pg_temp.ok((select count(*) from public.mw_tasks where title = 'Thẻ C') = 1 and (select due_at from public.mw_tasks where id = pg_temp.id('tC')) = '2026-11-01T03:00:00Z',
  'T09 đổi hạn trên lịch = sửa đúng 1 thẻ (không nhân bản), lưu UTC');

-- Người phụ trách / nhắc tên / bình luận
select pg_temp.err($q$ insert into public.mw_task_assignees (task_id, user_id) values (pg_temp.id('tC'), '00000000-0000-0000-0000-0000000000e1') $q$,
  '%thành viên workspace%', 'Người phụ trách phải là thành viên workspace');
insert into public.mw_task_assignees (task_id, user_id) values (pg_temp.id('tC'), '00000000-0000-0000-0000-0000000000f3');
select pg_temp.as_root();
select pg_temp.ok((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f3' and type = 'mw_assigned') = 1, 'Giao việc gửi đúng 1 thông báo');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_comments (task_id, body) values (pg_temp.id('tC'),
  'Nhờ @[Publisher](staff:00000000-0000-0000-0000-0000000000f3) và @[Outsider MKT](staff:00000000-0000-0000-0000-0000000000e1) xem giúp');
select pg_temp.as_root();
select pg_temp.ok((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f3' and type = 'mw_mention') = 1
  and (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1') = 0,
  'T11 @nhắc tên chỉ báo người có quyền xem (người ngoài không nhận)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.ok(pg_temp.rows($q$ update public.mw_comments set body = 'sửa trộm' where task_id = pg_temp.id('tC') $q$) = 0, 'Không sửa được bình luận của người khác');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.err($q$ insert into public.mw_comments (task_id, body) values (pg_temp.id('tC'), 'viewer') $q$, '%row-level security%', 'Người xem (viewer) không bình luận được');
select pg_temp.ok(pg_temp.rows($q$ update public.mw_tasks set title = 'viewer sửa' where id = pg_temp.id('tC') $q$) = 0, 'Người xem không sửa thẻ');
select pg_temp.ok((select count(*) from public.mw_tasks where board_id = pg_temp.id('b1')) >= 2, 'Người xem vẫn đọc được thẻ');

-- Checklist
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_checklist_items (task_id, title, assignee_id, due_at) values (pg_temp.id('tC'), 'Viết hook', '00000000-0000-0000-0000-0000000000f3', now() + interval '1 day');
update public.mw_checklist_items set done = true where task_id = pg_temp.id('tC');
select pg_temp.ok((select done_by from public.mw_checklist_items where task_id = pg_temp.id('tC')) = '00000000-0000-0000-0000-0000000000c1', 'T07 checklist có người phụ trách / hạn / người hoàn thành');

-- ============ P0 nội dung y khoa / gate xuất bản ============
select pg_temp.as_root();
insert into public.mw_reviewers (user_id, kind) values
  ('00000000-0000-0000-0000-0000000000f1', 'medical'), ('00000000-0000-0000-0000-0000000000b1', 'marketing'),
  ('00000000-0000-0000-0000-0000000000f2', 'compliance'), ('00000000-0000-0000-0000-0000000000f3', 'publisher');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.err($q$ insert into public.mw_reviewers (user_id, kind) values ('00000000-0000-0000-0000-0000000000c1', 'medical') $q$, '%row-level security%', 'Chỉ Admin cấp quyền duyệt');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_contents (workspace_id, title, platforms) values (pg_temp.id('ws1'), 'Gọt hàm có đau không?', array['tiktok', 'facebook']);
insert into ids select 'c1', id from public.mw_contents where title = 'Gọt hàm có đau không?';
select pg_temp.err($q$ update public.mw_contents set workflow_status = 'approved' where id = pg_temp.id('c1') $q$, '%quy trình duyệt%', 'Trình duyệt không tự đặt "approved"');
select pg_temp.err($q$ insert into public.mw_contents (workspace_id, title, workflow_status) values (pg_temp.id('ws1'), 'x', 'published') $q$, '%hệ thống duyệt%', 'Không tạo nội dung ở trạng thái "published"');
select pg_temp.err($q$ select public.mw_submit_approval(pg_temp.id('c1')) $q$, '%kịch bản hoặc tệp%', 'Gửi duyệt cần có kịch bản / tệp');
insert into public.mw_content_versions (content_id, kind, body) values (pg_temp.id('c1'), 'script', 'Kịch bản v1: giải thích đơn giản, không cam kết kết quả');
insert into public.mw_content_versions (content_id, kind, file_url, sha256, file_name) values
  (pg_temp.id('c1'), 'asset', 'https://cdn.example.com/v1.mp4', repeat('a', 64), 'v1.mp4');
insert into public.mw_content_versions (content_id, kind, body) values (pg_temp.id('c1'), 'caption', 'Caption v1 #hammat');
select pg_temp.ok(pg_temp.rows($q$ update public.mw_content_versions set body = 'đổi lén' where content_id = pg_temp.id('c1') $q$) = 0, 'Phiên bản đã lưu không sửa được (bất biến)');
select pg_temp.ok(pg_temp.rows($q$ delete from public.mw_content_versions where content_id = pg_temp.id('c1') $q$) = 0, 'Phiên bản không xoá được');
insert into ids values ('run1', public.mw_submit_approval(pg_temp.id('c1')));
select pg_temp.ok((select workflow_status from public.mw_contents where id = pg_temp.id('c1')) = 'in_review', 'Gửi duyệt -> in_review');
select pg_temp.ok((select array_agg(kind || ':' || state order by seq) from public.mw_approval_steps where run_id = pg_temp.id('run1'))
  = array['medical:pending', 'marketing:waiting', 'compliance:waiting'], 'T13 duyệt tuần tự: chuyên môn -> marketing -> kiểm duyệt');
select pg_temp.err($q$ insert into public.mw_approval_runs (content_id, snapshot_hash, state) values (pg_temp.id('c1'), 'x', 'approved') $q$, '%permission denied%', 'Không tạo bản ghi duyệt trực tiếp');
select pg_temp.err($q$ update public.mw_approval_steps set state = 'approved' $q$, '%permission denied%', 'Không sửa bước duyệt trực tiếp');
-- Không phải người duyệt chuyên môn
select pg_temp.err(format($q$ select public.mw_review_step(%L, 'approve') $q$, (select id from public.mw_approval_steps where run_id = pg_temp.id('run1') and seq = 1)),
  '%không được cấp quyền%', 'Người không có quyền chuyên môn không duyệt được');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.err(format($q$ select public.mw_review_step(%L, 'approve') $q$, (select id from public.mw_approval_steps where run_id = pg_temp.id('run1') and seq = 1)),
  '%không được cấp quyền%', 'Admin KHÔNG mặc nhiên duyệt chuyên môn');
-- Bác sĩ (không là thành viên workspace) xem được nội dung đang chờ duyệt, KHÔNG xem được bảng công việc
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.ok((select count(*) from public.mw_contents where id = pg_temp.id('c1')) = 1 and (select count(*) from public.mw_tasks) = 0,
  'Người duyệt chuyên môn chỉ thấy nội dung được gửi duyệt, không thấy thẻ công việc');
select pg_temp.err(format($q$ select public.mw_review_step(%L, 'revision') $q$, (select id from public.mw_approval_steps where run_id = pg_temp.id('run1') and seq = 1)),
  '%lý do%', 'Trả lại bắt buộc ghi lý do');
select public.mw_review_step((select id from public.mw_approval_steps where run_id = pg_temp.id('run1') and seq = 1), 'approve', 'Thông tin chuyên môn đúng');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.mw_review_step((select id from public.mw_approval_steps where run_id = pg_temp.id('run1') and seq = 2), 'approve');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select public.mw_review_step((select id from public.mw_approval_steps where run_id = pg_temp.id('run1') and seq = 3), 'approve');
select pg_temp.ok((select state from public.mw_approval_runs where id = pg_temp.id('run1')) = 'approved'
  and (select workflow_status from public.mw_contents where id = pg_temp.id('c1')) = 'approved', 'Duyệt đủ 3 bước -> approved');

-- Xuất bản: bài đăng + lên lịch + bằng chứng + xác minh
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_publications (content_id, platform, caption_version_id, asset_version_id) values
  (pg_temp.id('c1'), 'tiktok', public.mw_latest_version(pg_temp.id('c1'), 'caption'), public.mw_latest_version(pg_temp.id('c1'), 'asset'));
insert into ids select 'p1', id from public.mw_publications where content_id = pg_temp.id('c1') and platform = 'tiktok';
select pg_temp.err($q$ update public.mw_publications set state = 'published' where id = pg_temp.id('p1') $q$, '%Lên lịch / Xác minh%', 'Không tự đặt "published" bằng PATCH');
select pg_temp.err($q$ insert into public.mw_publications (content_id, platform, state) values (pg_temp.id('c1'), 'facebook', 'published') $q$, '%Nháp%', 'Không tạo bài ở trạng thái đã đăng');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
create temp table r1 as select public.mw_schedule_publication(pg_temp.id('p1'), now() + interval '1 hour') as reason;
select pg_temp.ok((select reason from r1) is null and (select state from public.mw_publications where id = pg_temp.id('p1')) = 'scheduled', 'Đủ điều kiện -> lên lịch đăng (thủ công)');
select pg_temp.err($q$ select public.mw_submit_publish_proof(pg_temp.id('p1'), 'khong-phai-link') $q$, '%không hợp lệ%', 'T20 link bằng chứng phải là URL');
select pg_temp.ok(public.mw_submit_publish_proof(pg_temp.id('p1'), 'https://www.tiktok.com/@drtuanhung/video/123') is null, 'Nộp link bằng chứng đăng thủ công');
select pg_temp.err($q$ select public.mw_verify_publication(pg_temp.id('p1'), true) $q$, '%không tự xác minh%', 'T20 người nộp link không tự xác minh');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.mw_verify_publication(pg_temp.id('p1'), true);
select pg_temp.ok((select state from public.mw_publications where id = pg_temp.id('p1')) = 'published'
  and (select verified_by from public.mw_publications where id = pg_temp.id('p1')) = '00000000-0000-0000-0000-0000000000b1', 'T20 "Đã đăng" chỉ sau khi người khác xác minh bằng chứng');

-- T15: đổi caption sau duyệt -> duyệt mất hiệu lực, lịch đăng bị khoá
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_publications (content_id, platform, caption_version_id, asset_version_id) values
  (pg_temp.id('c1'), 'facebook', public.mw_latest_version(pg_temp.id('c1'), 'caption'), public.mw_latest_version(pg_temp.id('c1'), 'asset'));
insert into ids select 'p2', id from public.mw_publications where content_id = pg_temp.id('c1') and platform = 'facebook';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select public.mw_schedule_publication(pg_temp.id('p2'), now() + interval '2 hour');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_content_versions (content_id, kind, body) values (pg_temp.id('c1'), 'caption', 'Caption v2 — sửa 1 chữ');
select pg_temp.ok((select state from public.mw_approval_runs where id = pg_temp.id('run1')) = 'invalidated', 'T15 caption mới -> duyệt cũ mất hiệu lực');
select pg_temp.ok((select state from public.mw_publications where id = pg_temp.id('p2')) = 'blocked', 'T15 lịch đăng chưa đăng bị khoá');
select pg_temp.ok((select state from public.mw_publications where id = pg_temp.id('p1')) = 'published', 'Bài đã đăng giữ nguyên lịch sử');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
create temp table r2 as select public.mw_schedule_publication(pg_temp.id('p2'), now() + interval '2 hour') as reason;
select pg_temp.ok((select reason from r2) is not null and (select state from public.mw_publications where id = pg_temp.id('p2')) = 'blocked', 'Lên lịch lại khi chưa duyệt lại -> vẫn bị chặn, có lý do');

-- Duyệt lại nhưng phiên bản đổi GIỮA chừng -> bước duyệt bị vô hiệu, không duyệt âm thầm
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids values ('run2', public.mw_submit_approval(pg_temp.id('c1')));
insert into public.mw_content_versions (content_id, kind, file_url, sha256, file_name) values
  (pg_temp.id('c1'), 'asset', 'https://cdn.example.com/v2.mp4', repeat('b', 64), 'v2.mp4');
select pg_temp.ok((select state from public.mw_approval_runs where id = pg_temp.id('run2')) = 'invalidated', 'Tệp mới khi đang duyệt -> lượt duyệt bị vô hiệu');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.err(format($q$ select public.mw_review_step(%L, 'approve') $q$, (select id from public.mw_approval_steps where run_id = pg_temp.id('run2') and seq = 1)),
  '%không còn chờ%', 'Không duyệt được lượt đã vô hiệu');

-- T16 consent bắt buộc
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_contents (workspace_id, title, consent_required) values (pg_temp.id('ws1'), 'Hành trình hồi phục KH', true);
insert into ids select 'c2', id from public.mw_contents where title = 'Hành trình hồi phục KH';
insert into public.mw_content_versions (content_id, kind, file_url, sha256) values (pg_temp.id('c2'), 'asset', 'https://cdn.example.com/kh.mp4', repeat('c', 64));
insert into public.mw_content_versions (content_id, kind, body) values (pg_temp.id('c2'), 'caption', 'Hành trình hồi phục');
insert into ids values ('run3', public.mw_submit_approval(pg_temp.id('c2')));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select public.mw_review_step((select id from public.mw_approval_steps where run_id = pg_temp.id('run3') and seq = 1), 'approve');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.mw_review_step((select id from public.mw_approval_steps where run_id = pg_temp.id('run3') and seq = 2), 'approve');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.err(format($q$ select public.mw_review_step(%L, 'approve') $q$, (select id from public.mw_approval_steps where run_id = pg_temp.id('run3') and seq = 3)),
  '%consent%', 'T16 thiếu consent -> không duyệt bước kiểm duyệt được');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_consents (content_id, consent_ref, scope, valid_until) values (pg_temp.id('c2'), 'CS-2026-001', 'TikTok, Facebook — video hồi phục', current_date + 30);
insert into ids select 'cs1', id from public.mw_consents where consent_ref = 'CS-2026-001';
select pg_temp.ok(pg_temp.rows($q$ update public.mw_consents set verified_at = now() where id = pg_temp.id('cs1') $q$) = 0
  and (select verified_at from public.mw_consents where id = pg_temp.id('cs1')) is null, 'Biên tập viên không tự xác minh consent');
select pg_temp.err($q$ select public.mw_verify_consent(pg_temp.id('cs1')) $q$, '%compliance%', 'Chỉ compliance xác minh consent');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select public.mw_verify_consent(pg_temp.id('cs1'));
select public.mw_review_step((select id from public.mw_approval_steps where run_id = pg_temp.id('run3') and seq = 3), 'approve');
select pg_temp.ok((select state from public.mw_approval_runs where id = pg_temp.id('run3')) = 'approved', 'Consent hợp lệ -> duyệt đủ');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_publications (content_id, platform, caption_version_id, asset_version_id) values
  (pg_temp.id('c2'), 'facebook', public.mw_latest_version(pg_temp.id('c2'), 'caption'), public.mw_latest_version(pg_temp.id('c2'), 'asset'));
insert into ids select 'p3', id from public.mw_publications where content_id = pg_temp.id('c2');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok(public.mw_schedule_publication(pg_temp.id('p3'), now() + interval '1 day') is null, 'Lên lịch nội dung có consent');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
update public.mw_consents set revoked_at = now() where id = pg_temp.id('cs1');
select pg_temp.ok((select count(*) from public.mw_publications) = 0, 'Compliance (không là thành viên) không xem được lịch đăng');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select state from public.mw_publications where id = pg_temp.id('p3')) = 'blocked', 'Thu hồi consent -> lịch đăng bị khoá ngay');
select pg_temp.ok(public.mw_schedule_publication(pg_temp.id('p3'), now() + interval '1 day') ilike '%consent%', 'Không lên lịch lại được khi consent đã thu hồi');

-- Người ngoài không đọc gate / không lên lịch bài của workspace khác
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok(public.mw_publication_gate(pg_temp.id('p3')) = 'Không tìm thấy bài đăng', 'Gate không lộ thông tin cho người ngoài');
select pg_temp.err($q$ select public.mw_schedule_publication(pg_temp.id('p3'), now()) $q$, '%Không tìm thấy%', 'Người ngoài không lên lịch được (không lộ bài tồn tại)');

-- Hàm nội bộ không gọi được từ trình duyệt
select pg_temp.err($q$ select public.mw_log(pg_temp.id('ws1'), null, 'x', 'x', 'x', '{}') $q$, '%permission denied%', 'mw_log không gọi trực tiếp được');
select pg_temp.err($q$ insert into public.mw_activity (workspace_id, entity, action) values (pg_temp.id('ws1'), 'x', 'x') $q$, '%permission denied%', 'Nhật ký không ghi tay được');

-- Cờ bật module
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.err($q$ select public.mw_set_enabled(true) $q$, '%Chỉ Admin%', 'Chỉ Admin bật module');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.mw_set_enabled(true);
select pg_temp.ok((select mw_enabled from public.clinic_settings) = true, 'Admin bật module');

-- T14 Quy trình có điều kiện: nội dung KHÔNG cần duyệt y khoa -> chỉ 2 bước (marketing -> pháp lý)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.mw_contents (workspace_id, title, medical_review_required) values (pg_temp.id('ws1'), 'Banner khuyến mãi', false);
insert into ids select 'c4', id from public.mw_contents where title = 'Banner khuyến mãi';
insert into public.mw_content_versions (content_id, kind, body) values (pg_temp.id('c4'), 'script', 'Ưu đãi tháng 11'), (pg_temp.id('c4'), 'caption', 'Ưu đãi #drtuanhung');
create temp table r4 as select public.mw_submit_approval(pg_temp.id('c4')) as run_id;
select pg_temp.ok((select string_agg(kind, ',' order by seq) from public.mw_approval_steps where run_id = (select run_id from r4)) = 'marketing,compliance',
  'T14 Nội dung không cần duyệt y khoa -> bước Marketing rồi Pháp lý (bỏ bước bác sĩ)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.ok((select count(*) from public.mw_approval_runs where content_id = pg_temp.id('c4')) = 0, 'T14 Bác sĩ không thấy nội dung không gửi tới bước y khoa');

-- Compliance không chạm consent của nội dung chưa gửi tới mình (không phải thành viên, chưa có lượt duyệt)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.mw_contents (workspace_id, title, consent_required) values (pg_temp.id('ws1'), 'Nội dung nháp có consent', true);
insert into ids select 'c3', id from public.mw_contents where title = 'Nội dung nháp có consent';
insert into public.mw_consents (content_id, consent_ref, scope) values (pg_temp.id('c3'), 'CS-NHAP-1', 'ảnh');
insert into ids select 'cs3', id from public.mw_consents where consent_ref = 'CS-NHAP-1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.err($q$ select public.mw_verify_consent(pg_temp.id('cs3')) $q$, '%không tồn tại%', 'Compliance không xác minh consent của nội dung chưa gửi duyệt tới mình');
select pg_temp.ok(pg_temp.rows($q$ update public.mw_consents set revoked_at = now() where id = pg_temp.id('cs3') $q$) = 0, 'Compliance không thu hồi consent của nội dung không được xem');

-- Nhật ký checklist / nhãn + xoá dây chuyền không lỗi
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select count(*) from public.mw_activity where task_id = pg_temp.id('tC') and entity = 'checklist' and action in ('added', 'checked')) >= 2, 'Checklist thêm / hoàn thành có nhật ký');
insert into public.mw_labels (workspace_id, name, color) values (pg_temp.id('ws1'), 'Nhãn tạm', '#087F83');
insert into ids select 'lbTmp', id from public.mw_labels where name = 'Nhãn tạm';
insert into public.mw_task_labels (task_id, label_id) values (pg_temp.id('tC'), pg_temp.id('lbTmp'));
delete from public.mw_labels where id = pg_temp.id('lbTmp');
select pg_temp.ok((select count(*) from public.mw_activity where task_id = pg_temp.id('tC') and entity = 'label' and action in ('added', 'removed')) = 2, 'Gắn / gỡ nhãn có nhật ký (kể cả xoá nhãn dây chuyền)');
select pg_temp.as_root();
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, false);
insert into ids select 'wsTmp', public.mw_create_workspace('WS xoá thử');
select set_config('request.jwt.claims', '', false);
insert into public.mw_members (workspace_id, user_id, role) values (pg_temp.id('wsTmp'), '00000000-0000-0000-0000-0000000000c1', 'editor');
delete from public.mw_workspaces where id = pg_temp.id('wsTmp');
select pg_temp.ok(not exists (select 1 from public.mw_members where workspace_id = pg_temp.id('wsTmp')), 'Xoá workspace (service) dây chuyền sạch, không lỗi nhật ký');

select pg_temp.as_root();
\echo ==== ALL MARKETING WORKSPACE SQL TESTS PASSED ====
