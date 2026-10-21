# API CONTRACT — Marketing Workspace v1

Mọi API là **Supabase PostgREST** của project hiện có (cùng phiên đăng nhập, cùng anon key). Không có server riêng.
Lớp gọi ở frontend: `apps/web/src/features/marketingWorkspace/mwApi.js`. Schema: `supabase/marketing_workspace_v1.sql`.

Quy ước lỗi (PostgreSQL `errcode` → `mwError`):

| errcode | Ý nghĩa | Hiển thị |
|---|---|---|
| `42501` | Không có quyền / không thấy đối tượng (không lộ tồn tại) | “Bạn không có quyền…” hoặc thông báo gốc |
| `40001` | Xung đột phiên bản thẻ (người khác vừa sửa) | Hoàn tác + tải lại |
| `22023` | Dữ liệu / trạng thái không hợp lệ | Thông báo gốc tiếng Việt |
| `23514` | Vượt giới hạn WIP | Thông báo gốc |
| `42P01` / `PGRST205` | Chưa chạy migration | “Chưa cài Marketing Workspace…” |

UPDATE / DELETE qua REST mà RLS chặn trả **0 dòng** (không lỗi) → `mwApi` coi là lỗi quyền (`one()`).

## 1. Bảng (REST `/rest/v1/<table>`)

| Bảng | SELECT | INSERT | UPDATE | DELETE | Ghi chú bảo vệ (trigger) |
|---|---|---|---|---|---|
| `mw_workspaces` | thành viên / Admin | **không** (dùng RPC) | manage | — | không đổi `owner_id` |
| `mw_members` | thành viên | manage | manage | manage | người đã nghỉ bị từ chối; vai trò `manager` chỉ owner/Admin cấp; không gỡ / hạ chủ |
| `mw_boards` | thành viên | manage | manage (tên, lưu trữ) | — | |
| `mw_lists` | thành viên | manage | manage (tên, WIP, `is_done`, `sort_index`, lưu trữ) | — | |
| `mw_labels` | thành viên | edit | edit | manage | |
| `mw_tasks` | thành viên | edit | edit — **phải** kèm `version` hiện tại (khoá lạc quan) | — (lưu trữ `archived_at`) | `version++`; đổi board chỉ qua RPC; `completed_at` tự đặt theo cột hoàn thành |
| `mw_task_assignees` | thành viên | edit | — | edit | người được giao phải là thành viên → thông báo `mw_assigned` |
| `mw_task_watchers` | thành viên | tự theo dõi / edit | — | tự bỏ / edit | phải là thành viên |
| `mw_task_labels` | thành viên | edit | — | edit | nhãn cùng workspace; ghi nhật ký |
| `mw_checklist_items` | thành viên | edit | edit | edit | người phụ trách là thành viên → `mw_check_assigned`; `done_by/done_at` tự đặt |
| `mw_comments` | thành viên | edit | tác giả (sửa / xoá mềm `deleted_at`) | — | `@[Tên](staff:id)` → `mw_mention` chỉ cho thành viên, 1 lần |
| `mw_attachments` | thành viên | edit | — | manage / người tải lên | `url` https; `sha256` 64 hex |
| `mw_activity` | thành viên | **không** | — | — | chỉ trigger / RPC ghi (append-only) |
| `mw_reviewers` | nhân sự đang làm | Admin | — | Admin | |
| `mw_campaigns` | thành viên | manage | manage | — | |
| `mw_contents` | thành viên / người duyệt được gửi tới | edit | edit | — | `in_review / revision_required / rejected / approved / published` **chỉ** do RPC đặt; không đổi điều kiện duyệt khi đang duyệt |
| `mw_content_versions` | như nội dung | edit | **không** | **không** | `revision` tự tăng; asset bắt buộc `file_url`+`sha256`; bản mới → huỷ hiệu lực lượt duyệt, chặn bài đăng chờ |
| `mw_approval_runs` / `mw_approval_steps` | như nội dung | **không** | **không** | — | chỉ RPC |
| `mw_consents` | như nội dung | edit | manage / compliance (chỉ `revoked_at`) | — | xác minh chỉ qua RPC; thu hồi → chặn bài đăng |
| `mw_publications` | thành viên | edit (trạng thái `draft`) | edit khi `draft/blocked` (không đổi trạng thái / bằng chứng) | — | trạng thái chỉ qua RPC |
| `clinic_settings.mw_enabled` | đọc như cũ | — | RPC `mw_set_enabled` | — | |

`edit` = owner / manager / editor / Admin; `manage` = owner / manager / Admin; `thành viên` = có vai trò bất kỳ trong workspace hoặc Admin.

## 2. RPC (`POST /rest/v1/rpc/<fn>`)

| Hàm | Tham số | Trả về | Quyền / kiểm tra |
|---|---|---|---|
| `mw_create_workspace` | `p_name, p_description?, p_color?` | `uuid` | Admin hoặc vai trò Marketing, tài khoản đang làm; người tạo = owner |
| `mw_create_board` | `p_ws, p_name, p_template` (`video/design/campaign/seo/ads/event/blank`) | `uuid` | manage |
| `mw_move_task` | `p_task, p_list, p_after_task?, p_expected_version` | `{task_id, version, list_id, board_id, sort_index}` | edit ở cả 2 board, cùng workspace, đúng `version` (40001), WIP (23514); vị trí = giữa thẻ trước / sau |
| `mw_copy_task` | `p_task, p_list?` | `uuid` | edit; sao chép checklist + nhãn, **không** mang người phụ trách / duyệt |
| `mw_submit_approval` | `p_content` | `uuid` (run) | edit; cần script hoặc asset + caption; huỷ lượt đang chờ cũ; tạo bước theo `medical_review_required`; thông báo người duyệt bước 1 |
| `mw_review_step` | `p_step, p_decision ('approve'/'revision'/'reject'), p_note?` | `text` (`approve`… hoặc `invalidated`) | đúng loại người duyệt, đúng bước đang chờ; snapshot phải là bản mới nhất (nếu không → `invalidated`); pháp lý cần consent hợp lệ khi `consent_required`; trả lại / từ chối bắt buộc lý do |
| `mw_verify_consent` | `p_consent` | `void` | người duyệt compliance **và** xem được nội dung |
| `mw_publication_gate` | `p_pub` | `text` lý do chặn hoặc `null` | không xem được → “Không tìm thấy bài đăng” |
| `mw_schedule_publication` | `p_pub, p_at` | `text` lý do chặn hoặc `null` | manage hoặc publisher; `draft/blocked` → `scheduled` (thủ công) hoặc `blocked` + lý do |
| `mw_submit_publish_proof` | `p_pub, p_url` | `text`/`null` | manage hoặc publisher; `scheduled` → `pending_verification`; gate kiểm tra lại |
| `mw_verify_publication` | `p_pub, p_ok, p_note?` | `void` | manage hoặc publisher, **khác** người nộp link; đúng → `published` (+ nội dung `published`); sai → về `scheduled` kèm lý do |
| `mw_cancel_publication` | `p_pub` | `void` | edit; không huỷ bài đã đăng |
| `mw_set_enabled` | `p_on` | `void` | Admin |

Hàm nội bộ (`mw_log`, `mw_notify`, các hàm kiểm tra quyền) **không** cấp cho trình duyệt.

## 3. Sự kiện / thông báo

| Sự kiện (nhật ký `mw_activity.entity.action`) | Thông báo (`notifications.type`) | Link |
|---|---|---|
| `task.created/updated/moved/archived/restored` | — | |
| `assignee.added/removed` | `mw_assigned` (khi thêm) | `mkt_workspace#task:<id>` |
| `checklist.added/checked/unchecked/updated` | `mw_check_assigned` (khi giao) | `mkt_workspace#task:<id>` |
| `comment.created/edited/deleted` | `mw_mention` (người được @nhắc) | `mkt_workspace#task:<id>` |
| `label.added/removed`, `attachment.added/removed` | — | |
| `member.insert/update/delete`, `workspace.created`, `board.created` | — | |
| `content_version.created` (kèm `invalidated_runs`) | — | |
| `approval.submitted`, `approval_step.approve/revision/reject` | `mw_approval` (người duyệt bước kế), `mw_approved`, `mw_returned` (người gửi) | `mkt_workspace#approval:<run id>` |
| `consent.created/verified/revoked` | — | |
| `publication.scheduled/blocked/proof_submitted/verified/verification_failed/cancelled` | — | |

Realtime (Supabase publication): `mw_tasks, mw_lists, mw_comments, mw_checklist_items, mw_task_assignees, mw_approval_steps, mw_publications, mw_contents` — giao diện tải lại qua `useRealtimeReload`.
