-- ============================================================
-- Kéo chỉ số theo NHIỀU ID QUẢNG CÁO (thay vì 1 ID chiến dịch).
-- 1 video có thể chạy trên nhiều campaign -> nhiều quảng cáo khác nhau.
-- Nhập hàng loạt ID (cấp CHIẾN DỊCH / NHÓM QC / QUẢNG CÁO đều được — endpoint
-- insights của Facebook tự gộp con), hệ thống CỘNG TỔNG chỉ số về video đó.
--
-- Các cột fb_spend / fb_messages / fb_leads / fb_purchases... vẫn giữ nguyên,
-- nay lưu TỔNG đã cộng của tất cả ID trong fb_ad_ids.
-- Cột fb_campaign_id cũ vẫn giữ để tương thích dữ liệu đã gán trước đây.
-- Chạy trong Supabase SQL Editor.
-- ============================================================
alter table media_clips
  add column if not exists fb_ad_ids text[] not null default '{}';

-- Chuyển ID chiến dịch đã gán trước đây (nếu có) vào danh sách ID mới,
-- để clip cũ vẫn hiển thị & đồng bộ được theo cơ chế mới.
update media_clips
  set fb_ad_ids = array[fb_campaign_id]
  where fb_campaign_id is not null
    and coalesce(array_length(fb_ad_ids, 1), 0) = 0;

notify pgrst, 'reload schema';
