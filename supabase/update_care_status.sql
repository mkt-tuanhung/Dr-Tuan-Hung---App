-- Bổ sung các cột mới vào bảng customer_appointments để phục vụ tính năng Mini-CRM (Khách Cọc / Bong)
ALTER TABLE public.customer_appointments
ADD COLUMN IF NOT EXISTS care_status TEXT DEFAULT 'Đang chăm sóc',
ADD COLUMN IF NOT EXISTS care_notes TEXT;
