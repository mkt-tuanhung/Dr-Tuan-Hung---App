-- LIÊN HỆ LẦN CUỐI (11/2026)
-- 1) Điền last_contact_at cho khách cũ = lần ghi chú GetFly / nhật ký app gần nhất (bỏ ghi chú "Tạo mới khách hàng").
-- 2) Trigger: mỗi cuộc gọi / ghi chú của nhân viên (marketing_activities có created_by) cập nhật last_contact_at.
with g as (
  select data_id, max(created_at) t from getfly_comments
  where data_id is not null and coalesce(content,'') not ilike 'Tạo mới khách hàng%' and coalesce(title,'') not ilike 'Tạo mới khách hàng%'
  group by data_id
), a as (
  select data_id, max(created_at) t from marketing_activities where data_id is not null group by data_id
)
update marketing_data m set last_contact_at = greatest(m.last_contact_at, g.t, a.t)
from marketing_data m2 left join g on g.data_id = m2.id left join a on a.data_id = m2.id
where m.id = m2.id and greatest(g.t, a.t) is not null and (m.last_contact_at is null or greatest(g.t, a.t) > m.last_contact_at);

create or replace function public.touch_last_contact() returns trigger
language plpgsql security definer set search_path = public as $q$
begin
  if new.data_id is not null and new.created_by is not null then   -- bỏ qua ghi chú tự động của hệ thống
    update marketing_data set last_contact_at = greatest(coalesce(last_contact_at, new.created_at), new.created_at)
    where id = new.data_id and (last_contact_at is null or last_contact_at < new.created_at);
  end if;
  return new;
exception when others then return new;
end $q$;
drop trigger if exists trg_touch_last_contact on public.marketing_activities;
create trigger trg_touch_last_contact after insert on public.marketing_activities for each row execute function public.touch_last_contact();
