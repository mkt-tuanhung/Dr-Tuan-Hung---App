-- ============================================================
-- TEST v3 (chat, wiki, base, automation, địa điểm). Chạy nối tiếp sau v1 + v2 test trong cùng phiên psql.
-- ============================================================
-- Chat
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');   -- viewer vẫn được nhắn
insert into public.mw_messages (workspace_id, body) values (pg_temp.id('ws1'), 'Chào team, nhờ @[Editor Media](staff:00000000-0000-0000-0000-0000000000c1) xem order');
insert into ids select 'msg1', id from public.mw_messages where body like 'Chào team%';
select pg_temp.as_root();
select pg_temp.ok((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and link like 'mkt_workspace#chat:%') = 1, 'v3 Chat: @nhắc thành viên -> thông báo');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok((select count(*) from public.mw_messages where workspace_id = pg_temp.id('ws1')) = 0, 'v3 Chat: người ngoài không đọc được');
select pg_temp.err($q$ insert into public.mw_messages (workspace_id, body) values (pg_temp.id('ws1'), 'x') $q$, '%row-level security%', 'v3 Chat: người ngoài không nhắn được');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.err($q$ update public.mw_messages set body = 'sửa' where id = pg_temp.id('msg1') $q$, '%Chỉ người gửi%', 'v3 Chat: không sửa tin của người khác');
update public.mw_messages set task_id = pg_temp.id('tA') where id = pg_temp.id('msg1');
select pg_temp.ok((select task_id from public.mw_messages where id = pg_temp.id('msg1')) = pg_temp.id('tA'), 'v3 Chat: gắn thẻ tạo từ tin nhắn');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
update public.mw_messages set deleted_at = now() where id = pg_temp.id('msg1');
select pg_temp.ok((select deleted_at is not null from public.mw_messages where id = pg_temp.id('msg1')), 'v3 Chat: người gửi xoá mềm tin của mình');

-- Wiki có phiên bản
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_docs (workspace_id, title, body) values (pg_temp.id('ws1'), 'Quy chuẩn kịch bản', 'Bản 1');
insert into ids select 'doc1', id from public.mw_docs where title = 'Quy chuẩn kịch bản';
update public.mw_docs set body = 'Bản 2' where id = pg_temp.id('doc1');
update public.mw_docs set body = 'Bản 3' where id = pg_temp.id('doc1');
select pg_temp.ok((select version from public.mw_docs where id = pg_temp.id('doc1')) = 3
  and (select string_agg(body, ',' order by version) from public.mw_doc_versions where doc_id = pg_temp.id('doc1')) = 'Bản 1,Bản 2', 'v3 Wiki: mỗi lần sửa lưu phiên bản cũ');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.ok(pg_temp.rows($q$ update public.mw_docs set body = 'hack' where id = pg_temp.id('doc1') $q$) = 0, 'v3 Wiki: người chỉ xem không sửa được');
select pg_temp.ok((select count(*) from public.mw_doc_versions where doc_id = pg_temp.id('doc1')) = 2, 'v3 Wiki: người chỉ xem đọc được lịch sử');

-- Base
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.mw_bases (workspace_id, name, fields) values (pg_temp.id('ws1'), 'KOL', '[{"id":"f1","name":"Tên","type":"text"},{"id":"f2","name":"Phí","type":"number"}]');
insert into ids select 'base1', id from public.mw_bases where name = 'KOL';
insert into public.mw_base_rows (base_id, data) values (pg_temp.id('base1'), '{"f1":"KOL A","f2":5000000}');
select pg_temp.ok((select data->>'f1' from public.mw_base_rows where base_id = pg_temp.id('base1')) = 'KOL A', 'v3 Base: thêm dòng dữ liệu');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok((select count(*) from public.mw_base_rows) = 0, 'v3 Base: người ngoài không đọc được');

-- Automation: thẻ vào cột "Đang dựng" -> giao người + nhãn + hạn + checklist + ưu tiên; ghi nhật ký
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.err($q$ insert into public.mw_automations (workspace_id, board_id, name, trigger_type, list_id, actions)
  values (pg_temp.id('ws1'), pg_temp.id('b1'), 'x', 'moved_to_list', pg_temp.id('l_edit'), '[{"type":"set_priority","value":"high"}]') $q$, '%row-level security%', 'v3 Automation: Thực hiện không tạo được luật (chỉ quản lý)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.mw_labels (workspace_id, name, color) values (pg_temp.id('ws1'), 'Đang dựng', '#E9A34B');
insert into public.mw_automations (workspace_id, board_id, name, trigger_type, list_id, actions) values
  (pg_temp.id('ws1'), pg_temp.id('b1'), 'Vào Đang dựng', 'moved_to_list', pg_temp.id('l_edit'), jsonb_build_array(
    jsonb_build_object('type', 'assign', 'user_id', '00000000-0000-0000-0000-0000000000c1'),
    jsonb_build_object('type', 'add_label', 'label_id', (select id from public.mw_labels where name = 'Đang dựng' and workspace_id = pg_temp.id('ws1'))),
    jsonb_build_object('type', 'set_due_days', 'days', 2),
    jsonb_build_object('type', 'set_priority', 'value', 'high'),
    jsonb_build_object('type', 'add_checklist', 'items', jsonb_build_array('Cắt hook', 'Chèn logo')),
    jsonb_build_object('type', 'notify', 'user_id', '00000000-0000-0000-0000-0000000000f3')));
select pg_temp.err($q$ insert into public.mw_automations (workspace_id, board_id, name, trigger_type, list_id, actions)
  values (pg_temp.id('ws1'), pg_temp.id('b1'), 'x', 'moved_to_list', pg_temp.id('l_b2'), '[{"type":"set_priority","value":"high"}]') $q$, '%Cột không thuộc board%', 'v3 Automation: cột phải thuộc board');
insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'Thẻ automation');
insert into ids select 'tAuto', id from public.mw_tasks where title = 'Thẻ automation';
select public.mw_move_task(pg_temp.id('tAuto'), pg_temp.id('l_edit'), null, (select version from public.mw_tasks where id = pg_temp.id('tAuto')));
select pg_temp.ok(exists (select 1 from public.mw_task_assignees where task_id = pg_temp.id('tAuto') and user_id = '00000000-0000-0000-0000-0000000000c1'), 'v3 Automation: giao người khi thẻ vào cột');
select pg_temp.ok((select count(*) from public.mw_task_labels where task_id = pg_temp.id('tAuto')) = 1, 'v3 Automation: gắn nhãn');
select pg_temp.ok((select priority from public.mw_tasks where id = pg_temp.id('tAuto')) = 'high'
  and (select to_char(due_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') from public.mw_tasks where id = pg_temp.id('tAuto')) = '17:00', 'v3 Automation: đặt ưu tiên + hạn 17:00');
select pg_temp.ok((select count(*) from public.mw_checklist_items where task_id = pg_temp.id('tAuto')) = 2, 'v3 Automation: thêm checklist');
select pg_temp.as_root();
select pg_temp.ok((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f3' and type = 'mw_automation') = 1, 'v3 Automation: gửi thông báo');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select ok from public.mw_automation_runs order by id desc limit 1), 'v3 Automation: ghi nhật ký chạy thành công');
select pg_temp.err($q$ select public.mw_run_automations(pg_temp.id('tAuto'), 'moved_to_list') $q$, '%permission denied%', 'v3 Automation: không gọi trực tiếp hàm chạy luật');
-- luật tắt -> không chạy
update public.mw_automations set enabled = false where name = 'Vào Đang dựng';
insert into public.mw_tasks (board_id, list_id, title) values (pg_temp.id('b1'), pg_temp.id('l_idea'), 'Thẻ không auto');
select public.mw_move_task((select id from public.mw_tasks where title = 'Thẻ không auto'), pg_temp.id('l_edit'), null, 1);
select pg_temp.ok((select priority from public.mw_tasks where title = 'Thẻ không auto') = 'normal', 'v3 Automation: luật tắt thì không chạy');

-- Địa điểm
update public.mw_tasks set location = 'Bệnh viện Thẩm mỹ, Hà Nội' where id = pg_temp.id('tAuto') and version = (select version from public.mw_tasks where id = pg_temp.id('tAuto'));
select pg_temp.ok((select location from public.mw_tasks where id = pg_temp.id('tAuto')) is not null, 'v3 Địa điểm thẻ (view Map)');

select pg_temp.as_root();
\echo ==== ALL MARKETING WORKSPACE v3 SQL TESTS PASSED ====
