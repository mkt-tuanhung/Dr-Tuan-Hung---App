# BASELINE AUDIT — Tuấn Hùng App trước khi thêm Marketing Workspace v1.1

> Audit trên repo thật `mkt-tuanhung/Dr-Tuan-Hung---App`, nhánh `main` tại commit `815ca69` (sau PR #398), ngày 21/10/2026.
> Mục tiêu: xác định stack, cách điều hướng, phân quyền, dịch vụ dùng chung để ghép Marketing Workspace (MW) **cập nhật tại chỗ**, không tạo app mới.

## 1. Stack & cấu trúc

| Hạng mục | Thực tế trong repo |
|---|---|
| Monorepo | `package.json` gốc (workspaces `apps/*`) — chỉ 1 app `apps/web` |
| Frontend | React 18.3 + Vite 7 + Tailwind 3.4 + Radix UI + lucide-react 0.469 + framer-motion 11 + recharts 2.15 + sonner 2 |
| Router | `react-router-dom` 7 chỉ cho vài route ngoài (`/`, `/__preview` khi build dev…). **Bên trong dashboard KHÔNG có URL router**: `AdminDashboard` / `StaffDashboard` giữ `activeTab` (state + localStorage) và `renderContent()` dạng `switch` |
| Điều hướng nội bộ | Sự kiện `window` `NAVIGATE` (`'tab#focus'`), `parseNav`, `setPendingFocus` / `takePendingFocus`, sự kiện `FOCUS_ITEM` (`lib/notif.js`, `lib/useFocusHighlight.js`); query `?tab=&focus=` khi mở link |
| Khung giao diện | `components/shell/AppShell.jsx` (sidebar nhóm + thanh dưới mobile + nút giữa) — dùng chung cho Admin / Staff |
| Design system | `components/ds/*` (Drawer, ConfirmDialog, EmptyState, ErrorState, PermissionDenied, FilterSelect, SearchInput, DataTable, AlertStrip, usePageTitle) + lớp CSS `e-*` trong `styles/ethics-ui.css` |
| Backend | Supabase (Postgres + RLS + RPC + Edge Functions Deno). 169 file SQL migration chạy tay trong SQL Editor (thư mục `supabase/`), 37 Edge Function (`supabase/functions/*`) |
| Đăng nhập | `contexts/AuthContext.jsx` — Supabase Auth; `profile` lấy từ bảng `profiles` (`role`, `role_2`, `is_active`, `employment_status`, `avatar_url`…) |
| Lưu tệp | Cloudflare R2 qua Edge Function `r2-upload` (nén ảnh) và `r2-presign` (PUT trực tiếp, `uploadViaPresignWithProgress` có % thật). URL công khai, khoá ngẫu nhiên |
| Realtime | `hooks/useRealtimeReload.js` (gom sự kiện, tối đa 1 lần / 20 s, hoãn khi tab ẩn) |
| Thông báo | Bảng `notifications` (`user_id, actor_id, type, title, body, link`); trigger SECURITY DEFINER chèn; chuông `NotificationBell` + trang Thông báo; `NOTIF_ICON` theo `type`; `link` = id tab (+`#id`) |
| Nhật ký | `audit_log` + `log_audit_event` (module tài chính / nhân sự) |
| Cài đặt | Bảng `clinic_settings` (1 dòng, `id boolean = true`), trang `features/settings/SettingsPage.jsx` (Admin) |
| Kiểm thử | **Không có test runner** trong app. Kiểm tra hiện có: `npm run lint` (`eslint . --quiet`) — baseline exit 0; `npm run build` |

## 2. Phân quyền hiện có

- `features/permissions/menuConfig.js`: `FULL_MENU` (id, label, icon, `roles` mặc định, `exclude`, `children`, `sameAs`); `STAFF_GROUPS`; `flatModules()`; `userCanModule(profile, m, overrides)`.
- Bảng `role_permissions (role, module, granted)` — Admin ghi đè từng ô trong trang **Phân quyền** (ma trận Vai trò × Chức năng). Ô không ghi đè giữ mặc định.
- Admin dùng `AdminDashboard` với `MENU_GROUPS` riêng (thấy mọi mục).
- Vai trò (`user_role` enum): admin, telesale, sale_offline, cskh, truc_page, media, marketing, editor, seeding, dieu_duong, accountant, shareholder, bac_si, designer (+ `role_2` phụ).
- Nhóm menu Marketing hiện có: `content_overview`, `ads_report`, `content_kho` (Kho Media), `content_video` (Video Ads), `content_images`.

## 3. Module liên quan đã có (không được phá)

| Module | Vị trí | Ghi chú cho MW |
|---|---|---|
| Công việc & Duyệt | `features/work/*`, `supabase/work_tasks.sql` (`tasks`, `task_comments`) | Việc chung toàn phòng khám, 4 trạng thái cố định — **không** đủ cho board/cột tuỳ biến, nên MW dùng bảng riêng `mw_*`, không sửa `tasks` |
| Content Production / Kho Media / Video Ads | `pages/ContentProductionPage.jsx` | Giữ nguyên; MW chỉ trỏ tới (mục “Kho media” trong MW khoá kèm lý do) |
| CRM / Lịch hẹn / Hậu phẫu / Hồ sơ 360 | `pages/*`, `features/crm/*` | Chứa dữ liệu bệnh nhân — MW **không** đọc / ghi / tra cứu các bảng này |
| `MentionInput` | `components/MentionInput.jsx` | Có tra cứu khách `#SĐT` — MW cần tắt (thêm prop `allowCustomer`, mặc định giữ hành vi cũ) |
| Chấm công FaceID, HR, Lương, Tài chính, Mobile shell | nhiều file | Không chạm |

## 4. Đối chiếu gói tài liệu V1.1

- `integration-reference/sql/001_marketing_core_REFERENCE_ONLY.sql` giả định đa tổ chức (`org_id`), bảng `users` riêng, policy INSERT workspace bị khoá có chủ ý → **không chạy thẳng**. App thật là **1 phòng khám** (1 tenant), danh tính = `profiles` + Supabase Auth → MW dùng `profiles.id`, không tạo bảng người dùng mới.
- `integration-reference/react/*` dùng router / shell / CSS riêng → **không copy**; viết lại theo `AppShell`, `ds`, `e-*` có sẵn.
- `prototype/*.html|png` dùng mảng dữ liệu minh hoạ → chỉ tham khảo bố cục.

## 5. Rủi ro & ràng buộc rút ra

1. Không có URL router → deep link phải theo cơ chế `NAVIGATE` / `FOCUS_ITEM` sẵn có (`mkt_workspace#task:<id>`).
2. Không có test runner trong app → kiểm thử bằng: SQL test trên PostgreSQL 16 thật + E2E Playwright chạy **app thật** (bản preview) qua PostgREST 12 nối PostgreSQL cục bộ có RLS (xem RUNBOOK).
3. Migration chạy tay → file SQL phải **chạy lại an toàn** (idempotent) + có file rollback.
4. Cờ tắt phải giữ app y như cũ → cờ `clinic_settings.mw_enabled` mặc định `false`; menu MW ẩn tuyệt đối khi tắt.
5. R2 trả URL công khai (khoá ngẫu nhiên, không có presigned GET) → không tải ảnh/video bệnh nhân khi chưa có consent; ghi rõ là hạn chế.
6. Edge Function cần Verify JWT = OFF (notify-telegram, schedule-telegram, fb-messenger-webhook, getfly-webhook, telegram-webhook, livekit-webhook) — MW **không** thêm / sửa Edge Function nào.

## 6. Baseline kiểm tra (trước khi sửa)

```
$ cd apps/web && npx eslint . --quiet      # exit 0
$ npm run build                             # ✓ built
```
