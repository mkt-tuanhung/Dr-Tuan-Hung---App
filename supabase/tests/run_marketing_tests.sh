#!/usr/bin/env bash
# Chạy test SQL Marketing Workspace trên PostgreSQL CỤC BỘ (không phải Supabase production).
# Dùng: PGHOST=localhost PGPORT=54329 PGUSER=postgres bash supabase/tests/run_marketing_tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${MW_TEST_DB:-mw_test_$$}
P="psql -X -q -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
trap '$P -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
$P -d "$DB" -f tests/supabase_stub.sql >/dev/null 2>&1
$P -d "$DB" -f marketing_workspace_v1.sql >/dev/null 2>&1
$P -d "$DB" -f marketing_workspace_v1.sql >/dev/null 2>&1   # chạy lại lần 2: phải an toàn
$P -t -d "$DB" -f tests/marketing_workspace_v1.test.sql 2>&1 | sed -n 's/^.*NOTICE:  //p; s/^.*ERROR:  /ERROR: /p; /ALL MARKETING/p'
# Gỡ bỏ (rollback) phải chạy sạch, sau đó cài lại được
$P -d "$DB" -f marketing_workspace_v1_rollback.sql >/dev/null 2>&1 || { echo "FAIL rollback"; exit 1; }
left=$($P -t -d "$DB" -c "select count(*) from pg_tables where schemaname='public' and tablename like 'mw\_%'")
[ "$(echo $left)" = "0" ] && echo "PASS T25 rollback xoá sạch bảng mw_*" || { echo "FAIL T25 rollback còn $left bảng"; exit 1; }
$P -d "$DB" -f marketing_workspace_v1.sql >/dev/null 2>&1 && echo "PASS T25 cài lại sau rollback"
