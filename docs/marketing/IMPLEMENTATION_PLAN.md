# IMPLEMENTATION PLAN — Marketing Workspace v1 (update-in-place)

Dựa trên `BASELINE_AUDIT.md`. Nguyên tắc: **không** tạo repo / app / router / shell / auth mới; **không** sửa phá CRM, HRM, FaceID, CSKH, lịch mổ, tài chính, thông báo, mobile shell; cờ tắt = app y như cũ.

## Quyết định kiến trúc

| # | Quyết định | Lý do |
|---|---|---|
| A1 | Module = 1 tab `mkt_workspace` trong dashboard hiện có (lazy load) | App không có URL router; theo đúng cơ chế `activeTab` + `NAVIGATE` |
| A2 | Đặt trong nhóm menu **Marketing** (`FULL_MENU` + `MENU_GROUPS` Admin) với `flag: 'mw_enabled'` | Dùng ma trận Phân quyền sẵn có (`role_permissions`) cho quyền thấy menu |
| A3 | Cờ `clinic_settings.mw_enabled` (mặc định `false`), bật / tắt qua RPC `mw_set_enabled` (Admin) — ở Cài đặt hệ thống và trong module | Tắt = menu ẩn hoàn toàn, dữ liệu giữ nguyên |
| A4 | Bảng riêng tiền tố `mw_*`, khoá ngoại tới `profiles(id)` | Không đụng bảng `tasks` của module Công việc; danh tính = nhân sự có sẵn |
| A5 | 1 phòng khám = 1 tenant; cách ly theo **workspace membership** (owner / manager / editor / viewer) + Admin app | Gói tham chiếu giả định đa tổ chức — không khớp app thật |
| A6 | Quyền thực thi ở DB: RLS mọi bảng; trạng thái nhạy cảm (duyệt / xuất bản / consent đã xác minh / đổi board) chỉ đổi qua RPC SECURITY DEFINER đặt cờ `mw.rpc`; trigger chặn PATCH trực tiếp | “Client không giả mạo được APPROVED / PUBLISHED” |
| A7 | Phiên bản nội dung bất biến (script / asset+sha256 / caption); lượt duyệt khoá đúng id phiên bản + `snapshot_hash`; phiên bản mới → huỷ hiệu lực duyệt + chặn lịch đăng | Approval ràng buộc phiên bản / tệp / caption |
| A8 | Người duyệt (`mw_reviewers`: medical / marketing / compliance / publisher) do **Admin cấp**; Admin không tự là người duyệt | Không tự nâng quyền |
| A9 | Xuất bản **thủ công có bằng chứng**: lên lịch (gate server) → nộp link → **người khác** xác minh → Đã đăng | Chưa có OAuth / API mạng xã hội hợp lệ |
| A10 | Thông báo dùng bảng `notifications` có sẵn (type `mw_*`, link `mkt_workspace#task:<id>` / `#approval:<id>`); nhật ký `mw_activity` chỉ ghi thêm | Tái dùng dịch vụ sẵn có |
| A11 | Tệp: `uploadViaPresignWithProgress` (R2) không nén, sha256 tính trong trình duyệt | % tiến độ thật, hash khớp tệp được duyệt |
| A12 | Bình luận dùng `MentionInput` với `allowCustomer={false}` | Không kéo dữ liệu bệnh nhân vào Marketing |

## Giai đoạn

### Phase 0 — Audit (xong)
`BASELINE_AUDIT.md`, kế hoạch này.

### Phase 1 — Lát cắt công việc chạy thật
1. SQL `supabase/marketing_workspace_v1.sql`: workspace, thành viên, board (mẫu cột), cột (WIP, cột hoàn thành), nhãn, thẻ (khoá lạc quan `version`), người phụ trách, người theo dõi, checklist (người / hạn), bình luận (@nhắc → thông báo), đính kèm (https + sha256), nhật ký; RPC `mw_create_workspace`, `mw_create_board`, `mw_move_task` (WIP, xung đột 40001, cùng workspace), `mw_copy_task`.
2. UI: Tổng quan (số liệu thật), Việc của tôi, Bảng công việc (Kanban kéo thả + phím M / hộp di chuyển, Bảng dữ liệu sửa ô + CSV, Lịch kéo đổi hạn, Timeline), Drawer thẻ đầy đủ, Thành viên & cấu hình.
3. Tích hợp menu + cờ + thông báo + deep link.

### Phase 2 — Chiến dịch → nội dung → duyệt → xuất bản
1. SQL: chiến dịch, nội dung, phiên bản, lượt duyệt + bước (y khoa? → marketing → pháp lý/consent), consent (mã hồ sơ, phạm vi, hạn; xác minh / thu hồi), bài đăng + gate.
2. UI: Chiến dịch, Content Studio (Thông tin / Phiên bản / Duyệt / Consent / Xuất bản), Trung tâm duyệt (Chờ tôi / Đã gửi / Đã xử lý / Trả lại), Hàng đợi xuất bản (trạng thái + lịch đăng).

### Kiểm thử
- SQL test thật (PostgreSQL 16): `supabase/tests/run_marketing_tests.sh` (T01, T02, T04–T07, T09, T11, T13, T15, T16, T20, T25 + chống giả mạo).
- E2E app thật + PostgREST + PostgreSQL (Playwright) — đa người dùng, desktop + 360/390 px, ảnh chụp lưu `docs/marketing/screenshots/`.
- `eslint . --quiet`, `vite build`.

### Ngoài phạm vi phiên này (báo cáo trung thực trong IMPLEMENTATION_REPORT)
Chat / threads, Docs & Wiki, Base (trường tuỳ biến, công thức), Automation, Gantt có phụ thuộc, Gallery / Map, kết nối OAuth mạng xã hội + analytics, AI assistant, timecode review media, transcode / proxy, presigned GET cho tệp.

## Rollback
- Tắt nhanh: Cài đặt hệ thống › Marketing Workspace › Tắt (hoặc `update clinic_settings set mw_enabled = false;`).
- Gỡ hẳn: chạy `supabase/marketing_workspace_v1_rollback.sql` (xoá bảng / hàm `mw_*`, cột cờ, quyền menu, thông báo `mw_%`) + revert commit frontend.
