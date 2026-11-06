-- ============================================================
-- GIẢM TẢI CPU SUPABASE (chạy lại vẫn an toàn)
--  1) Gỡ module Minigame / Ma Sói / Dự đoán / Phòng họp khỏi realtime (app không dùng nữa).
--     KHÔNG xoá bảng, KHÔNG xoá dữ liệu — chỉ ngừng phát sự kiện realtime.
--  2) Dọn nhật ký chạy cron (cron.job_run_details) — chỉ giữ 3 ngày gần nhất,
--     đặt lịch tự dọn hằng ngày lúc 02:15 giờ Việt Nam.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['minigames','minigame_plays','minigame_predictions','ww_rooms','ww_players','meetings'] loop
    if exists (select 1 from pg_publication_tables
               where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;

delete from cron.job_run_details where end_time < now() - interval '3 days';

select cron.schedule('cron-log-cleanup-daily', '15 19 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$);

-- Kiểm tra:
--   select count(*) from cron.job_run_details;
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
