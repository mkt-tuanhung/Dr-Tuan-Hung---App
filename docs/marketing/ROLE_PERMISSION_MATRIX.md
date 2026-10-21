# ROLE / PERMISSION MATRIX — Marketing Workspace v1

Có **3 lớp** quyền độc lập, tất cả kiểm tra ở database (ẩn nút ở giao diện chỉ để dễ dùng):

1. **Thấy menu** — chức năng `mkt_workspace` trong ma trận **Phân quyền** (bảng `role_permissions`) + cờ `mw_enabled`.
   Mặc định: Marketing, Media, Editor, Designer, Bác sĩ, Admin. Admin có thể cấp thêm (VD CSKH làm pháp lý / consent).
2. **Xem / sửa dữ liệu** — vai trò trong **từng workspace** (`mw_members`) hoặc Admin app.
3. **Duyệt / đăng** — loại người duyệt do **Admin** cấp (`mw_reviewers`), áp dụng mọi workspace.

## Vai trò workspace

| Hành động | Chủ (owner) | Quản lý (manager) | Thực hiện (editor) | Chỉ xem (viewer) | Admin app | Không là thành viên |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Xem workspace / board / thẻ / nội dung | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (RLS, không lộ tồn tại) |
| Tạo workspace | Admin / vai trò Marketing | | | | ✓ | Marketing ✓ |
| Sửa / lưu trữ workspace | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Thêm / gỡ thành viên, đổi vai trò | ✓ | ✓ (không cấp *Quản lý*) | ✗ | ✗ | ✓ | ✗ |
| Tạo / sửa / lưu trữ board, cột, WIP | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Tạo / sửa / di chuyển / lưu trữ thẻ, checklist, nhãn gắn thẻ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Bình luận | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Sửa / xoá bình luận | tác giả | tác giả | tác giả | ✗ | tác giả | ✗ |
| Xoá nhãn khỏi workspace | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Gỡ tệp đính kèm | ✓ | ✓ | người tải lên | ✗ | ✓ | ✗ |
| Tạo / sửa chiến dịch | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Tạo nội dung, thêm phiên bản, gửi duyệt, thêm consent | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Thu hồi consent | ✓ | ✓ | ✗ | ✗ | ✓ | compliance (nội dung được gửi tới) |
| Tạo bài đăng nháp, huỷ bài | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Lên lịch / nộp link / xác minh đăng | ✓ | ✓ | publisher | publisher | ✓ | ✗ |
| Bật / tắt module, cấp người duyệt | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |

## Người duyệt (do Admin cấp)

| Loại | Làm được | Thấy được |
|---|---|---|
| `medical` — Chuyên môn y khoa (bác sĩ) | Duyệt / yêu cầu sửa / từ chối **bước y khoa** đang chờ | Nội dung có lượt duyệt gồm bước y khoa (kể cả không là thành viên): snapshot kịch bản, tệp + sha256, caption, brief, consent |
| `marketing` — Marketing / thương hiệu | Bước marketing | như trên với bước marketing |
| `compliance` — Pháp lý & consent | Bước pháp lý; **xác minh / thu hồi consent** của nội dung được gửi tới | như trên |
| `publisher` — Người đăng bài | Lên lịch, nộp link, xác minh link của **người khác** (workspace mình là thành viên) | — |

Quy tắc bắt buộc (DB enforce):
- Admin / owner **không** tự động là người duyệt y khoa.
- Duyệt tuần tự: bước sau chỉ mở khi bước trước *approve*.
- Không duyệt được snapshot đã cũ (có phiên bản mới) → lượt duyệt *invalidated*.
- Pháp lý không duyệt được khi `consent_required` mà chưa có consent đã xác minh, còn hạn, chưa thu hồi.
- Người nộp link không tự xác minh bài đã đăng.
- Không ai PATCH thẳng được trạng thái `approved` / `published` / `verified_at` (trigger chặn ngoài RPC).

## Bằng chứng kiểm thử
`supabase/tests/marketing_workspace_v1.test.sql` (81 kiểm tra) + E2E `docs/marketing/IMPLEMENTATION_REPORT.md` §4.
