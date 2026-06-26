-- Thêm chức vụ Outsource (nhân sự thuê ngoài).
-- Outsource bị ẩn ở frontend các module: Lịch hẹn, Chấm công, Tạm ứng chi.
alter type user_role add value if not exists 'outsource';
