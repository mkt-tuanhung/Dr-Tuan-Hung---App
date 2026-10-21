# E2E Marketing Workspace — app thật + PostgREST + PostgreSQL (cục bộ)

KHÔNG chạy vào Supabase production. Cần: PostgreSQL 16, PostgREST 12, Playwright + Chromium, `psql` trong PATH.

```bash
export PGHOST=localhost PGPORT=54329 PGUSER=postgres
psql -d postgres -c "create database mw_e2e"
psql -d mw_e2e -f supabase/tests/supabase_stub.sql
psql -d mw_e2e -f supabase/marketing_workspace_v1.sql
psql -d mw_e2e -c "insert into profiles (id, full_name, role) values
 ('00000000-0000-0000-0000-0000000000a1','Admin Hùng','admin'), ('00000000-0000-0000-0000-0000000000b1','Minh Dũng (MKT Lead)','marketing'),
 ('00000000-0000-0000-0000-0000000000c1','Thu Trang (Media)','media'), ('00000000-0000-0000-0000-0000000000d1','Ngọc Anh (Viewer)','telesale'),
 ('00000000-0000-0000-0000-0000000000e1','Hải (MKT ngoài)','marketing'), ('00000000-0000-0000-0000-0000000000f1','BS. Tuấn Hùng','bac_si'),
 ('00000000-0000-0000-0000-0000000000f2','Lan (Pháp lý)','cskh'), ('00000000-0000-0000-0000-0000000000f3','Quang (Người đăng)','marketing')"
postgrest supabase/tests/e2e/postgrest.conf &          # cổng 3011
cd apps/web && VITE_DESIGN_PREVIEW=1 VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo npx vite build --outDir /tmp/mw-demo \
  && npx vite preview --outDir /tmp/mw-demo --port 4174 &
cd supabase/tests/e2e && psql -d mw_e2e -f reset.sql && node part1.mjs && node part2.mjs && node part3.mjs
```

Biến môi trường tuỳ chọn: `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `MW_E2E_APP`, `MW_E2E_REST`, `MW_E2E_DB`, `MW_E2E_SHOTS`.
Mọi request `https://demo.supabase.co/rest/v1/*` của app được chuyển sang PostgREST kèm JWT của từng người dùng (RLS thật).
R2 (lưu tệp) không chạy cục bộ nên được giả lập ở tầng mạng (presign + PUT) — sha256 vẫn tính thật trong trình duyệt.
