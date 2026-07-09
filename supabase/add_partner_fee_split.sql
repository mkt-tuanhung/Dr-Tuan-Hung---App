-- ============================================================
-- MỔ ĐỐI TÁC — tách tiền PHẪU THUẬT và tiền VẬT TƯ
-- ------------------------------------------------------------
--   surgery_fee  : tiền phẫu thuật (công BS = 50% của số này)
--   material_fee : tiền vật tư (KHÔNG tính vào công BS)
--   partner_fee  : giữ = tổng thu đối tác (surgery_fee + material_fee) → dùng cho dòng tiền / lãi lỗ
-- Backfill: coi số cũ là tiền phẫu thuật.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

alter table partner_surgeries add column if not exists surgery_fee bigint default 0;
alter table partner_surgeries add column if not exists material_fee bigint default 0;

-- Số liệu cũ: đưa toàn bộ partner_fee vào surgery_fee (chưa từng tách vật tư)
update partner_surgeries
   set surgery_fee = partner_fee
 where coalesce(surgery_fee, 0) = 0 and coalesce(partner_fee, 0) > 0;
