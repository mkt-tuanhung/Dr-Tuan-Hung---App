-- Lịch hẹn tư vấn: thêm trường "Tham khảo thêm" (dịch vụ khách cân nhắc thêm, chưa báo giá)
-- Hiển thị trong form Thêm lịch Tư vấn/PT và tin nhắn nhóm Telegram báo lịch.
alter table customer_appointments add column if not exists extra_consult text;
