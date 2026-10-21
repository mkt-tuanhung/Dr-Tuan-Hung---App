# FEATURE PARITY MATRIX — mục tiêu vs. thực tế (Marketing Workspace v1)

Trạng thái: **implemented** = chạy thật với DB / quyền thật, có test; **partial** = có phần chạy thật, thiếu phần ghi ở cột hạn chế; **not implemented** = chưa có (giao diện, nếu hiện, bị KHOÁ kèm lý do).
FE = `apps/web/src/features/marketingWorkspace/`; SQL = `supabase/marketing_workspace_v1.sql`; SQL-T = `supabase/tests/marketing_workspace_v1.test.sql`; E2E = kịch bản Playwright (IMPLEMENTATION_REPORT §4); ảnh = `docs/marketing/screenshots/`.

| Nhóm | Tính năng | Ưu tiên | Trạng thái | Frontend | Backend | Bảng | Test | Bằng chứng | Hạn chế |
|---|---|---|---|---|---|---|---|---|---|
| Trello | Vòng đời workspace / board | P0 | implemented | MarketingWorkspacePage, SettingsSection, BoardSection (NewBoardModal) | RPC `mw_create_workspace`, `mw_create_board`; REST update | mw_workspaces, mw_boards | SQL-T T04; E2E T04 | 01, 02 | Sao chép cả board chưa có |
| Trello | Cột: tuỳ biến / sắp xếp / WIP | P0 | implemented | KanbanView ListMenu / NewListModal | REST mw_lists; WIP trong `mw_move_task` | mw_lists | SQL-T WIP | 02, 05 | Sắp cột bằng nút trái / phải (không kéo cột) |
| Trello | Kéo thả thẻ giữa cột | P0 | implemented | KanbanView (HTML5) + MoveSheet (cảm ứng / phím M) | RPC `mw_move_task` (version, WIP, sort giữa) | mw_tasks | SQL-T T05/T06; E2E T05 | 05 | Kéo thả cảm ứng dùng hộp Di chuyển |
| Trello | Ngăn kéo chi tiết thẻ | P0 | implemented | TaskDrawer | REST + khoá lạc quan `version` | mw_tasks… | E2E S04 | 03, 11 | Custom fields, phụ thuộc thẻ chưa có |
| Trello | Checklist có người / hạn | P0 | implemented | TaskDrawer › Checklist | trigger `mw_check_guard` (+thông báo, nhật ký) | mw_checklist_items | SQL-T T07; E2E T07 | 03 | |
| Trello | Nhãn / màu bìa / đính kèm | P0 | implemented | TaskDrawer, SettingsSection | REST; R2 presign; sha256 | mw_labels, mw_task_labels, mw_attachments | E2E | 03 | Tệp R2 là URL công khai khoá ngẫu nhiên (chưa presigned GET) |
| Trello | Bình luận, @nhắc, lịch sử | P0 | implemented | TaskDrawer › Bình luận / Lịch sử | trigger `mw_comment_guard`, `mw_activity` | mw_comments, mw_activity | SQL-T T11; E2E T11 | 03 | @nhắc chỉ nhân sự là thành viên; không tra cứu khách |
| Trello | Custom fields | P1 | not implemented | — | — | — | — | — | |
| Trello | Mẫu board, sao chép thẻ, lưu trữ / khôi phục | P1 | implemented | NewBoardModal (7 mẫu), TaskDrawer (Sao chép / Lưu trữ), ArchivedList | `mw_copy_task`, `archived_at` | | SQL-T copy | 02 | Sao chép không mang người phụ trách / duyệt (cố ý) |
| Trello | Bảng dữ liệu (Table) | P0 | implemented | TableView (sửa ô, sắp xếp, CSV) | như thẻ | | E2E S05 | 06 | Chưa ghim cột / chỉnh độ rộng |
| Trello | Lịch tuần / tháng | P0 | partial | CalendarView (tháng, kéo đổi hạn; agenda trên mobile) | updateTask(version) | | E2E T09 | 07 | Chưa có chế độ tuần |
| Trello | Timeline | P1 | partial | TimelineView (5 tuần, nhóm theo cột) | | | E2E (ảnh) | 08 | Chỉ xem; chưa kéo co giãn |
| Trello | Dashboard view | P1 | partial | Overview (số liệu thật + nguồn) | | | E2E | 19 | Không có widget tuỳ biến |
| Trello | Map view | P2 | not implemented | tab khoá (lý do) | | | | | Thẻ không có địa điểm |
| Trello | View xuyên board | P1 | partial | Việc của tôi, Tổng quan (gộp mọi board của workspace) | RLS | | E2E | 04, 19 | |
| Trello | Inbox / Planner | P0 | implemented | MyTasks (Quá hạn / Hôm nay / 7 ngày / Sau / Không hạn) + thông báo app | `notifications` | | E2E | 04 | Chưa có nhắc trước hạn tự động |
| Trello | Automation | P1 | not implemented | tab khoá | | | | | Cần hàng đợi + chống vòng lặp server |
| Trello | Tìm kiếm, lọc, bulk | P1 | partial | Lọc người / nhãn / ưu tiên / trễ hạn / từ khoá trong board | RLS | | E2E | 02 | Chưa lưu bộ lọc, chưa thao tác hàng loạt |
| Lark | Chat DM / nhóm / thread | P1 | not implemented | tab khoá | | | | | Dùng bình luận thẻ / Cộng đồng / Phòng họp có sẵn |
| Lark | Sửa / xoá tin, trạng thái đọc | P1 | partial | Sửa / xoá mềm bình luận (tác giả, có nhật ký) | | | | 03 | Không có trạng thái đã đọc |
| Lark | Chuyển tin nhắn thành việc | P1 | not implemented | | | | | | |
| Lark | Việc cá nhân / subtask | P0 | partial | Việc của tôi + checklist có người / hạn | | | | 04 | Không có subtask lồng nhau |
| Lark | Docs / Wiki | P1 | not implemented | tab khoá | | | | | Brief / kịch bản lưu ở Content Studio có phiên bản |
| Lark | Docs realtime | P2 | not implemented | | | | | | |
| Lark | Base (trường kiểu, form, công thức, quyền dòng) | P1/P2 | not implemented | tab khoá | | | | | |
| Lark | Duyệt nhiều bước / có điều kiện | P0/P1 | implemented | ApprovalCenter, ContentStudio › Duyệt | `mw_submit_approval`, `mw_review_step` | runs, steps | SQL-T T13/T14; E2E T13 | 14, 15, 20 | Điều kiện: bước y khoa theo cờ nội dung; chưa có trình dựng quy trình |
| Lark | Thông báo duyệt, uỷ quyền | P1 | partial | thông báo `mw_approval/approved/returned` | | | E2E | | Chưa có uỷ quyền / SLA |
| Lark | Lịch nhóm | P0 | partial | Lịch của board + Lịch đăng (Xuất bản) | | | | 07 | Chưa nối lịch làm việc HR |
| Lark | Họp / transcript | P2 | not implemented | (dùng Phòng họp có sẵn) | | | | | |
| Lark | Drive / tệp + bình luận | P0/P1 | partial | Đính kèm thẻ, tệp phiên bản (sha256) | R2 | | E2E S11 | 13 | Chưa có thư viện / thư mục / proxy |
| Lark | OKR / KPI | P1 | partial | KPI mục tiêu + ngân sách kế hoạch / đã chi (nhập tay) trên chiến dịch | | mw_campaigns | E2E S08 | 12 | KPI thực tế chưa nối nguồn |
| Marketing | Campaign brief / mục tiêu | P0 | implemented | CampaignsSection | REST | mw_campaigns | E2E S08 | 12 | |
| Marketing | Lịch biên tập 30 ngày (tạo nháp hàng loạt) | P0 | not implemented | | | | | | Chưa có tạo hàng loạt / AI |
| Marketing | Kịch bản / shot list có phiên bản | P0 | implemented | ContentStudio › Phiên bản | trigger version | mw_content_versions | SQL-T; E2E | 13 | Chưa có diff 2 phiên bản |
| Marketing | Nhận media / transcode / proxy | P1 | partial | Tải tệp + sha256 + % tiến độ | R2 presign | | E2E | 13 | Không transcode / proxy |
| Marketing | Chú thích timecode | P1 | not implemented | | | | | | |
| Marketing | Cổng duyệt y khoa | P0 | implemented | ApprovalCenter | `mw_review_step` (loại medical) | | SQL-T; E2E T13 | 15 | |
| Marketing | Cổng duyệt thương hiệu | P0 | implemented | như trên (marketing) | | | E2E | | |
| Marketing | Cổng consent / pháp lý | P0 | implemented | ContentStudio › Consent; ApprovalCenter (xác minh) | `mw_verify_consent`, `mw_consent_ok`, trigger thu hồi | mw_consents | SQL-T T16; E2E T16 | | Lưu MÃ hồ sơ, không lưu tài liệu consent |
| Marketing | Biến thể theo nền tảng | P1 | partial | 1 bài đăng / nền tảng gắn caption + tệp | | mw_publications | E2E | 16–18 | Caption riêng từng nền tảng = thêm phiên bản caption |
| Marketing | Đăng tự động qua API | P2 | not implemented | Banner “chưa kết nối API” | | | | 16 | Cần OAuth + App Review |
| Marketing | Đăng thủ công có bằng chứng | P1 | implemented | PublishingQueue, PublicationCard | `mw_schedule_publication`, `mw_submit_publish_proof`, `mw_verify_publication` | mw_publications | SQL-T T20; E2E T20 | 17, 18 | |
| Marketing | Nguồn analytics mạng xã hội | P2 | not implemented | ghi “chưa kết nối nguồn số liệu” | | | | | |
| Marketing | Sản lượng / SLA / khối lượng | P1 | partial | Overview: thông lượng 14 ngày, khối lượng theo người, trễ hạn | | | E2E | 19 | Chưa có SLA duyệt |
| Marketing | AI assistant | P2 | not implemented | tab khoá | | | | | |
| Marketing | Mobile UX 360 / 390 | P0 | implemented | mọi màn (hộp Di chuyển, agenda, CTA dính đáy duyệt) | | | E2E mobile | 10, 11, 20 | |
| Marketing | Realtime | P0/P1 | partial | `useRealtimeReload` | Supabase realtime publication | | (không test được cục bộ) | | Gom 20 s; không có presence |
| Marketing | RBAC + ACL + cách ly | P0 | implemented | ẩn nút theo quyền | RLS mọi bảng, RPC kiểm quyền | | SQL-T T01/T02, chống giả mạo; E2E RBAC | 09 | |
| Marketing | Nhật ký + migration + rollback | P0 | implemented | Lịch sử thẻ, Nhật ký quản trị | `mw_activity`; rollback.sql | | SQL-T T25 | | |
