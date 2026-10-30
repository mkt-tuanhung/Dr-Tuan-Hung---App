-- ============================================================
-- LÊN LỊCH ĐĂNG VIDEO ADS (chạy lại vẫn an toàn) — chạy SAU media_clip_post.sql, fb_auto_campaign.sql
--
-- Ads bấm "Duyệt & Đăng" -> chọn "Hẹn giờ đăng" (ngày + giờ):
--   media_clips.post_status       = 'scheduled'   (platform CHƯA thấy -> chưa đăng)
--   media_clips.post_scheduled_at = giờ hẹn đăng
-- Cron 'media-post-schedule-1min' (mỗi phút): đến giờ hẹn -> post_now = true, post_status = 'queued'
--   -> platform admin.drtuanhung.vn nhận tín hiệu như "Đăng ngay" và đăng lên page như thường lệ.
-- Platform muốn tự xếp lịch sớm trên Facebook (scheduled_publish_time) thì đọc thêm
-- các clip post_status = 'scheduled' + post_scheduled_at.
-- ============================================================

alter table public.media_clips
  add column if not exists post_scheduled_at timestamptz;   -- giờ hẹn đăng (null = đăng ngay)

create index if not exists media_clips_post_sched_idx on public.media_clips(post_scheduled_at)
  where post_status = 'scheduled';

-- Đến giờ hẹn -> chuyển sang hàng chờ đăng cho platform
create or replace function public.release_scheduled_posts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update media_clips
     set post_now = true, post_now_at = now(), post_status = 'queued'
   where post_status = 'scheduled' and post_scheduled_at is not null and post_scheduled_at <= now();
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.release_scheduled_posts() from public;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'media-post-schedule-1min') then
    perform cron.unschedule('media-post-schedule-1min');
  end if;
  perform cron.schedule('media-post-schedule-1min', '* * * * *', 'select public.release_scheduled_posts()');
end $$;

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select id, title, post_status, post_scheduled_at, ads_page_name from media_clips where post_status in ('scheduled','queued') order by post_scheduled_at;
--   select jobname, schedule, active from cron.job where jobname = 'media-post-schedule-1min';
