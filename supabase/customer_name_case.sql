-- ============================================================
-- TÊN KHÁCH: VIẾT HOA CHỮ CÁI ĐẦU MỖI CHỮ (2026-11-17)
--   "Vũ minh Dũng" → "Vũ Minh Dũng", "nguyễn linh giang" → "Nguyễn Linh Giang"
-- Chạy 1 lần trên Supabase (SQL Editor). An toàn chạy lại.
--
-- 1) Hàm public.vn_name_case(text) — GIỐNG HỆT apps/web/src/lib/nameCase.js
--    và formatPersonName trong supabase/functions/getfly-sync/index.ts.
--    Giữ nguyên: cụm có số / "_" / "@" (tên TikTok/IG, SĐT, ngày), emoji,
--    chữ viết tắt (KH, ADS, FB, VIP, DS…). Gộp khoảng trắng thừa.
-- 2) Trigger BEFORE INSERT/UPDATE trên mọi bảng có tên khách → ai nhập kiểu gì
--    (app, GetFly, Messenger, landing page…) khi lưu cũng tự thành đúng chuẩn.
-- 3) Sửa toàn bộ tên cũ. Tên gốc được sao lưu vào bảng backup_ten_khach.
--    Lúc sửa hàng loạt TẮT trigger (session_replication_role = replica) để
--    không bắn webhook/Telegram, không ghi nhật ký, không đổi updated_at.
--
-- Hoàn tác (nếu cần) cho 1 bảng, ví dụ marketing_data:
--   set session_replication_role = replica;
--   update marketing_data t set customer_name = b.ten_cu from backup_ten_khach b
--    where b.bang = 'marketing_data' and b.id = t.id::text;
--   set session_replication_role = origin;
-- ============================================================

-- ---------- 1) Hàm chuẩn hoá ----------
create or replace function public.vn_name_case(p text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  tok   text;
  outp  text;
  run   text;
  m     text[];
  res   text[] := '{}';
  acr   text[] := array['KH','ADS','FB','VIP','DS','CTV','KOL','KOC','MC','BS','SĐT','TT','ID','IG','TK','TEST'];
begin
  if p is null then return null; end if;
  p := btrim(regexp_replace(normalize(p, NFC), '\s+', ' ', 'g'));
  if p = '' then return p; end if;
  foreach tok in array string_to_array(p, ' ') loop
    if tok ~ '[0-9_@]' then
      res := res || tok;
      continue;
    end if;
    outp := '';
    for m in select regexp_matches(tok, '([[:alpha:]]+|[^[:alpha:]]+)', 'g') loop
      run := m[1];
      if run ~ '^[[:alpha:]]+$' then
        if upper(run) = any(acr) then
          run := upper(run);
        else
          run := upper(left(run, 1)) || lower(substr(run, 2));
        end if;
      end if;
      outp := outp || run;
    end loop;
    res := res || outp;
  end loop;
  return array_to_string(res, ' ');
end;
$$;

grant execute on function public.vn_name_case(text) to anon, authenticated;

-- ---------- 2) Trigger tự sửa khi lưu ----------
-- TG_ARGV[0] = tên cột chứa tên khách
create or replace function public.trg_vn_name_case()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  col text := TG_ARGV[0];
  v   text := to_jsonb(new) ->> col;
  nv  text := public.vn_name_case(v);
begin
  if nv is distinct from v then
    new := jsonb_populate_record(new, jsonb_build_object(col, nv));
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in select * from (values
      ('marketing_data',             'customer_name'),
      ('customer_appointments',      'customer_name'),
      ('media_customers',            'customer_name'),
      ('partner_surgeries',          'customer_name'),
      ('service_review_invitations', 'customer_name'),
      ('service_review_tickets',     'customer_name'),
      ('surgical_assignments',       'customer_name'),
      ('landing_leads',              'name')
    ) as t(bang, cot)
  loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = r.bang and column_name = r.cot) then
      -- Tên trigger bắt đầu bằng "aa_" để chạy TRƯỚC các trigger BEFORE khác (Postgres chạy theo ABC)
      execute format('drop trigger if exists aa_name_case on public.%I', r.bang);
      execute format('create trigger aa_name_case before insert or update of %I on public.%I
                        for each row execute function public.trg_vn_name_case(%L)', r.cot, r.bang, r.cot);
    end if;
  end loop;
end;
$$;

-- ---------- 3) Sao lưu tên gốc + sửa toàn bộ tên cũ ----------
create table if not exists public.backup_ten_khach (
  bang     text not null,
  id       text not null,
  ten_cu   text,
  ten_moi  text,
  luc      timestamptz not null default now(),
  primary key (bang, id)
);
alter table public.backup_ten_khach enable row level security;  -- không lộ qua API (không có policy)

begin;
set local session_replication_role = replica;  -- tắt webhook/Telegram/nhật ký/updated_at trong lần sửa này

do $$
declare
  r record;
  n int;
begin
  for r in select * from (values
      ('marketing_data',             'customer_name'),
      ('customer_appointments',      'customer_name'),
      ('media_customers',            'customer_name'),
      ('partner_surgeries',          'customer_name'),
      ('service_review_invitations', 'customer_name'),
      ('service_review_tickets',     'customer_name'),
      ('surgical_assignments',       'customer_name'),
      ('landing_leads',              'name')
    ) as t(bang, cot)
  loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = r.bang and column_name = r.cot) then
      execute format(
        'insert into public.backup_ten_khach (bang, id, ten_cu, ten_moi)
           select %L, id::text, %I, public.vn_name_case(%I) from public.%I
            where %I is distinct from public.vn_name_case(%I)
         on conflict (bang, id) do nothing',
        r.bang, r.cot, r.cot, r.bang, r.cot, r.cot);
      execute format(
        'update public.%I set %I = public.vn_name_case(%I)
          where %I is distinct from public.vn_name_case(%I)',
        r.bang, r.cot, r.cot, r.cot, r.cot);
      get diagnostics n = row_count;
      raise notice '% : sửa % tên', r.bang, n;
    end if;
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
