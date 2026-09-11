-- ============================================================
-- TẠM DỪNG đồng bộ Messenger định kỳ (khi app đang nặng).
-- Gỡ 2 cron job kéo Messenger:
--   - fb-messenger-10min : kéo mỗi 10 phút
--   - fb-messenger-deep  : kéo sâu 200 hội thoại × 200 tin lúc 3h sáng VN
-- Chạy trong SQL Editor. An toàn để chạy lại nhiều lần (idempotent).
-- Muốn BẬT LẠI: chạy lại file supabase/fb_messenger_cron.sql
-- (webhook realtime fb-messenger-webhook KHÔNG bị ảnh hưởng — tin nhắn
--  mới vẫn vào khi có; chỉ dừng phần kéo hàng loạt định kỳ gây nặng).
-- ============================================================
select cron.unschedule(jobid) from cron.job where jobname = 'fb-messenger-10min';
select cron.unschedule(jobid) from cron.job where jobname = 'fb-messenger-deep';

-- Kiểm tra: không còn job nào tên fb-messenger-*
select jobname, schedule, active from cron.job where jobname like 'fb-messenger-%';
