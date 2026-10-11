-- ============================================================
-- LỊCH SỬ GHI CHÚ / TRAO ĐỔI GETFLY — chạy 1 lần trong SQL Editor (chạy lại vẫn an toàn)
--
-- GetFly: GET /api/v6/accounts/{id}/comments -> mọi trao đổi / phản hồi của 1 khách.
-- Edge Function getfly-comments kéo về 2 bảng dưới:
--   getfly_comments      : từng ghi chú (nội dung, người viết, thời gian, trao đổi | phản hồi)
--   getfly_comment_sync  : trạng thái đồng bộ theo từng khách GetFly (lần kéo, số ghi chú)
-- Cố ý KHÔNG ghi thêm vào marketing_data: bảng đó bật realtime, ghi hàng loạt sẽ làm
-- màn Data KH của mọi người tải lại liên tục (xem ghi chú trong getfly-sync).
--
-- Ai xem được ghi chú: đúng những người xem được khách đó trong marketing_data (RLS).
-- Chỉ Edge Function (service role) được ghi.
--
-- Cuối file: tạo lịch tự động mỗi 10 phút (lệch 5 phút so với getfly-sync), CHÉP cấu hình
-- gọi hàm (URL + key) từ lịch 'getfly-sync-10min' đang chạy -> không cần dán key.
-- ============================================================

create table if not exists public.getfly_comments (
  id                 text primary key,               -- id ghi chú bên GetFly
  account_getfly_id  text not null,                  -- marketing_data.getfly_id
  data_id            uuid references public.marketing_data(id) on delete cascade,
  title              text,
  content            text,
  creator_name       text,
  creator_getfly_id  text,
  is_feedback        boolean not null default false, -- false = trao đổi, true = phản hồi
  created_at         timestamptz,
  synced_at          timestamptz not null default now()
);
create index if not exists getfly_comments_data_idx on public.getfly_comments (data_id, created_at desc);
create index if not exists getfly_comments_account_idx on public.getfly_comments (account_getfly_id);

create table if not exists public.getfly_comment_sync (
  account_getfly_id  text primary key,
  data_id            uuid references public.marketing_data(id) on delete cascade,
  synced_at          timestamptz not null default now(),
  source_updated_at  timestamptz,                    -- getfly_updated_at lúc kéo (để biết cần kéo lại)
  comment_count      integer not null default 0,
  last_comment_at    timestamptz,
  last_error         text
);
create index if not exists getfly_comment_sync_data_idx on public.getfly_comment_sync (data_id);

alter table public.getfly_comments enable row level security;
alter table public.getfly_comment_sync enable row level security;

-- Xem được khi xem được khách tương ứng (RLS của marketing_data áp dụng trong truy vấn con)
drop policy if exists getfly_comments_read on public.getfly_comments;
create policy getfly_comments_read on public.getfly_comments
  for select to authenticated
  using (exists (select 1 from public.marketing_data m where m.id = getfly_comments.data_id));

drop policy if exists getfly_comment_sync_read on public.getfly_comment_sync;
create policy getfly_comment_sync_read on public.getfly_comment_sync
  for select to authenticated
  using (exists (select 1 from public.marketing_data m where m.id = getfly_comment_sync.data_id));

grant select on public.getfly_comments, public.getfly_comment_sync to authenticated;
-- KHÔNG có policy insert/update/delete: chỉ Edge Function (service role) ghi.

-- ---------- Lịch tự động mỗi 10 phút ----------
do $$
declare cmd text;
begin
  if to_regclass('cron.job') is null then
    raise notice 'Chưa bật pg_cron — bỏ qua tạo lịch';
    return;
  end if;
  select command into cmd from cron.job where jobname = 'getfly-sync-10min';
  if cmd is null then
    raise notice 'Chưa có lịch getfly-sync-10min để chép cấu hình — tạo lịch getfly-comments thủ công';
    return;
  end if;
  cmd := replace(cmd, '/functions/v1/getfly-sync', '/functions/v1/getfly-comments');
  -- pg_net mặc định ngắt sau 5 giây -> cho chờ tới 150 giây (hàm chạy tối đa ~110 giây / lượt)
  cmd := replace(cmd, '''{}''::jsonb', '''{"mode":"incremental"}''::jsonb, timeout_milliseconds := 150000');
  perform cron.unschedule(jobid) from cron.job where jobname = 'getfly-comments-10min';
  perform cron.schedule('getfly-comments-10min', '5-59/10 * * * *', cmd);
end $$;

-- Kiểm tra:
--   select jobname, schedule, active from cron.job where jobname like 'getfly%';
--   select count(*), sum(comment_count) from public.getfly_comment_sync;
