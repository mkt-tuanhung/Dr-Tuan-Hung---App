-- Bổ sung các cột mới vào bảng customer_appointments để phục vụ giao diện thêm Lịch hẹn chi tiết
ALTER TABLE public.customer_appointments
ADD COLUMN IF NOT EXISTS appointment_time TIME,
ADD COLUMN IF NOT EXISTS test_status TEXT,
ADD COLUMN IF NOT EXISTS expected_bill NUMERIC,
ADD COLUMN IF NOT EXISTS telesale_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS social_link TEXT;
