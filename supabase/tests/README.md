# Test Marketing Workspace

| Loại | Lệnh | Ghi chú |
|---|---|---|
| SQL (PostgreSQL thật) | `PGHOST=localhost PGPORT=54329 PGUSER=postgres bash supabase/tests/run_marketing_tests.sh` | Tạo DB tạm → `supabase_stub.sql` (Supabase tối thiểu) → migration 2 lần (idempotent) → `marketing_workspace_v1.test.sql` → rollback → cài lại |
| E2E (app thật) | xem `e2e/README.md` | Playwright + PostgREST + PostgreSQL |

KHÔNG chạy các file trong thư mục này vào Supabase production.
