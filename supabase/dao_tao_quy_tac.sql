-- ============================================================
-- QUY TẮC ĐÀO TẠO — chống tua video / lật trang qua loa + đếm số lần xem (chạy lại vẫn an toàn)
-- Chạy SAU: so_tay_cskh.sql, so_tay_chuyen_mon.sql, tai_lieu.sql
--
-- 1. Lần xem ĐẦU (chưa xem xong) một video Sổ Tay: không được tua vượt quá đoạn đã xem, không được
--    tăng tốc độ. Cố tình tua / tăng tốc -> app hiện cảnh báo, trả video về chỗ cũ và ghi 1 dòng
--    vào training_violations (kèm chi tiết: tua từ đâu tới đâu, lúc nào, máy gì).
-- 2. Tài liệu: lật nhanh nhiều trang liên tiếp -> cảnh báo + ghi training_violations;
--    trang lướt qua dưới 5 giây không được tính là đã đọc.
-- 3. Đếm số lần xem mỗi video (views) — mỗi lần bấm phát / xem lại = +1 (hàm bump_handbook_view).
--
-- training_violations: nhân viên ghi dòng của mình; nhân viên xem của mình;
--                      Admin + Kế toán + Cổ đông xem tất cả. Không ai sửa / xoá được (giữ bằng chứng).
-- ============================================================

alter table public.cskh_handbook_progress add column if not exists views int not null default 0;
alter table public.pro_handbook_progress  add column if not exists views int not null default 0;

create table if not exists public.training_violations (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  module      text not null check (module in ('cskh', 'pro', 'library')),
  ref         text not null,                 -- số tập / bài (video) hoặc id tài liệu
  kind        text not null check (kind in ('seek', 'speed', 'fast_flip')),
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists training_violations_user_idx on public.training_violations (module, user_id, created_at desc);

alter table public.training_violations enable row level security;

drop policy if exists training_violations_insert on public.training_violations;
create policy training_violations_insert on public.training_violations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists training_violations_read on public.training_violations;
create policy training_violations_read on public.training_violations
  for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid()
         and (p.role::text in ('admin', 'accountant', 'shareholder') or p.role_2::text in ('admin', 'accountant', 'shareholder'))));

grant select, insert on public.training_violations to authenticated;
grant usage, select on sequence public.training_violations_id_seq to authenticated;

-- +1 lần xem cho video của chính mình; trả về tổng số lần xem
create or replace function public.bump_handbook_view(p_book text, p_episode int)
returns int
language plpgsql
set search_path = public
as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_book = 'cskh' then
    insert into cskh_handbook_progress as r (user_id, episode, views) values (auth.uid(), p_episode, 1)
    on conflict (user_id, episode) do update set views = r.views + 1, updated_at = now()
    returning r.views into n;
  elsif p_book = 'pro' then
    insert into pro_handbook_progress as r (user_id, episode, views) values (auth.uid(), p_episode, 1)
    on conflict (user_id, episode) do update set views = r.views + 1, updated_at = now()
    returning r.views into n;
  else
    raise exception 'Sổ tay không hợp lệ: %', p_book;
  end if;
  return n;
end
$$;
revoke all on function public.bump_handbook_view(text, int) from public;
grant execute on function public.bump_handbook_view(text, int) to authenticated;

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select p.full_name, v.module, v.ref, v.kind, v.detail, v.created_at
--   from public.training_violations v join public.profiles p on p.id = v.user_id order by v.created_at desc limit 50;
