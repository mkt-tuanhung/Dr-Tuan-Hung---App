-- ============================================================
-- Báo nhóm Telegram "DATA KHÁCH HÀNG": khách mới (marketing_data) + note/cuộc gọi mới (marketing_activities).
-- Trigger gửi {table, id} sang Edge Function data-khach-telegram (hàm tự đọc lại bản ghi bằng service role).
-- Thay <ANON_KEY> bằng anon public key (Project Settings -> API). Idempotent.
-- ============================================================
create extension if not exists pg_net;

create or replace function public.notify_data_khach_telegram() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://wlblywjdghjwwuumzecc.supabase.co/functions/v1/data-khach-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id)
  );
  return NEW;
exception when others then
  return NEW;   -- lỗi gửi thông báo không được chặn việc lưu dữ liệu
end $$;

drop trigger if exists trg_data_khach_tg on public.marketing_data;
create trigger trg_data_khach_tg after insert on public.marketing_data
  for each row execute function public.notify_data_khach_telegram();

drop trigger if exists trg_data_note_tg on public.marketing_activities;
create trigger trg_data_note_tg after insert on public.marketing_activities
  for each row execute function public.notify_data_khach_telegram();
