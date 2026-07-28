-- Định nghĩa "Ads Win" theo chỉ số thị trường (1 dòng duy nhất id=1).
-- Chi win_budget đồng mà ra >= win_phones số điện thoại => đạt chuẩn Win.
create table if not exists ads_win_rule (
  id          int primary key default 1,
  win_budget  numeric not null default 0,   -- ngân sách đã chi tiêu (đồng)
  win_phones  int     not null default 0,   -- số điện thoại tương ứng
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz default now(),
  constraint ads_win_rule_singleton check (id = 1)
);
insert into ads_win_rule (id) values (1) on conflict (id) do nothing;

alter table ads_win_rule enable row level security;

drop policy if exists awr_read on ads_win_rule;
create policy awr_read on ads_win_rule for select to authenticated using (true);
drop policy if exists awr_write on ads_win_rule;
create policy awr_write on ads_win_rule for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text = any(array['marketing','admin']) or p.role_2::text = any(array['marketing','admin']))))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text = any(array['marketing','admin']) or p.role_2::text = any(array['marketing','admin']))));

grant select, insert, update on ads_win_rule to authenticated;
notify pgrst, 'reload schema';
