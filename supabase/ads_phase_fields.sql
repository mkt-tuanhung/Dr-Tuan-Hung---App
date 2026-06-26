-- Bổ sung trường cho Kho Media + Video Ads (Sản xuất Ads)
-- Kho media
alter table media_customers add column if not exists source_type text;                    -- Before/After, feedback, hậu phẫu, quá trình...
alter table media_customers add column if not exists source_status text default 'chua_dung'; -- chua_dung|dang_dung|da_dung|loi|can_bo_sung
alter table media_customers add column if not exists media_in_charge_id uuid references profiles(id); -- tag nhân viên media phụ trách

-- Video clip (Phase 2)
alter table media_clips add column if not exists video_version text;   -- V1, V2...
alter table media_clips add column if not exists video_format text;    -- 9:16 | 1:1 | 16:9
alter table media_clips add column if not exists platform text;        -- facebook | tiktok | youtube | reels
alter table media_clips add column if not exists video_goal text;      -- inbox | lich_hen | nhan_dien | remarketing
alter table media_clips add column if not exists result_status text;   -- kết quả: tot | trung_binh | kem
