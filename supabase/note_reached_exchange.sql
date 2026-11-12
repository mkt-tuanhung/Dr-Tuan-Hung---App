-- ============================================================
-- (12/11/2026) Tách 2 khái niệm theo cách anh dùng trên GetFly:
--  • NOTE của telesale / sale (cuộc gọi, ghi chú khách)  -> ghi vào "Thông tin đã tiếp cận" (reached_info), mới nhất ở trên
--  • TRAO ĐỔI NỘI BỘ giữa nhân viên / bộ phận (tag @nhau) -> marketing_activities.type = 'exchange'
--    -> cột "Trao đổi gần nhất"; người được tag nhận thông báo trong app.
--    Trao đổi nội bộ KHÔNG tính là liên hệ khách, không vào nhóm Telegram Data khách.
-- Idempotent.
-- ============================================================

-- 1 dòng note -> chuỗi "12/11 Nghe máy — nội dung (Xuân)"
create or replace function public.md_note_line(a public.marketing_activities) returns text
language plpgsql stable security definer set search_path = public as $q$
declare who text; oc text; c text; d text;
begin
  select split_part(trim(full_name), ' ', array_length(regexp_split_to_array(trim(full_name), '\s+'), 1)) into who from profiles where id = a.created_by;
  oc := case a.outcome when 'nghe_may' then 'Nghe máy' when 'khong_nghe' then 'Không nghe máy' when 'may_ban' then 'Máy bận'
          when 'hen_goi_lai' then 'Hẹn gọi lại' when 'can_nhac' then 'Đang cân nhắc' when 'tu_choi' then 'Từ chối'
          when 'sai_so' then 'Sai số / không liên lạc' else null end;
  c := nullif(trim(coalesce(a.content, '')), '');
  d := substring(coalesce(c, '') from '^(\d{1,2}/\d{1,2}(?:/\d{2,4})?)');   -- nhân viên tự gõ ngày đầu note -> dùng ngày đó
  if d is not null then c := nullif(trim(regexp_replace(c, '^\d{1,2}/\d{1,2}(/\d{2,4})?[\s:.,-]*', '')), '');
  else d := to_char(a.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM'); end if;
  if a.type = 'call' then c := concat_ws(' — ', coalesce(oc, 'Gọi'), c); end if;
  if c is null then return null; end if;
  return d || ' ' || c || coalesce(' (' || who || ')', '');
end $q$;

create or replace function public.md_note_to_reached() returns trigger
language plpgsql security definer set search_path = public as $q$
declare ln text;
begin
  if new.type not in ('call', 'care') or new.created_by is null or new.data_id is null then return new; end if;
  if coalesce(new.content, '') ~* '^Trực page bổ sung thông tin' then return new; end if;   -- đã tự gộp vào reached_info
  ln := md_note_line(new);
  if ln is null then return new; end if;
  update marketing_data
     set reached_info = case when coalesce(trim(reached_info), '') = '' then ln
                             when position(trim(coalesce(new.content, '')) in reached_info) > 0 and length(trim(coalesce(new.content, ''))) > 15 then reached_info
                             else ln || E'\n' || reached_info end
   where id = new.data_id;
  return new;
exception when others then return new;
end $q$;
drop trigger if exists trg_md_note_to_reached on public.marketing_activities;
create trigger trg_md_note_to_reached after insert on public.marketing_activities
  for each row execute function public.md_note_to_reached();

-- Trao đổi nội bộ không phải là liên hệ khách
create or replace function public.touch_last_contact() returns trigger
language plpgsql security definer set search_path = public as $q$
begin
  if new.data_id is not null and new.created_by is not null and coalesce(new.type, '') <> 'exchange' then
    update marketing_data set
      last_contact_at = greatest(coalesce(last_contact_at, new.created_at), new.created_at),
      first_contact_at = coalesce(first_contact_at, new.created_at)
    where id = new.data_id;
  end if;
  return new;
exception when others then return new;
end $q$;

-- Không đẩy trao đổi nội bộ vào nhóm Telegram Data khách hàng
create or replace function public.notify_data_khach_telegram() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  if TG_TABLE_NAME = 'marketing_activities' and coalesce(NEW.type, '') = 'exchange' then return NEW; end if;
  perform net.http_post(
    url     := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsYmx5d2pkZ2hqd3d1dW16ZWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTQyNDgsImV4cCI6MjA5NzA3MDI0OH0.Xx8LayixxWhoKPZlX61Osh5d4nD2-K_x0P-4bSlGcAU'),
    body    := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id)
  );
  return NEW;
exception when others then
  return NEW;
end $function$;

-- Tag @nhân viên trong trao đổi nội bộ -> thông báo trong app (bấm mở thẳng hồ sơ khách)
create or replace function public.notify_md_exchange_mention() returns trigger
language plpgsql security definer set search_path = public as $q$
declare aname text; kname text; sid uuid;
begin
  if coalesce(new.type, '') <> 'exchange' or new.content is null then return new; end if;
  select full_name into aname from profiles where id = new.created_by;
  select coalesce(customer_name, phone) into kname from marketing_data where id = new.data_id;
  for sid in select distinct (regexp_matches(new.content, '@\[[^\]]+\]\(staff:([0-9a-fA-F-]+)\)', 'g'))[1]::uuid loop
    if sid is distinct from new.created_by then
      insert into notifications(user_id, actor_id, type, title, body, link)
      values (sid, new.created_by, 'mention',
        coalesce(aname, 'Đồng nghiệp') || ' nhắc bạn về khách ' || coalesce(kname, ''),
        left(regexp_replace(new.content, '@\[([^\]]+)\]\((staff|cust):[0-9a-fA-F-]+\)', '@\1', 'g'), 160),
        'data_kh#kh:' || new.data_id);
    end if;
  end loop;
  return new;
exception when others then return new;
end $q$;
drop trigger if exists trg_md_exchange_mention on public.marketing_activities;
create trigger trg_md_exchange_mention after insert on public.marketing_activities
  for each row execute function public.notify_md_exchange_mention();

-- Trao đổi nội bộ: mọi bộ phận (sale offline, CSKH, điều dưỡng, bác sĩ…) đều được nhắn / tag nhau trên hồ sơ khách
drop policy if exists "mact_insert_exchange" on public.marketing_activities;
create policy "mact_insert_exchange" on public.marketing_activities for insert
  with check (created_by = auth.uid() and type = 'exchange');
drop policy if exists "mact_select" on public.marketing_activities;
create policy "mact_select" on public.marketing_activities for select using (
  public.current_user_role()::text in ('marketing','truc_page','media','telesale','admin','accountant','shareholder','sale_offline','cskh')
  or created_by = auth.uid()
);

-- Sao lưu trước khi bù (đã chạy 12/11): marketing_data_reached_bak_20261112
-- Bù: các note đã ghi trên app (cuộc gọi / ghi chú) chưa có trong "Thông tin đã tiếp cận"
do $b$
declare r public.marketing_activities; ln text;
begin
  for r in select a.* from marketing_activities a
           where a.type in ('call', 'care') and a.created_by is not null and a.data_id is not null
             and coalesce(a.content, '') !~* '^Trực page bổ sung thông tin'
           order by a.created_at asc loop
    ln := md_note_line(r);
    continue when ln is null;
    update marketing_data
       set reached_info = case when coalesce(trim(reached_info), '') = '' then ln else ln || E'\n' || reached_info end
     where id = r.data_id
       and not (length(trim(coalesce(r.content, ''))) > 15 and position(trim(r.content) in coalesce(reached_info, '')) > 0)
       and position(ln in coalesce(reached_info, '')) = 0;
  end loop;
end $b$;

notify pgrst, 'reload schema';
