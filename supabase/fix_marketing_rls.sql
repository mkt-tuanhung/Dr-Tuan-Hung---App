-- ============================================================
-- FIX RLS — Bảng Marketing Ads
-- Thay thế các policy "using(true)" (cho phép cả người CHƯA đăng nhập
-- đọc/ghi) bằng phân quyền theo vai trò.
--
--   XEM chi phí Ads : marketing, admin, accountant (kế toán), shareholder (cổ đông)
--   SỬA chi phí Ads : marketing, admin
--
-- Chạy file này trong Supabase SQL Editor.
-- ============================================================

-- 1. Xoá các policy cũ mở toang
DROP POLICY IF EXISTS "Cho phép tất cả đọc marketing_monthly_targets"  ON marketing_monthly_targets;
DROP POLICY IF EXISTS "Cho phép tất cả sửa marketing_monthly_targets"  ON marketing_monthly_targets;
DROP POLICY IF EXISTS "Cho phép tất cả đọc marketing_ads_performance"  ON marketing_ads_performance;
DROP POLICY IF EXISTS "Cho phép tất cả sửa marketing_ads_performance"  ON marketing_ads_performance;

-- Dọn trước nếu chạy lại file
DROP POLICY IF EXISTS "ads_targets_read"  ON marketing_monthly_targets;
DROP POLICY IF EXISTS "ads_targets_write" ON marketing_monthly_targets;
DROP POLICY IF EXISTS "ads_perf_read"     ON marketing_ads_performance;
DROP POLICY IF EXISTS "ads_perf_write"    ON marketing_ads_performance;

-- 2. marketing_monthly_targets
CREATE POLICY "ads_targets_read" ON marketing_monthly_targets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing', 'admin', 'accountant', 'shareholder'))
  );

CREATE POLICY "ads_targets_write" ON marketing_monthly_targets
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing', 'admin'))
  );

-- 3. marketing_ads_performance
CREATE POLICY "ads_perf_read" ON marketing_ads_performance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing', 'admin', 'accountant', 'shareholder'))
  );

CREATE POLICY "ads_perf_write" ON marketing_ads_performance
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.role IN ('marketing', 'admin'))
  );
