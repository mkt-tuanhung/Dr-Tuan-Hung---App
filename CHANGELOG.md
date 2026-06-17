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

## [v1.2.1] - Sửa lỗi Embed Data Supabase
- **Fix:** Xử lý triệt để lỗi `Could not embed because more than one relationship was found` bằng cách bóc tách truy vấn và tự động map dữ liệu Profile thủ công trong LeaveManagementPage.

## [v1.3.0] - Giao diện Lịch hẹn hoàn toàn mới & Chuẩn UX/UI
- **Database:** Thêm các trường dữ liệu quản lý ca hẹn sâu hơn (Giờ hẹn, Test_status, Telesale/Sale_id, Link social...)
- **Trang Lịch Hẹn:** 
  - Hiển thị toàn bộ dữ liệu lịch sử (Kể cả Cọc/Bong/Phẫu thuật) thay vì ẩn đi.
  - Gom nhóm danh sách lịch hẹn theo từng thẻ Ngày (Group by Date).
  - Bổ sung 6 module thống kê bằng số trên đầu trang.
  - Bổ sung biểu đồ tròn tỷ lệ trạng thái và biểu đồ đường biến động theo thời gian.
- **Form Nhập Liệu:** Nâng cấp form 'Thêm Lịch' và form 'Đánh Giá' thành Modal chi tiết đa trường dữ liệu theo đúng thiết kế.

## [v1.4.0] - Nâng cấp Khách Cọc & Khách Bong thành Mini-CRM
- **Database:** Thêm các trường `care_status` và `care_notes` để lưu lịch sử và tiến độ chăm sóc.
- **Khách Bong / Cọc:** 
  - Bổ sung bộ lọc Tabs theo tiến trình chăm sóc (Đang chăm, Làm nơi khác, Chờ lịch...).
  - Thay đổi UI hiển thị rõ chi tiết ghi chú chăm sóc cũ.
  - **Thêm 3 nút thao tác điều hướng:** Ghi chú chăm, Khách Hủy (sang Bong) / Khách Quay Lại (về Lịch hẹn), và Chốt Phẫu Thuật (tự động điều phối luồng dữ liệu sang phân hệ khác).
