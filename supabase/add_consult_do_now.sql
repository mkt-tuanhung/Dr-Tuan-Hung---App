-- Lịch hẹn tư vấn: ô tích "TƯ VẤN LÀM LUÔN" — khách tư vấn xong phẫu thuật ngay.
-- Khi tích: thông báo lịch gửi về CẢ nhóm Tư vấn LẪN nhóm Phẫu thuật.
alter table customer_appointments add column if not exists consult_do_now boolean default false;
