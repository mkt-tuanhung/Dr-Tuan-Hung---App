-- ============================================================
-- ẢNH BẰNG CHỨNG CHẤM CÔNG KHUÔN MẶT
-- Mỗi lượt Face check-in/check-out chụp 1 ảnh tại thời điểm quét (upload R2),
-- lưu vào bản ghi chấm công + audit để admin đối soát.
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================
alter table attendance add column if not exists check_in_photo  text;
alter table attendance add column if not exists check_out_photo text;
alter table face_attendance_audit add column if not exists snapshot_url text;

-- Kiểm tra: phải ra 3
select count(*) as ok from information_schema.columns
where (table_name = 'attendance' and column_name in ('check_in_photo','check_out_photo'))
   or (table_name = 'face_attendance_audit' and column_name = 'snapshot_url');
