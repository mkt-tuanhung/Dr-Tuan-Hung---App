-- ============================================================
-- MA SÓI — CHO PHÉP KHÁCH VÃNG LAI (guest) tham gia bằng QR/link,
-- KHÔNG cần tài khoản Dr Tuấn Hùng và KHÔNG cần Edge Function.
-- Chạy TOÀN BỘ file này trong Supabase SQL Editor (sau werewolf.sql). Idempotent.
--
-- An toàn: guest KHÔNG có phiên đăng nhập, mọi thao tác ghi đi qua các RPC
-- security definer dưới đây (chỉ đụng bảng ww_rooms/ww_players, xác thực bằng
-- mã phòng + guest_token). Cột role vẫn KHÓA đọc.
-- ============================================================

-- 1) Người chơi có thể là KHÁCH (user_id NULL) — thêm tên + token định danh
alter table ww_players alter column user_id drop not null;
alter table ww_players add column if not exists guest_name text;
alter table ww_players add column if not exists guest_token text;
create unique index if not exists ww_players_guest_uni
  on ww_players (room_id, guest_token) where guest_token is not null;

-- 2) MỞ QUYỀN ĐỌC cho khách (vai anon) — xem lobby + nhận realtime.
--    Cột role KHÔNG grant nên khách không soi được vai người khác.
drop policy if exists "wwp_select" on ww_players;
drop policy if exists "wwr_select" on ww_rooms;
create policy "wwp_select" on ww_players for select using (true);
create policy "wwr_select" on ww_rooms  for select using (true);
grant select (id, room_id, user_id, ready, acked, joined_at, guest_name) on ww_players to anon;
grant select on ww_rooms to anon;

-- 3) Phòng đang mở theo mã (helper nội bộ)
create or replace function ww_guest_room(p_code text)
returns ww_rooms language sql security definer set search_path = public as $$
  select * from ww_rooms where code = p_code and status <> 'ENDED'
  order by created_at desc limit 1;
$$;

-- 4) KHÁCH VÀO PHÒNG
create or replace function ww_guest_join(p_code text, p_token text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms; v_seat ww_players; v_cnt int; v_id uuid;
begin
  if coalesce(p_token,'') = '' then return jsonb_build_object('error','Thiếu mã khách'); end if;
  v_room := ww_guest_room(p_code);
  if v_room.id is null then return jsonb_build_object('error','Mã phòng không tồn tại hoặc đã kết thúc'); end if;
  select * into v_seat from ww_players where room_id = v_room.id and guest_token = p_token;
  if v_seat.id is not null then
    return jsonb_build_object('ok', true, 'room_id', v_room.id, 'player_id', v_seat.id, 'rejoined', true);
  end if;
  if v_room.status <> 'LOBBY' then return jsonb_build_object('error','Ván đã bắt đầu — chờ ván sau nhé'); end if;
  select count(*) into v_cnt from ww_players where room_id = v_room.id;
  if v_cnt >= 20 then return jsonb_build_object('error','Phòng đã đầy (tối đa 20 người)'); end if;
  insert into ww_players (room_id, user_id, guest_token, guest_name, ready)
    values (v_room.id, null, p_token, coalesce(nullif(trim(p_name), ''), 'Khách'), false)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'room_id', v_room.id, 'player_id', v_id);
end $$;

-- 5) KHÁCH SẴN SÀNG / HUỶ
create or replace function ww_guest_ready(p_code text, p_token text, p_ready boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms;
begin
  v_room := ww_guest_room(p_code);
  if v_room.id is null then return jsonb_build_object('error','Phòng không tồn tại'); end if;
  update ww_players set ready = coalesce(p_ready, false)
    where room_id = v_room.id and guest_token = p_token;
  if not found then return jsonb_build_object('error','Bạn chưa ở trong phòng này'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 6) KHÁCH XEM VAI CỦA CHÍNH MÌNH
create or replace function ww_guest_my_role(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms; v_seat ww_players;
begin
  v_room := ww_guest_room(p_code);
  if v_room.id is null then return jsonb_build_object('error','Phòng không tồn tại'); end if;
  select * into v_seat from ww_players where room_id = v_room.id and guest_token = p_token;
  if v_seat.id is null then return jsonb_build_object('error','Bạn chưa ở trong phòng này'); end if;
  return jsonb_build_object('ok', true, 'player_id', v_seat.id,
    'role', case when v_room.status = 'LOBBY' then null else v_seat.role end);
end $$;

-- 7) KHÁCH XÁC NHẬN ĐÃ NHẬN VAI — đủ người -> HANDOFF
create or replace function ww_guest_ack(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms;
begin
  v_room := ww_guest_room(p_code);
  if v_room.id is null then return jsonb_build_object('error','Phòng không tồn tại'); end if;
  update ww_players set acked = true where room_id = v_room.id and guest_token = p_token;
  if not found then return jsonb_build_object('error','Bạn chưa ở trong phòng này'); end if;
  if not exists (select 1 from ww_players where room_id = v_room.id and acked = false) then
    update ww_rooms set status = 'HANDOFF' where id = v_room.id and status = 'REVEAL';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 8) KHÁCH RỜI PHÒNG
create or replace function ww_guest_leave(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room ww_rooms;
begin
  v_room := ww_guest_room(p_code);
  if v_room.id is null then return jsonb_build_object('ok', true); end if;
  delete from ww_players where room_id = v_room.id and guest_token = p_token;
  return jsonb_build_object('ok', true);
end $$;

-- 9) Cho phép KHÁCH (anon) gọi các RPC trên
grant execute on function ww_guest_join(text, text, text)  to anon, authenticated;
grant execute on function ww_guest_ready(text, text, boolean) to anon, authenticated;
grant execute on function ww_guest_my_role(text, text)     to anon, authenticated;
grant execute on function ww_guest_ack(text, text)         to anon, authenticated;
grant execute on function ww_guest_leave(text, text)       to anon, authenticated;

-- Kiểm tra
select 'guest RPCs' as item, count(*)::text as val
from information_schema.routines where routine_name like 'ww_guest\_%';
