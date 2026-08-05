-- ============================================================
-- TỰ ĐỘNG LÊN CHIẾN DỊCH FACEBOOK cho video được duyệt.
-- Luồng: Ads duyệt & chọn page + giờ chạy -> platform admin.drtuanhung.vn
-- đăng bài lên page rồi ghi fb_post_id về -> cron fb-create-campaign đến giờ
-- tự tạo Campaign/AdSet/Creative/Ad từ bài đăng -> gán fb_campaign_id vào clip
-- -> fb-sync-clips (60p) tự kéo chỉ số & trạng thái như bình thường.
-- Chạy trong Supabase SQL Editor.
-- ============================================================

-- 1) Danh sách page đã cấp token (hiện trong popup duyệt để Ads tích chọn)
create table if not exists fb_pages (
  page_id      text primary key,          -- ID page Facebook
  name         text not null,             -- tên hiển thị
  active       boolean not null default true,
  campaign_seq int not null default 0,    -- số thứ tự đặt tên chiến dịch Dungnt_[page]_N
  created_at   timestamptz default now()
);
alter table fb_pages enable row level security;
drop policy if exists "fb_pages_read" on fb_pages;
create policy "fb_pages_read" on fb_pages for select using (auth.uid() is not null);
-- Ghi/sửa page: admin làm qua SQL Editor hoặc platform dùng service role.
-- VD thêm page:  insert into fb_pages(page_id, name) values ('123456789', 'Dr Tuấn Hùng');

-- 2) Cấu hình chiến dịch tự động (1 dòng duy nhất, id = 1)
create table if not exists fb_ads_config (
  id                int primary key default 1,
  ad_account_id     text,                                     -- act_ (chỉ phần số); trống thì dùng secret FB_AD_ACCOUNT_ID
  daily_budget      bigint not null default 500000,           -- ngân sách ngày (VND)
  objective         text not null default 'OUTCOME_ENGAGEMENT',
  optimization_goal text not null default 'POST_ENGAGEMENT',  -- hoặc CONVERSATIONS (tin nhắn)
  billing_event     text not null default 'IMPRESSIONS',
  destination_type  text,                                     -- 'MESSENGER' nếu chạy tin nhắn
  targeting         jsonb not null default '{"geo_locations":{"countries":["VN"]},"custom_audiences":[]}'::jsonb,
  template_adset_id text,                                     -- NHÂN BẢN target từ nhóm quảng cáo mẫu này (ưu tiên hơn targeting)
  campaign_prefix   text not null default 'Dungnt',
  campaign_status   text not null default 'ACTIVE',           -- 'PAUSED' nếu muốn duyệt tay trên Ads Manager trước khi tiêu tiền
  updated_at        timestamptz default now()
);
insert into fb_ads_config (id) values (1) on conflict (id) do nothing;
alter table fb_ads_config enable row level security;
drop policy if exists "fb_ads_config_read" on fb_ads_config;
create policy "fb_ads_config_read" on fb_ads_config for select using (auth.uid() is not null);
-- Nạp target — chọn 1 trong 2 cách:
--   Cách 1 (khuyến nghị): NHÂN BẢN target từ 1 nhóm quảng cáo mẫu đang chạy tốt:
--     update fb_ads_config set template_adset_id = '<ID_NHÓM_QUẢNG_CÁO_MẪU>' where id = 1;
--   Cách 2: tự nạp spec + Custom Audience ID (Saved Audience KHÔNG dùng được qua API):
--     update fb_ads_config set targeting = '{"geo_locations":{"countries":["VN"]},"custom_audiences":[{"id":"<AUDIENCE_ID>"}]}'::jsonb where id = 1;
alter table fb_ads_config add column if not exists template_adset_id text;  -- (cho DB đã tạo bảng trước đó)

-- 3) Cột theo dõi trên clip
alter table media_clips
  add column if not exists ads_page_id     text,         -- page được Ads tích chọn (platform đăng lên page này)
  add column if not exists ads_page_name   text,
  add column if not exists ads_run_at      timestamptz,  -- giờ tạo chiến dịch (≥ duyệt + 15 phút)
  add column if not exists fb_post_id      text,         -- PLATFORM ghi sau khi đăng bài (ID bài đăng)
  add column if not exists ads_auto_status text,         -- queued | created | failed
  add column if not exists ads_error       text;
create index if not exists media_clips_ads_queue_idx on media_clips(ads_auto_status) where ads_auto_status = 'queued';

notify pgrst, 'reload schema';

-- ============================================================
-- HỢP ĐỒNG VỚI PLATFORM admin.drtuanhung.vn (service role):
-- Khi thấy clip post_now = true, post_status = 'queued':
--   1) Đăng video lên page có page_id = ads_page_id (nếu NULL thì page mặc định)
--   2) UPDATE media_clips SET post_status = 'posted', posted_at = now(),
--        fb_post_id = '<ID_BÀI_ĐĂNG>'   -- chỉ phần sau dấu _ hoặc full đều được
--      WHERE id = '<clip_id>';
-- Cron fb-create-campaign sẽ lo phần còn lại.
-- ============================================================
