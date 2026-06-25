-- ============================================================
-- Thông báo khi nhân sự THÊM GHI CHÚ chăm sóc khách → báo admin
-- post_op_notes: điều dưỡng (Hậu phẫu/CSKH) | care_notes: telesale/sale (Cọc/Bong)
-- ============================================================
-- (Cần đã chạy notify_activity.sql để có hàm notify_relevant)

create or replace function notify_care_note() returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid; aname text; lnk text;
begin
  actor := auth.uid();
  select full_name into aname from profiles where id = actor;

  -- Ghi chú Hậu phẫu / CSKH (điều dưỡng)
  if NEW.post_op_notes is distinct from OLD.post_op_notes
     and length(coalesce(NEW.post_op_notes, '')) > length(coalesce(OLD.post_op_notes, '')) then
    perform notify_relevant(actor, 'care_note',
      coalesce(aname, 'Nhân sự') || ' đã thêm ghi chú chăm sóc: ' || coalesce(NEW.customer_name, ''),
      'Hậu phẫu / CSKH', 'hau_phau', array[]::text[]);
  end if;

  -- Ghi chú telesale/sale (Khách cọc / bong)
  if NEW.care_notes is distinct from OLD.care_notes
     and length(coalesce(NEW.care_notes, '')) > length(coalesce(OLD.care_notes, '')) then
    lnk := case NEW.status when 'coc' then 'deposit_management' else null end;
    perform notify_relevant(actor, 'care_note',
      coalesce(aname, 'Nhân sự') || ' đã thêm ghi chú CSKH: ' || coalesce(NEW.customer_name, ''),
      'Chăm sóc khách (Cọc / Bong)', lnk, array[]::text[]);
  end if;

  return NEW;
end $$;
drop trigger if exists trg_notify_care_note on customer_appointments;
create trigger trg_notify_care_note after update on customer_appointments for each row execute function notify_care_note();
