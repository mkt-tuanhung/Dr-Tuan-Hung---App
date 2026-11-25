-- ============================================================
-- HIỆU ỨNG ẢNH GỬI NHÓM CHẤM CÔNG (2026-11-25)
-- profiles.tg_photo_effect: khi nhân sự chấm công Face AI, bản ảnh GỬI VÀO NHÓM
-- TELEGRAM CHẤM CÔNG được AI chỉnh theo hiệu ứng này (ảnh gốc lưu chấm công giữ nguyên).
--   null    = không hiệu ứng (mặc định)
--   'horns' = thêm sừng
-- Đọc trong Edge Function face-attendance. Chạy 1 lần, an toàn chạy lại.
-- ============================================================
alter table public.profiles add column if not exists tg_photo_effect text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_tg_photo_effect_chk') then
    alter table public.profiles add constraint profiles_tg_photo_effect_chk
      check (tg_photo_effect is null or tg_photo_effect in ('horns'));
  end if;
end;
$$;

-- Bật "sừng" cho La Thị Huyền (Sale Offline) theo yêu cầu của Admin
update public.profiles set tg_photo_effect = 'horns'
 where id = '4e1a21d8-4a12-45ae-b347-35f890e76fed';

notify pgrst, 'reload schema';
