-- ============================================================
-- MINIGAME MA SÓI — Dual Mode (đợt 1: OFFLINE hoàn chỉnh)
-- Chạy TOÀN BỘ file trong Supabase SQL Editor. Idempotent.
--
-- Bảo mật vai (cốt lõi của game):
--   • Vai được chia PHÍA SERVER (RPC security definer, shuffle ngẫu nhiên)
--   • Cột role bị THU HỒI quyền đọc — không ai select được qua API
--   • Xem vai CHÍNH MÌNH: RPC ww_my_role
--   • Quản trò (host) xem TẤT CẢ vai để dẫn game: RPC ww_room_roles
-- ============================================================

-- 1) PHÒNG
create table if not exists ww_rooms (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,                -- mã 6 số để join/QR
  host_id uuid references profiles(id) on delete cascade not null,
  mode text not null default 'OFFLINE',     -- OFFLINE | ONLINE (đợt sau)
  status text not null default 'LOBBY',     -- LOBBY | REVEAL | HANDOFF | ENDED
  round int not null default 1,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  started_at timestamptz
);
alter table ww_rooms enable row level security;
drop policy if exists "wwr_select" on ww_rooms;
drop policy if exists "wwr_host_update" on ww_rooms;
create policy "wwr_select" on ww_rooms for select using (auth.uid() is not null);
create policy "wwr_host_update" on ww_rooms for update
  using (host_id = auth.uid()) with check (host_id = auth.uid());
-- insert chỉ qua RPC ww_create_room (để sinh mã unique)

-- 2) NGƯỜI CHƠI
create table if not exists ww_players (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references ww_rooms(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  ready boolean not null default false,
  role text,                                -- BÍ MẬT — không đọc được qua select
  acked boolean not null default false,     -- đã xác nhận nhận vai
  joined_at timestamptz default now(),
  unique(room_id, user_id)
);
alter table ww_players enable row level security;
drop policy if exists "wwp_select" on ww_players;
drop policy if exists "wwp_update_self" on ww_players;
drop policy if exists "wwp_delete_self" on ww_players;
create policy "wwp_select" on ww_players for select using (auth.uid() is not null);
create policy "wwp_update_self" on ww_players for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- rời phòng: tự xoá mình; host đá người: xoá theo phòng mình làm chủ
create policy "wwp_delete_self" on ww_players for delete
  using (user_id = auth.uid() or exists (select 1 from ww_rooms r where r.id = room_id and r.host_id = auth.uid()));

-- KHÓA CỘT VAI: không ai select được role qua API (kể cả chính chủ — dùng RPC)
revoke select on ww_players from authenticated;
grant select (id, room_id, user_id, ready, acked, joined_at) on ww_players to authenticated;
grant update (ready) on ww_players to authenticated;
grant delete on ww_players to authenticated;

-- 3) TẠO PHÒNG (sinh mã 6 số unique)
create or replace function ww_create_room(p_mode text default 'OFFLINE')
returns ww_rooms language plpgsql security definer set search_path = public as $$
declare v_code text; v_room ww_rooms;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from ww_rooms where code = v_code and status <> 'ENDED');
  end loop;
  insert into ww_rooms (code, host_id, mode) values (v_code, auth.uid(), coalesce(p_mode, 'OFFLINE'))
  returning * into v_room;
  insert into ww_players (room_id, user_id, ready) values (v_room.id, auth.uid(), true);
  return v_room;
end $$;

-- 4) VÀO PHÒNG bằng mã
create or replace function ww_join_room(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into v_room from ww_rooms where code = p_code and status <> 'ENDED'
  order by created_at desc limit 1;
  if v_room.id is null then raise exception 'Mã phòng không tồn tại hoặc đã kết thúc'; end if;
  if v_room.status <> 'LOBBY' then
    -- đã là thành viên thì cho vào lại (mất mạng/refresh), người mới thì chặn
    if exists (select 1 from ww_players where room_id = v_room.id and user_id = auth.uid()) then
      return v_room.id;
    end if;
    raise exception 'Ván đã bắt đầu — chờ ván sau nhé';
  end if;
  if (select count(*) from ww_players where room_id = v_room.id) >= 20 then
    raise exception 'Phòng đã đầy (tối đa 20 người)';
  end if;
  insert into ww_players (room_id, user_id) values (v_room.id, auth.uid())
  on conflict (room_id, user_id) do nothing;
  return v_room.id;
end $$;

-- 5) BẮT ĐẦU VÁN — server chia vai ngẫu nhiên theo số người
--    4+: 1 Sói, 1 Tiên tri | 6+: +Phù thủy | 7+: +Bảo vệ | 8+: 2 Sói, +Thợ săn
--    9+: +Trưởng làng | 10+: +Cupid | 12+: 3 Sói | còn lại: Dân làng
create or replace function ww_start_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room ww_rooms; n int; roles text[]; ids uuid[]; i int;
begin
  select * into v_room from ww_rooms where id = p_room;
  if v_room.id is null then raise exception 'Không tìm thấy phòng'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'Chỉ chủ phòng được bắt đầu'; end if;
  if v_room.status <> 'LOBBY' then raise exception 'Ván đã bắt đầu rồi'; end if;

  select count(*) into n from ww_players where room_id = p_room;
  if n < 4 then raise exception 'Cần ít nhất 4 người chơi (đang có %)', n; end if;

  roles := array['wolf', 'seer'];
  if n >= 8  then roles := roles || 'wolf'; end if;
  if n >= 12 then roles := roles || 'wolf'; end if;
  if n >= 6  then roles := roles || 'witch'; end if;
  if n >= 7  then roles := roles || 'guard'; end if;
  if n >= 8  then roles := roles || 'hunter'; end if;
  if n >= 9  then roles := roles || 'mayor'; end if;
  if n >= 10 then roles := roles || 'cupid'; end if;
  while coalesce(array_length(roles, 1), 0) < n loop
    roles := roles || 'villager';
  end loop;

  -- xáo cả danh sách người lẫn danh sách vai
  select array_agg(id order by random()) into ids from ww_players where room_id = p_room;
  select array_agg(r order by random()) into roles from unnest(roles) as r;

  for i in 1..n loop
    update ww_players set role = roles[i], acked = false where id = ids[i];
  end loop;

  update ww_rooms set status = 'REVEAL', round = v_room.round, started_at = now() where id = p_room;
end $$;

-- 6) XEM VAI CỦA CHÍNH MÌNH
create or replace function ww_my_role(p_room uuid)
returns text language sql security definer set search_path = public as $$
  select role from ww_players where room_id = p_room and user_id = auth.uid();
$$;

-- 7) XÁC NHẬN ĐÃ NHẬN VAI — đủ người xác nhận -> HANDOFF (cất điện thoại, chơi trực tiếp)
create or replace function ww_ack_role(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update ww_players set acked = true where room_id = p_room and user_id = auth.uid();
  if not exists (select 1 from ww_players where room_id = p_room and acked = false) then
    update ww_rooms set status = 'HANDOFF' where id = p_room and status = 'REVEAL';
  end if;
end $$;

-- 8) QUẢN TRÒ xem toàn bộ vai để dẫn game (chỉ host, sau khi đã chia vai)
create or replace function ww_room_roles(p_room uuid)
returns table(user_id uuid, role text) language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms;
begin
  select * into v_room from ww_rooms where id = p_room;
  if v_room.host_id <> auth.uid() then raise exception 'Chỉ quản trò được xem danh sách vai'; end if;
  if v_room.status = 'LOBBY' then raise exception 'Chưa chia vai'; end if;
  return query select p.user_id, p.role from ww_players p where p.room_id = p_room;
end $$;

-- 9) VÁN MỚI (giữ nguyên người chơi, chia vai lại) / ĐÓNG PHÒNG
create or replace function ww_new_round(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms;
begin
  select * into v_room from ww_rooms where id = p_room;
  if v_room.host_id <> auth.uid() then raise exception 'Chỉ chủ phòng'; end if;
  update ww_players set role = null, acked = false, ready = true where room_id = p_room;
  update ww_rooms set status = 'LOBBY', round = v_room.round + 1 where id = p_room;
end $$;

grant execute on function ww_create_room(text) to authenticated;
grant execute on function ww_join_room(text) to authenticated;
grant execute on function ww_start_room(uuid) to authenticated;
grant execute on function ww_my_role(uuid) to authenticated;
grant execute on function ww_ack_role(uuid) to authenticated;
grant execute on function ww_room_roles(uuid) to authenticated;
grant execute on function ww_new_round(uuid) to authenticated;

-- 10) Realtime + thẻ game trong module Minigame
do $$ begin alter publication supabase_realtime add table ww_rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table ww_players; exception when duplicate_object then null; end $$;

insert into minigames (id, title, type, status, config)
values ('aa50aa50-0001-4000-8000-000000000001', 'Ma Sói — Đêm Trăng Làng Dr Hùng', 'werewolf', 'active', '{}'::jsonb)
on conflict (id) do nothing;

-- Kiểm tra
select 'rooms' as t, count(*) from ww_rooms
union all select 'players', count(*) from ww_players
union all select 'game row', count(*) from minigames where type = 'werewolf';
