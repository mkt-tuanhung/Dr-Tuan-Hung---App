# IMPLEMENTATION REPORT — Marketing Workspace v1 (Tuấn Hùng App)

Ngày 21/10/2026 · nhánh `claude/code-review-4d4o67` · cập nhật tại chỗ trong repo `Dr-Tuan-Hung---App`.
Tài liệu liên quan: BASELINE_AUDIT · IMPLEMENTATION_PLAN · FEATURE_PARITY_MATRIX · API_CONTRACT · ROLE_PERMISSION_MATRIX · RUNBOOK.

> **Không tuyên bố** đã kết nối mạng xã hội, đã tự đăng bài, hay tương đương 100% Trello / Lark. Mọi mục dưới đây có bằng chứng: file, API, test, ảnh chụp **app thật** chạy với PostgreSQL thật (qua PostgREST + RLS) — không phải prototype.

## 1. Đã thay đổi gì

| Loại | File |
|---|---|
| SQL mới | `supabase/marketing_workspace_v1.sql` (21 bảng `mw_*`, RLS mọi bảng, 50 hàm / trigger / RPC), `supabase/marketing_workspace_v1_rollback.sql` |
| Test mới | `supabase/tests/supabase_stub.sql`, `marketing_workspace_v1.test.sql` (81 kiểm tra), `run_marketing_tests.sh`, `e2e/*` (Playwright 52 kiểm tra), `README.md` |
| Frontend mới | `apps/web/src/features/marketingWorkspace/`: `MarketingWorkspacePage.jsx`, `BoardSection.jsx`, `TaskDrawer.jsx`, `HomeSections.jsx`, `ContentStudio.jsx`, `ApprovalCenter.jsx`, `PublishingQueue.jsx`, `SettingsSection.jsx`, `mwApi.js`, `mwMeta.js`, `mwUi.jsx`, `useMwEnabled.js`; `features/settings/MarketingWorkspaceToggle.jsx` |
| Sửa nhỏ (giữ hành vi cũ) | `menuConfig.js` (+1 mục con Marketing có `flag`), `StaffDashboard.jsx` / `AdminDashboard.jsx` (+lazy route, ẩn mục khi cờ tắt), `SettingsPage.jsx` (+mục bật/tắt), `lib/notif.js` (+icon `mw_*`), `MentionInput.jsx` (+prop `allowCustomer`, mặc định `true`), `dev/DesignPreview.jsx` (chỉ bản dev: `uid`/`name` cho E2E) |
| Không đụng | AppShell, styles, router, auth, CRM, HRM, FaceID, CSKH, lịch mổ, tài chính, Edge Functions, mobile shell |

**Đường dẫn trong app:** menu **Marketing › Marketing Workspace** (tab `mkt_workspace`). Link trực tiếp: `/?tab=mkt_workspace`; thẻ: `/?tab=mkt_workspace&focus=task:<id>`; lượt duyệt: `&focus=approval:<run id>`. Bật module: **Cài đặt hệ thống › Marketing Workspace**.

## 2. Trạng thái 20 màn (S01–S20)

| Màn | Trạng thái | Vị trí / file | Bằng chứng (test · ảnh) | Còn thiếu |
|---|---|---|---|---|
| S01 Tổng quan | **implemented** | Tổng quan · `HomeSections.jsx#Overview` | E2E · `19_overview_dashboard.png` | Chọn khoảng ngày, menu tạo nhanh |
| S02 Danh sách workspace | **partial** | thanh chọn workspace + *Workspace mới* + lưu trữ / khôi phục (`MarketingWorkspacePage`, `SettingsSection`) | E2E T04 · `01` | Ghim / yêu thích / tìm workspace, wizard nhiều bước |
| S03 Kanban | **implemented** | `BoardSection.jsx#KanbanView` | SQL-T T05/T06 · E2E T05 · `02`, `05`, `10_*` | Kéo cột, chọn hàng loạt, Gantt/Gallery/Map (khoá + lý do) |
| S04 Ngăn kéo thẻ | **implemented** | `TaskDrawer.jsx` | E2E S04/T07/T11 · `03`, `11_*` | Custom fields, phụ thuộc thẻ |
| S05 Bảng dữ liệu | **partial** | `BoardSection.jsx#TableView` (sửa ô, sắp xếp, CSV) | E2E S05 · `06` | Thêm trường, nhóm, ghim cột, công thức, nhập CSV |
| S06 Lịch marketing | **partial** | `CalendarView` (tháng, kéo đổi hạn, agenda mobile) + Lịch đăng (`PublishingQueue`) | E2E T09 · `07` | Chế độ tuần, xung đột lịch |
| S07 Timeline / Gantt | **partial** | `TimelineView` (5 tuần, chỉ xem) | ảnh `08` | Kéo / co giãn, phụ thuộc, Gantt |
| S08 Chiến dịch | **implemented** | `ContentStudio.jsx#CampaignsSection` | E2E S08 · `12` | Funnel / KPI thực tế (chưa có nguồn) |
| S09 Content Studio | **implemented** | `ContentStudio.jsx` (Thông tin / Phiên bản / Duyệt / Consent / Xuất bản) | E2E S09 · `13`, `14` | Shot list có cấu trúc, AI soạn nháp, diff phiên bản |
| S10 Trung tâm duyệt | **implemented** | `ApprovalCenter.jsx` | SQL-T T13–T16 · E2E T13/T15/T16 · `15`, `20` | Lọc theo ngày / ưu tiên, chú thích trên ảnh / video |
| S11 Thư viện media | **partial** | tệp phiên bản + đính kèm (sha256, % tải thật); Kho Media cũ giữ nguyên | E2E S09/S11 · `13` | Thư mục, metadata, proxy, timecode, presigned GET |
| S12 Hàng đợi xuất bản | **implemented (thủ công)** | `PublishingQueue.jsx` | SQL-T T20 · E2E S12/T15/T20 · `16`, `17`, `18` | Dispatch API thật (chưa có OAuth) |
| S13 Chat | **not implemented** | tab khoá + lý do | — | |
| S14 Docs & Wiki | **not implemented** | tab khoá + lý do | — | |
| S15 Base / Form / Dashboard | **not implemented** | tab khoá + lý do | — | |
| S16 Automation | **not implemented** | tab khoá + lý do | — | |
| S17 Báo cáo marketing | **partial** | số liệu nội bộ ở Tổng quan (ghi nguồn + thời điểm tải); analytics MXH ghi “chưa kết nối” | E2E · `19` | Báo cáo theo người / kênh / thời gian, xuất PDF |
| S18 Trợ lý AI | **not implemented** | tab khoá + lý do | — | |
| S19 Thành viên & quyền | **implemented** | `SettingsSection.jsx` (thành viên, vai trò, người duyệt) | SQL-T · E2E S19 · `01` | Cộng tác viên ngoài có hạn, nghỉ phép từ HR |
| S20 Cấu hình & nhật ký | **partial** | nhãn, board, workspace, bật/tắt module, nhật ký quản trị 30 ngày | E2E FLAG · `00_*`, `01` | Trình dựng quy trình duyệt, brand guardrail, OAuth scopes, retention |

## 3. P0 / P1 / P2

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| P0 App cũ chạy như trước, cờ tắt = menu cũ | **đạt** | E2E `FLAG tắt…` (`00_flag_off_menu.png`); `eslint . --quiet` exit 0; build OK; diff file cũ chỉ thêm |
| P0 Không trùng danh tính; vai trò app ↔ thành viên MW | **đạt** | dùng `profiles` + Supabase Auth; thành viên chọn từ nhân sự có sẵn |
| P0 Migration + rollback | **đạt** (DB thật cục bộ) | SQL-T T25 (rollback sạch, cài lại được); chạy 2 lần idempotent. *Chưa thử trên bản sao staging Supabase* |
| P0 Mọi route cần phiên đăng nhập; cách ly | **đạt** | SQL-T T01 (anon bị từ chối), T02; E2E T02 |
| P0 Tạo workspace / board / cột / thẻ; thông báo thật; Việc của tôi web / mobile | **đạt** | E2E T04, `04`, `10_*` |
| P0 Kéo thả / bàn phím / cảm ứng; tải lại giữ thứ tự; di chuyển đồng thời | **đạt** | E2E T05; SQL-T xung đột phiên bản 40001 |
| P0 Drawer lưu mọi trường + nhật ký | **đạt** | E2E S04 |
| P0 Đổi hạn ở Lịch phản ánh Board / Bảng / Timeline | **đạt** | E2E T09 |
| P0 Lọc / lưu trữ / khôi phục / tìm theo quyền | **một phần** | lọc + lưu trữ / khôi phục trong board; *chưa có tìm toàn workspace* |
| P0 403 không lộ metadata | **đạt** | SQL-T (gate / lịch đăng trả “Không tìm thấy”), E2E T02 |
| P0 Duyệt gắn phiên bản bất biến; bác sĩ chỉ duyệt đúng phạm vi | **đạt** | SQL-T T13; E2E T13 |
| P0 Đổi tệp / caption / kịch bản → huỷ duyệt + chặn đăng | **đạt** | SQL-T T15; E2E T15 |
| P0 Thiếu / hết hạn / thu hồi consent → chặn | **đạt** | SQL-T T16; E2E T16 |
| P0 Đến giờ mà thiếu duyệt → không đăng | **đạt (theo thiết kế)** | không có job tự đăng; lịch chỉ là nhắc thủ công; gate kiểm tra lại khi nộp link |
| P0 Trình duyệt không giả mạo APPROVED / PUBLISHED | **đạt** | SQL-T “chống giả mạo” (PATCH bị trigger chặn) |
| P0 PUBLISHED cần bằng chứng + xác minh | **đạt** | SQL-T T20; E2E T20 |
| P0 Thiếu API → tác vụ thủ công, không giả kết nối | **đạt** | banner Xuất bản (`16`) |
| P0 @nhắc 1 lần, theo quyền; gỡ thành viên mất quyền ngay | **đạt** | SQL-T T11; RLS theo membership |
| P0 Chat-to-task, doc-to-task | **chưa** | S13 / S14 chưa làm |
| P0 Upload: giới hạn loại / dung lượng, presigned, quét virus, preview | **một phần** | giới hạn loại + 500 MB, sha256, presigned PUT, preview ảnh / video; *không có quét virus, GET công khai (khoá ngẫu nhiên)* |
| P0 Mất mạng → đối soát | **một phần** | khoá lạc quan + hoàn tác khi lỗi; realtime tải lại; *không có hàng đợi offline* |
| P0 Nhật ký mọi duyệt / quyền / xuất bản | **đạt** | `mw_activity` append-only; E2E “Audit…” |
| P0 Mobile 360 / 390 | **đạt** | E2E (không tràn ngang), `10_*`, `11_*`, `20` |
| P1 Base / Automation / Docs / dashboard nguồn thật / xuất dữ liệu / lỗi tích hợp | **một phần** | xuất CSV thẻ; Tổng quan số liệu thật; phần còn lại chưa làm |
| P2 Kế hoạch 30 ngày AI, timecode, báo cáo tuỳ biến | **chưa** | |

## 4. Lệnh đã chạy & kết quả

```text
$ PGHOST=localhost PGPORT=54329 PGUSER=postgres bash supabase/tests/run_marketing_tests.sh
  81 dòng PASS · "==== ALL MARKETING WORKSPACE SQL TESTS PASSED ====" · T25 rollback + cài lại PASS
  (log đầy đủ: docs/marketing/sql_test_run.txt)

$ E2E: PostgreSQL 16 + PostgREST 12.2.3 + bản preview app + Playwright/Chromium (supabase/tests/e2e/part1-3.mjs)
  52 PASS · 0 FAIL  (log: docs/marketing/e2e_run.txt; ảnh: docs/marketing/screenshots/*.png)

$ cd apps/web && npx eslint . --quiet      → exit 0
$ npx vite build                           → ✓ built (chunk riêng MarketingWorkspacePage ~151 kB, chỉ tải khi mở)
```

Test ID đã phủ: T01, T02, T04, T05, T06, T07, T09, T11, T13, T14 (bước có điều kiện y khoa), T15, T16, T20, T24 (mobile / bàn phím một phần), T25.
Chưa phủ: T03 (khách ngoài), T08, T10 (upload resumable), T12, T17, T18, T19, T21, T22, T23 — các tính năng tương ứng chưa làm hoặc không có tích hợp ngoài.

Ảnh (app thật, dữ liệu thật trong DB cục bộ): `00_flag_off_menu`, `00_settings_flag`, `01_settings_members`, `02_kanban_desktop`, `03_task_drawer`, `04_my_tasks`, `05_kanban_after_move`, `06_table_view`, `07_calendar_view`, `08_timeline_view`, `09_outsider_empty`, `10_kanban_mobile_360/390`, `11_task_mobile_360/390`, `12_campaigns`, `13_content_versions`, `14_content_approval_tab`, `15_approval_center_doctor`, `16_publishing_blocked`, `17_publishing_pending_verification`, `18_publishing_published`, `19_overview_dashboard`, `20_approval_mobile_390`.

## 5. Hướng dẫn Admin bật & cấp quyền

1. Supabase SQL Editor → chạy `supabase/marketing_workspace_v1.sql` (sao lưu trước).
2. App → Cài đặt hệ thống → **Marketing Workspace** → *Bật module*.
3. Marketing › Marketing Workspace → *Workspace mới* → Thành viên & cấu hình: thêm thành viên, cấp Người duyệt (bác sĩ / marketing / pháp lý-consent / người đăng), tạo nhãn, tạo board.
4. Vai trò cần thấy menu mà không có mặc định (VD CSKH làm pháp lý): Cài đặt hệ thống › Phân quyền → bật ô *Marketing Workspace*.
Chi tiết: RUNBOOK §1–2.

## 6. OAuth / mạng xã hội
Chưa kết nối bất kỳ nền tảng nào; không có nút đăng tự động; bài chỉ thành *Đã đăng* khi có link bằng chứng được **người khác** xác minh. Yêu cầu để làm tự động: RUNBOOK §6.

## 7. Rollback
Tắt: Cài đặt hệ thống › Marketing Workspace › *Tắt module* (dữ liệu giữ). Gỡ hẳn: `supabase/marketing_workspace_v1_rollback.sql` + revert commit frontend. RUNBOOK §3.

## 8. Rủi ro / hạn chế đã biết
- Tệp R2 là URL công khai (khoá ngẫu nhiên): **không** tải ảnh / video bệnh nhân khi chưa có consent; cần presigned GET ở giai đoạn sau.
- Realtime gom tối đa 1 lần / 20 s (theo hook sẵn có) — thay đổi của người khác có thể trễ tới 20 s; thao tác của chính mình cập nhật ngay.
- Vai trò `bac_si` thấy menu mặc định nhưng chỉ thấy lượt duyệt được gửi tới (không thấy board nếu không là thành viên).
- Điều hướng nội bộ `NAVIGATE` của app (có sẵn) không kiểm tra quyền menu — dữ liệu vẫn được RLS bảo vệ.
- Chưa chạy trên Supabase staging; SQL đã chạy trên PostgreSQL 16 với lớp giả lập Supabase tối thiểu (`supabase_stub.sql`).

## 9. Mốc tiếp theo đề xuất
1. Presigned GET + thư viện media (S11), timecode review.
2. Chat / bình luận thread + chuyển tin thành việc (S13), Docs có phiên bản (S14).
3. Automation có hàng đợi + chống vòng lặp (nhắc hạn, quá hạn báo quản lý) (S16).
4. OAuth Meta / TikTok + worker dispatch gọi lại gate (S12 tự động).
