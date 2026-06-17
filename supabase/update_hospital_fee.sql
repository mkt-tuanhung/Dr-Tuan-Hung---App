-- Thêm các cột lưu trữ thông tin Viện phí vào bảng customer_appointments
ALTER TABLE customer_appointments
ADD COLUMN hospital_fee numeric(15,0),
ADD COLUMN hospital_fee_method text,
ADD COLUMN hospital_fee_proof text,
ADD COLUMN hospital_fee_date timestamptz;
