-- ============================================================
-- MA SÓI — CHO PHÉP KHÁCH VÃNG LAI (guest) tham gia bằng QR/link,
-- KHÔNG cần tài khoản Dr Tuấn Hùng. Chạy SAU supabase/werewolf.sql.
--
-- An toàn: guest KHÔNG có phiên đăng nhập, KHÔNG chạm được bảng CRM nào.
-- Mọi thao tác ghi của guest đi qua Edge Function ww-guest (service role),
-- xác thực bằng mã phòng + guest_token. Ở đây chỉ mở QUYỀN ĐỌC (lobby +
-- realtime) cho vai anon, và KHÓA chặt cột role như cũ.
-- ============================================================

-- 1) Người chơi có thể là KHÁCH (user_id NULL) — thêm tên + token định danh
alter table ww_players alter column user_id drop not null;
alter table ww_players add column if not exists guest_name text;
alter table ww_players add column if not exists guest_token text;
-- Mỗi khách 1 ghế/phòng (không cho join trùng bằng cùng 1 token)
create unique index if not exists ww_players_guest_uni
  on ww_players (room_id, guest_token) where guest_token is not null;

-- 2) MỞ QUYỀN ĐỌC cho khách (vai anon) — để xem lobby + nhận realtime.
--    Cột role vẫn BỊ KHÓA (không grant) nên khách không soi được vai người khác.
drop policy if exists "wwp_select" on ww_players;
drop policy if exists "wwr_select" on ww_rooms;
create policy "wwp_select" on ww_players for select using (true);   -- ai cũng đọc được (trừ cột role đã revoke)
create policy "wwr_select" on ww_rooms  for select using (true);

grant select (id, room_id, user_id, ready, acked, joined_at, guest_name) on ww_players to anon;
grant select on ww_rooms to anon;

-- (Không cấp INSERT/UPDATE/DELETE cho anon — mọi thay đổi qua Edge Function ww-guest.)

-- 3) Kiểm tra
select 'user_id nullable' as item,
       (select is_nullable from information_schema.columns
        where table_name='ww_players' and column_name='user_id') as val
union all
select 'guest cols', (select count(*)::text from information_schema.columns
        where table_name='ww_players' and column_name in ('guest_name','guest_token'));
