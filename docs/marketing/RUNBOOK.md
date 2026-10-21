# RUNBOOK — Marketing Workspace v1

## 1. Cài đặt lần đầu (Admin)

1. **Sao lưu** (Supabase › Database › Backups) — khuyến nghị trước mọi migration.
2. Supabase › SQL Editor › dán toàn bộ `supabase/marketing_workspace_v1.sql` › Run.
   - Chạy lại nhiều lần vẫn an toàn (idempotent).
   - Không tạo / sửa bảng cũ ngoài: thêm cột `clinic_settings.mw_enabled boolean default false`.
   - Không cần Edge Function mới; **không** đổi Verify JWT của function nào.
3. Menu **Marketing › Marketing Workspace** hiện ngay (không cần bật). Ai thấy menu do trang **Phân quyền** quyết định.
4. *Workspace mới* → nhập tên + chọn mẫu cột **hoặc tự đặt cột** → tạo luôn bảng công việc đầu tiên. Sau đó mục **Thành viên & cấu hình**:
   - Thêm thành viên từ danh sách nhân sự (Quản lý / Thực hiện / Chỉ xem).
   - Cấp **Người duyệt**: bác sĩ (Chuyên môn y khoa), Marketing / thương hiệu, Pháp lý & consent, Người đăng bài.
   - Tạo nhãn; thêm board khác theo mẫu hoặc tự đặt cột.
5. Nếu người làm **Pháp lý & consent** có vai trò không thấy menu mặc định (VD CSKH): **Cài đặt hệ thống › Phân quyền** → cột vai trò đó → bật ô *Marketing Workspace*.

## 2. Quy trình hằng ngày

| Việc | Ở đâu |
|---|---|
| Giao việc, kéo thả, checklist, bình luận @nhắc | Bảng công việc (Kanban / Bảng dữ liệu / Lịch / Timeline) — trên điện thoại dùng nút ✥ *Di chuyển* (hoặc phím **M** khi chọn thẻ) |
| Việc được giao cho tôi | Việc của tôi |
| Brief → kịch bản → tệp → caption | Content Studio › Phiên bản (mỗi lần lưu là 1 phiên bản mới, không sửa đè) |
| Gửi duyệt | Content Studio › Duyệt › *Gửi duyệt phiên bản hiện tại* |
| Duyệt | Duyệt › *Chờ tôi* (bác sĩ → marketing → pháp lý) |
| Consent | Content Studio › Consent: nhập **MÃ hồ sơ** + phạm vi + hạn (không ghi tên / SĐT / bệnh án). Pháp lý xác minh trong Trung tâm duyệt |
| Đăng bài | Content Studio › Xuất bản › *Thêm bài đăng* → *Lên lịch* → đăng tay trên Facebook / TikTok… → *Đã đăng — nộp link* → người khác *Xác minh đúng* |

## 3. Tắt / gỡ (rollback)

| Mức | Cách | Dữ liệu |
|---|---|---|
| Ẩn menu | Phân quyền › bỏ ô *Marketing Workspace* cho các vai trò | Giữ nguyên dữ liệu |
| Gỡ hẳn | Chạy `supabase/marketing_workspace_v1_rollback.sql` | **Xoá** mọi bảng / hàm `mw_*`, cột `mw_enabled`, quyền menu `mkt_workspace`, thông báo `mw_%` — sao lưu trước |
| Frontend | Revert commit thêm `features/marketingWorkspace` (menu tự ẩn khi cờ / cột không còn) | |

## 4. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / xử lý |
|---|---|
| “Chưa cài Marketing Workspace…” | Chưa chạy `marketing_workspace_v1.sql` |
| Menu không hiện | Vai trò chưa được cấp ô *Marketing Workspace* trong Phân quyền |
| Thấy module nhưng trống | Chưa là thành viên workspace nào → nhờ Quản lý thêm |
| “Thẻ vừa được người khác thay đổi…” | Khoá lạc quan: người khác sửa trước — app đã tải bản mới, thao tác lại |
| “Cột đã đạt giới hạn N thẻ (WIP)” | Tăng WIP ở menu cột hoặc chuyển bớt thẻ |
| Bài đăng *Bị chặn* | Đọc lý do trên thẻ: chưa duyệt đủ / có phiên bản mới / caption–tệp khác bản đã duyệt / consent thiếu – hết hạn – thu hồi |
| Tải tệp lỗi | Kiểm tra secret R2 của Edge Function `r2-presign` (R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) |

## 5. Kiểm thử cho dev

```bash
# SQL trên PostgreSQL 16 cục bộ (KHÔNG chạy vào Supabase production)
PGHOST=localhost PGPORT=54329 PGUSER=postgres bash supabase/tests/run_marketing_tests.sh
# Lint + build
cd apps/web && npx eslint . --quiet && npm run build
```

E2E (app thật + PostgREST + PostgreSQL): build preview `VITE_DESIGN_PREVIEW=1 VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo npx vite build`,
chạy PostgREST 12 trỏ vào DB đã cài `supabase/tests/supabase_stub.sql` + migration, rồi Playwright mở `/__preview?screen=staff&uid=<profile id>&role=<vai trò>&tab=mkt_workspace`,
chuyển mọi request `https://demo.supabase.co/rest/v1/*` sang PostgREST kèm JWT `sub=<profile id>, role=authenticated` (ký bằng `jwt-secret` của PostgREST). Kịch bản và kết quả: IMPLEMENTATION_REPORT §4.

## 6. Ghi chú OAuth / mạng xã hội (chưa kết nối)

- Hiện **không** có kết nối API đăng bài nào; giao diện ghi rõ “Chưa kết nối API mạng xã hội — đăng thủ công có bằng chứng”. Không có nút “đăng tự động”.
- Muốn tự động đăng sau này cần: ứng dụng Meta (Pages / Instagram Graph API, quyền `pages_manage_posts`, `instagram_content_publish` — phải qua App Review), TikTok Content Posting API (audit), YouTube Data API (OAuth consent screen), Zalo OA API. Token lưu ở **Supabase Edge Secrets / bảng mã hoá phía server**, không bao giờ ở trình duyệt; worker dispatch phải gọi lại `mw_publication_gate` ngay trước khi đăng và chỉ đánh dấu *published* khi nền tảng trả `post_id` (lưu làm bằng chứng).
- Analytics (lượt xem, CPL…) chưa kết nối: các màn ghi “chưa kết nối nguồn số liệu”, không hiện số giả.
