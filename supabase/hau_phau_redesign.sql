-- ============================================================
-- Hậu phẫu / CSKH — nâng cấp: hành trình hồi phục theo mốc, dấu hiệu cảnh
-- báo, lịch tái khám tiếp theo. Chạy 1 lần trên Supabase. An toàn chạy lại.
-- ============================================================

-- Mốc chăm sóc theo ngày: [{key,status,nurse_id,note,done_at}]
alter table customer_appointments add column if not exists care_milestones jsonb;
-- Dấu hiệu cần lưu ý đã tick: ["Sốt ≥ 38°C", ...]
alter table customer_appointments add column if not exists warning_signs   jsonb default '[]'::jsonb;
-- Lịch tái khám tiếp theo (ngày giờ)
alter table customer_appointments add column if not exists next_recheck_at timestamptz;

notify pgrst, 'reload schema';
