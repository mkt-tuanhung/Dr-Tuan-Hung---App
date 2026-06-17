-- Bổ sung các cột mới vào bảng customer_appointments để phục vụ tính năng Phẫu Thuật và Hậu Phẫu
ALTER TABLE public.customer_appointments
ADD COLUMN IF NOT EXISTS surgery_type TEXT,
ADD COLUMN IF NOT EXISTS phu_mo_1_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS phu_mo_2_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS phu_mo_3_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS truc_dem_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS hau_phau_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS surgery_notes TEXT,
ADD COLUMN IF NOT EXISTS truc_dem_notes TEXT,
ADD COLUMN IF NOT EXISTS post_op_status TEXT DEFAULT 'Đang theo dõi',
ADD COLUMN IF NOT EXISTS post_op_notes TEXT;
