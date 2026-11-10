-- ============================================================
-- THÔI DÙNG GETFLY (11/2026): lưu BẢN GỐC từng khách GetFly + mã người phụ trách.
-- getfly-sync {force:true} ghi đầy đủ vào getfly_raw trước khi gói GetFly hết hạn.
-- Idempotent.
-- ============================================================
alter table marketing_data
  add column if not exists getfly_raw jsonb,          -- toàn bộ bản ghi khách bên GetFly (nguyên gốc)
  add column if not exists getfly_manager_id text;    -- mã người phụ trách GetFly (1, 3, 11, 12…)

notify pgrst, 'reload schema';
