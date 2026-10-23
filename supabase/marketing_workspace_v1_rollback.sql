-- ============================================================
-- GỠ MARKETING WORKSPACE v1 — XOÁ TOÀN BỘ DỮ LIỆU mw_* (không hoàn tác được).
-- Trước khi chạy: sao lưu (Supabase -> Database -> Backups, hoặc export các bảng mw_*).
-- Không đụng tới bảng / dữ liệu cũ của app. Chỉ cần tắt tạm thời: chạy
--   update public.clinic_settings set mw_enabled = false;
-- (menu ẩn, dữ liệu giữ nguyên) — KHÔNG cần chạy file này.
-- ============================================================
begin;
-- v3 (chat / wiki / base / automation)
drop trigger if exists mw_task_auto on public.mw_tasks;
drop table if exists public.mw_automation_runs, public.mw_automations, public.mw_base_rows, public.mw_bases,
  public.mw_doc_versions, public.mw_docs, public.mw_messages cascade;
-- Báo nhóm Telegram Media (media_telegram_notify.sql): trigger trên bảng mw_* tự mất khi xoá bảng
drop function if exists public.mw_activity_tg(), public.mw_message_tg(), public.mw_content_tg() cascade;
drop function if exists public.mw_task_auto_trg(), public.mw_run_automations(uuid, text), public.mw_automation_guard(),
  public.mw_base_guard(), public.mw_base_ws(uuid), public.mw_doc_guard(), public.mw_message_guard() cascade;
alter table if exists public.mw_tasks drop column if exists location;
-- v2 (gắn source Kho Media): không đụng dữ liệu Kho, chỉ gỡ liên kết + kịch bản order
drop table if exists public.mw_task_scenes, public.mw_task_sources cascade;
drop trigger if exists mw_content_src on public.mw_contents;
drop trigger if exists mw_task_kho on public.mw_tasks;
drop trigger if exists mw_list_kho_default on public.mw_lists;
drop function if exists public.mw_scene_guard(), public.mw_content_src(), public.mw_source_after(), public.mw_source_guard(),
  public.mw_task_kho_trg(), public.mw_apply_kho_status(uuid), public.mw_list_kho_default(), public.mw_guess_kho_status(text, boolean),
  public.mw_can_use_kho() cascade;
drop function if exists public.mw_set_enabled(boolean), public.mw_cancel_publication(uuid), public.mw_verify_publication(uuid, boolean, text),
  public.mw_submit_publish_proof(uuid, text), public.mw_schedule_publication(uuid, timestamptz), public.mw_can_publish(uuid),
  public.mw_publication_gate(uuid), public.mw_verify_consent(uuid), public.mw_review_step(uuid, text, text), public.mw_consent_ok(uuid),
  public.mw_submit_approval(uuid), public.mw_snapshot_hash(uuid, uuid, uuid), public.mw_latest_version(uuid, text),
  public.mw_copy_task(uuid, uuid), public.mw_move_task(uuid, uuid, uuid, int), public.mw_create_board(uuid, text, text),
  public.mw_create_workspace(text, text, text) cascade;
drop table if exists public.mw_publications, public.mw_consents, public.mw_approval_steps, public.mw_approval_runs,
  public.mw_content_versions, public.mw_contents, public.mw_campaigns, public.mw_reviewers, public.mw_activity,
  public.mw_attachments, public.mw_comments, public.mw_checklist_items, public.mw_task_labels, public.mw_task_watchers,
  public.mw_task_assignees, public.mw_tasks, public.mw_labels, public.mw_lists, public.mw_boards, public.mw_members,
  public.mw_workspaces cascade;
drop function if exists public.mw_touch(), public.mw_ws_guard(), public.mw_member_guard(), public.mw_board_guard(), public.mw_list_guard(),
  public.mw_task_guard(), public.mw_task_after(), public.mw_assignee_guard(), public.mw_watcher_guard(), public.mw_label_guard(),
  public.mw_check_guard(), public.mw_comment_guard(), public.mw_attachment_log(), public.mw_content_guard(), public.mw_version_before(),
  public.mw_version_after(), public.mw_consent_guard(), public.mw_pub_guard(), public.mw_in_rpc(),
  public.mw_notify(uuid, text, text, text, text), public.mw_log(uuid, uuid, text, text, text, jsonb),
  public.mw_reviewer_can_view_content(uuid), public.mw_content_ws(uuid), public.mw_task_ws(uuid), public.mw_board_ws(uuid),
  public.mw_is_reviewer(text), public.mw_can_manage_ws(uuid), public.mw_can_edit_ws(uuid), public.mw_can_view_ws(uuid),
  public.mw_ws_role(uuid), public.mw_has_app_role(text), public.mw_is_admin(), public.mw_me_active() cascade;
alter table public.clinic_settings drop column if exists mw_enabled;
delete from public.role_permissions where module = 'mkt_workspace';
delete from public.notifications where type like 'mw\_%';
commit;
notify pgrst, 'reload schema';
