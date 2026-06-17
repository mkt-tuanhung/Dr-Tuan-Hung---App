# Lịch sử phiên bản (Changelog)

Các thay đổi của dự án "Dr Tuan Hung App" sẽ được lưu trữ tự động tại đây để phục vụ việc theo dõi và Rollback Vercel.

## [v1.0.1] - Tích hợp Duyệt đơn xin phép vào module Chấm công
- **Xóa** menu "Đơn xin phép" đứng độc lập bên ngoài Admin Dashboard.
- **Thêm** giao diện dạng Tab (Bảng chấm công / Duyệt đơn) vào trang Quản lý chấm công.
- **Thêm** Badge đếm số đơn chờ duyệt Real-time trên thanh menu Admin Dashboard.
- **Cập nhật** logic duyệt đơn: Khi Admin duyệt đơn xin phép, hệ thống tự động điền trạng thái (Có mặt/Đi trễ/Nửa ngày/Nghỉ phép) vào bảng Chấm Công.

## [v1.0.2] - Sửa lỗi hiển thị Đơn xin phép
- **Fix:** Đơn xin phép đang chờ duyệt (của tháng khác) không hiển thị trong danh sách của tháng hiện tại, dẫn đến sai lệch số lượng đếm trên Menu. Đã sửa để tất cả đơn chờ duyệt luôn luôn hiển thị để Admin không bỏ sót.

## [v1.0.3] - Sửa lỗi cú pháp PostgREST
- **Fix:** Thay đổi logic fetch dữ liệu để tránh lỗi cú pháp `.or()` làm Supabase trả về rỗng, gây ra hiện tượng không hiển thị được đơn xin phép.
