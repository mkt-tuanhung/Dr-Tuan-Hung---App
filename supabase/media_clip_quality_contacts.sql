-- ============================================================
-- "Khách hàng tiềm năng" theo định nghĩa NỘI BỘ:
--   khách ib cho page TỪ 3 TIN trở lên, nội dung không lặp lại.
-- Facebook Ads API không đo được chỉ số này (chỉ đếm hội thoại bắt đầu),
-- nên HỆ THỐNG NGOÀI (đang đọc inbox page) đếm và ghi vào cột này.
--
-- Hệ thống ngoài chỉ cần: UPDATE media_clips
--   SET quality_contacts = <số KH tiềm năng chuẩn> WHERE fb_campaign_id = '<id>';
-- App ưu tiên hiện quality_contacts; nếu NULL thì tạm hiện fb_messages
-- (số khách bắt đầu nhắn tin từ ads — proxy gần nhất của Facebook).
-- Chạy trong Supabase SQL Editor.
-- ============================================================
alter table media_clips
  add column if not exists quality_contacts int;  -- NULL = hệ thống ngoài chưa ghi

notify pgrst, 'reload schema';
