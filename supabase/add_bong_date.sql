-- ============================================================
-- Telesale — lưu mốc thời gian khách bị đánh giá BONG (phục vụ thưởng lịch hẹn)
-- deposit_date (cọc) & surgery_date (PT) đã có sẵn. An toàn cho prod.
-- ============================================================
alter table customer_appointments add column if not exists bong_date date;
