-- Bổ sung các cột phân tích doanh thu vào bảng customer_appointments
ALTER TABLE public.customer_appointments
ADD COLUMN IF NOT EXISTS service_group TEXT,
ADD COLUMN IF NOT EXISTS customer_source TEXT,
ADD COLUMN IF NOT EXISTS customer_type TEXT;
