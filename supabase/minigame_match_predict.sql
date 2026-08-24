-- ============================================================
-- MINIGAME: DỰ ĐOÁN BÓNG ĐÁ (type='match')
--   - Bảng minigame_predictions: mỗi người 1 dự đoán / trận
--     (tỉ số + cầu thủ ghi bàn + MVP), sửa được TRƯỚC giờ bóng lăn.
--   - Seed sẵn trận AFF Cup: VIỆT NAM vs THÁI LAN 20:00 26/08/2026
--     kèm đội hình VN (số áo + tên; trường photo để trống — admin dán
--     link ảnh cầu thủ vào config là hiện ảnh thật).
--   - Admin cập nhật tỉ số/ghi bàn/MVP ngay trong trang -> realtime.
-- Chạy SAU supabase/minigame.sql. Idempotent.
-- ============================================================

create table if not exists minigame_predictions (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references minigames(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  pred_a     int  not null default 0,     -- tỉ số dự đoán đội A (Việt Nam)
  pred_b     int  not null default 0,     -- tỉ số dự đoán đội B
  scorer     text,                        -- cầu thủ VN ghi bàn (dự đoán)
  mvp        text,                        -- MVP trận đấu (dự đoán)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (game_id, user_id)
);
create index if not exists idx_mgpred_game on minigame_predictions(game_id, created_at desc);

alter table minigame_predictions enable row level security;
drop policy if exists "mgpred_sel" on minigame_predictions;
drop policy if exists "mgpred_ins" on minigame_predictions;
drop policy if exists "mgpred_upd" on minigame_predictions;

-- Ai đăng nhập cũng xem được dự đoán của nhau (cho vui + minh bạch)
create policy "mgpred_sel" on minigame_predictions for select using (auth.uid() is not null);
-- Chỉ tự ghi dự đoán của mình, và CHỈ TRƯỚC GIỜ BÓNG LĂN (kickoff trong config)
create policy "mgpred_ins" on minigame_predictions for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from minigames g
    where g.id = game_id and g.status = 'active'
      and coalesce((g.config->>'kickoff')::timestamptz, now() + interval '100 years') > now()
  )
);
create policy "mgpred_upd" on minigame_predictions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from minigames g
      where g.id = game_id and g.status = 'active'
        and coalesce((g.config->>'kickoff')::timestamptz, now() + interval '100 years') > now()
    )
  );

do $$ begin alter publication supabase_realtime add table minigame_predictions; exception when duplicate_object then null; end $$;

-- ---------- SEED TRẬN: VIỆT NAM vs THÁI LAN — 20:00 26/08/2026 ----------
insert into minigames (id, title, type, status, spins_per_user, starts_at, ends_at, config)
values (
  'affc2026-0826-4000-8000-000000000001',
  'Dự đoán: Việt Nam vs Thái Lan — AFF Cup',
  'match',
  'active',
  1,
  null,
  '2026-08-26 23:59:59+07',
  jsonb_build_object(
    'team_a', jsonb_build_object('name', 'Việt Nam', 'short', 'VIE', 'flag', '🇻🇳', 'color', '#da251d'),
    'team_b', jsonb_build_object('name', 'Thái Lan', 'short', 'THA', 'flag', '🇹🇭', 'color', '#2d2a6e'),
    'kickoff', '2026-08-26T20:00:00+07:00',
    'venue', 'Chung kết AFF Cup 2026',
    'match_status', 'upcoming',            -- upcoming | live | finished
    'score_a', 0, 'score_b', 0,
    'scorers', '[]'::jsonb,                -- [{player, minute}]
    'mvp', null,
    -- Đội hình VN (số áo tham khảo — admin sửa trong config; photo: dán URL ảnh là hiện)
    'squad', jsonb_build_array(
      jsonb_build_object('num', 1,  'name', 'Nguyễn Filip',        'pos', 'GK', 'photo', null),
      jsonb_build_object('num', 26, 'name', 'Nguyễn Đình Triệu',   'pos', 'GK', 'photo', null),
      jsonb_build_object('num', 2,  'name', 'Đỗ Duy Mạnh',         'pos', 'DF', 'photo', null),
      jsonb_build_object('num', 3,  'name', 'Quế Ngọc Hải',        'pos', 'DF', 'photo', null),
      jsonb_build_object('num', 4,  'name', 'Bùi Hoàng Việt Anh',  'pos', 'DF', 'photo', null),
      jsonb_build_object('num', 5,  'name', 'Phan Tuấn Tài',       'pos', 'DF', 'photo', null),
      jsonb_build_object('num', 16, 'name', 'Nguyễn Thanh Bình',   'pos', 'DF', 'photo', null),
      jsonb_build_object('num', 17, 'name', 'Vũ Văn Thanh',        'pos', 'DF', 'photo', null),
      jsonb_build_object('num', 8,  'name', 'Đỗ Hùng Dũng',        'pos', 'MF', 'photo', null),
      jsonb_build_object('num', 10, 'name', 'Nguyễn Quang Hải',    'pos', 'MF', 'photo', null),
      jsonb_build_object('num', 14, 'name', 'Nguyễn Hoàng Đức',    'pos', 'MF', 'photo', null),
      jsonb_build_object('num', 18, 'name', 'Khuất Văn Khang',     'pos', 'MF', 'photo', null),
      jsonb_build_object('num', 20, 'name', 'Châu Ngọc Quang',     'pos', 'MF', 'photo', null),
      jsonb_build_object('num', 21, 'name', 'Nguyễn Hai Long',     'pos', 'MF', 'photo', null),
      jsonb_build_object('num', 7,  'name', 'Nguyễn Văn Toàn',     'pos', 'FW', 'photo', null),
      jsonb_build_object('num', 9,  'name', 'Nguyễn Tiến Linh',    'pos', 'FW', 'photo', null),
      jsonb_build_object('num', 11, 'name', 'Phạm Tuấn Hải',       'pos', 'FW', 'photo', null),
      jsonb_build_object('num', 12, 'name', 'Nguyễn Xuân Son',     'pos', 'FW', 'photo', null),
      jsonb_build_object('num', 15, 'name', 'Bùi Vĩ Hào',          'pos', 'FW', 'photo', null),
      jsonb_build_object('num', 23, 'name', 'Nguyễn Đình Bắc',     'pos', 'FW', 'photo', null)
    )
  )
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
