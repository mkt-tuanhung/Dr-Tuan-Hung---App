# Lịch sử phiên bản (Changelog)

Các thay đổi của dự án "Dr Tuan Hung App" sẽ được lưu trữ tự động tại đây để phục vụ việc theo dõi và Rollback Vercel.

## [v1.0.1] - Tích hợp Duyệt đơn xin phép vào module Chấm công
- **Xóa** menu "Đơn xin phép" đứng độc lập bên ngoài Admin Dashboard.
- **Thêm** giao diện dạng Tab (Bảng chấm công / Duyệt đơn) vào trang Quản lý chấm công.
- **Thêm** Badge đếm số đơn chờ duyệt Real-time trên thanh menu Admin Dashboard.
- **Cập nhật** logic duyệt đơn: Khi Admin duyệt đơn xin phép, hệ thống tự động điền trạng thái (Có mặt/Đi trễ/Nửa ngày/Nghỉ phép) vào bảng Chấm Công.

## [v1.0.2] - Sửa lỗi hiển thị Đơn xin phép
- **Fix:** Đơn xin phép đang chờ duyệt (của tháng khác) không hiển thị trong danh sách của tháng hiện tại, dẫn đến sai lệch số lượng đếm trên Menu. Đã sửa để tất cả đơn chờ duyệt luôn luôn hiển thị để Admin không bỏ sót.

## [v1.1.0] - Xây dựng Module Quản lý Lịch hẹn (Appointments)
- **Thiết kế** giao diện Kanban (Kéo-Thả) 4 trạng thái cho Lịch hẹn chính: Lịch mới, Khách cọc, Đã phẫu thuật, Đã bong.
- **Thêm** danh sách "Lịch tái khám" phía dưới bảng Kanban giúp chăm sóc khách cũ nhanh chóng.
- **Tích hợp** Modal tạo lịch hẹn với 2 tùy chọn phân chia rõ ràng: Lịch hẹn mới và Lịch tái khám.
- **Cập nhật** AdminDashboard để kết nối menu Lịch hẹn.

## [v1.0.3] - Sửa lỗi cú pháp PostgREST
- **Fix:** Thay đổi logic fetch dữ liệu để tránh lỗi cú pháp `.or()` làm Supabase trả về rỗng, gây ra hiện tượng không hiển thị được đơn xin phép.

## [v1.2.0] - Cấu trúc lại luồng Khách hàng và Lịch hẹn
- **Đổi mới:** Thay thế giao diện Kanban bằng giao diện Danh sách tập trung tại Lịch hẹn.
- **Tính năng 'Đánh giá':** Mở form chuyên sâu tùy theo kết quả (Cọc, Phẫu thuật, Bong).
- **Bổ sung Module:** Thêm 3 Menu độc lập (Khách Cọc, Khách Phẫu Thuật, Khách Bong) để phân luồng và chăm sóc tự động sau khi đánh giá từ Lịch hẹn.
