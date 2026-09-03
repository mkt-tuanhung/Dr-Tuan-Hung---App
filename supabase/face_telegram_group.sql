-- ============================================================
-- NHÓM TELEGRAM CHẤM CÔNG — tên cơ sở hiển thị trong tin nhắn 📍
-- Kèm theo: đặt Edge Secret TELEGRAM_ATTENDANCE_CHAT_ID = chat_id nhóm
-- rồi deploy lại function face-attendance.
-- ============================================================
alter table face_config add column if not exists office_name text not null default 'Cơ sở Hà Nội';

-- Đổi tên cơ sở nếu muốn:
-- update face_config set office_name = 'Cơ sở Hà Nội' where id = 1;

select office_name from face_config;
