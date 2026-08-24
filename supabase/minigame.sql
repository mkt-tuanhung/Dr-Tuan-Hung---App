-- ============================================================
-- MODULE MINIGAME — sân chơi cho nhân sự
-- Đợt đầu: VÒNG QUAY MAY MẮN (type='wheel'). Kiến trúc mở để thêm
-- loại game khác sau (đổi type + config).
--   - Admin tạo game: tiêu đề, thời gian mở, số lượt/người, danh sách
--     giải thưởng (tên, số lượng, tỉ lệ/weight, màu).
--   - Nhân sự quay qua RPC play_minigame (server chọn giải, chống gian lận,
--     tự trừ kho giải, chặn quá lượt).
--   - Ai cũng xem được danh sách người trúng.
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists minigames (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  type           text not null default 'wheel',       -- wheel | (mở rộng sau)
  status         text not null default 'active',      -- active | closed
  starts_at      timestamptz,
  ends_at        timestamptz,
  spins_per_user int  not null default 1,
  -- config.prizes = [{label, color, qty (null = không giới hạn), weight}]
  config         jsonb not null default '{}'::jsonb,
  created_by     uuid references profiles(id),
  created_at     timestamptz default now()
);

create table if not exists minigame_plays (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references minigames(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  prize      text,                                    -- tên giải trúng
  created_at timestamptz default now()
);
create index if not exists idx_mgplays_game on minigame_plays(game_id, created_at desc);
create index if not exists idx_mgplays_user on minigame_plays(game_id, user_id);

alter table minigames enable row level security;
alter table minigame_plays enable row level security;

drop policy if exists "mg_select" on minigames;
drop policy if exists "mg_admin_all" on minigames;
drop policy if exists "mgp_select" on minigame_plays;

-- Mọi nhân sự đăng nhập xem được game + kết quả
create policy "mg_select" on minigames for select using (auth.uid() is not null);
create policy "mgp_select" on minigame_plays for select using (auth.uid() is not null);
-- Chỉ admin tạo/sửa/xoá game
create policy "mg_admin_all" on minigames for all
  using (public.current_user_role()::text = 'admin')
  with check (public.current_user_role()::text = 'admin');
-- KHÔNG mở policy insert cho minigame_plays — chỉ ghi qua RPC bên dưới.

-- RPC QUAY: server chọn giải theo weight, trừ kho, chặn quá lượt (chống gian lận).
create or replace function public.play_minigame(p_game uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g         minigames%rowtype;
  my_plays  int;
  prizes    jsonb;
  pr        jsonb;
  used      int;
  qty       int;
  avail     jsonb[] := '{}';
  weights   numeric[] := '{}';
  total_w   numeric := 0;
  r         numeric;
  acc       numeric := 0;
  chosen    jsonb;
  chosen_ix int := -1;
  i         int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Chưa đăng nhập');
  end if;

  -- Khoá theo game trong transaction: 2 người quay cùng lúc không lệch kho giải
  perform pg_advisory_xact_lock(hashtext(p_game::text));

  select * into g from minigames where id = p_game;
  if not found then return jsonb_build_object('ok', false, 'error', 'Không tìm thấy game'); end if;
  if g.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'Game đã đóng'); end if;
  if g.starts_at is not null and now() < g.starts_at then return jsonb_build_object('ok', false, 'error', 'Game chưa mở'); end if;
  if g.ends_at   is not null and now() > g.ends_at   then return jsonb_build_object('ok', false, 'error', 'Game đã hết hạn'); end if;

  select count(*) into my_plays from minigame_plays where game_id = p_game and user_id = auth.uid();
  if my_plays >= g.spins_per_user then
    return jsonb_build_object('ok', false, 'error', 'Bạn đã hết lượt quay');
  end if;

  prizes := coalesce(g.config->'prizes', '[]'::jsonb);
  -- Lọc giải còn hàng (qty null = vô hạn)
  for i in 0 .. jsonb_array_length(prizes) - 1 loop
    pr := prizes->i;
    qty := case when pr->>'qty' is null or pr->>'qty' = '' then null else (pr->>'qty')::int end;
    if qty is not null then
      select count(*) into used from minigame_plays where game_id = p_game and prize = pr->>'label';
      if used >= qty then continue; end if;
    end if;
    avail := avail || (pr || jsonb_build_object('ix', i));
    weights := weights || greatest(coalesce((pr->>'weight')::numeric, 1), 0.0001);
    total_w := total_w + greatest(coalesce((pr->>'weight')::numeric, 1), 0.0001);
  end loop;

  if array_length(avail, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Đã hết giải thưởng');
  end if;

  -- Chọn ngẫu nhiên theo trọng số
  r := random() * total_w;
  for i in 1 .. array_length(avail, 1) loop
    acc := acc + weights[i];
    if r <= acc then chosen := avail[i]; exit; end if;
  end loop;
  if chosen is null then chosen := avail[array_length(avail, 1)]; end if;
  chosen_ix := (chosen->>'ix')::int;

  insert into minigame_plays (game_id, user_id, prize) values (p_game, auth.uid(), chosen->>'label');

  return jsonb_build_object(
    'ok', true,
    'prize', chosen->>'label',
    'prize_index', chosen_ix,
    'remaining', g.spins_per_user - my_plays - 1
  );
end;
$$;

grant execute on function public.play_minigame(uuid) to authenticated;

-- Realtime: kết quả quay hiện ngay cho mọi người
do $$ begin alter publication supabase_realtime add table minigame_plays; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table minigames; exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
