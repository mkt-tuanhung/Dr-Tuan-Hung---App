#!/usr/bin/env bash
# ============================================================
# DEMO CLONE — Cách A: clone project thật -> project DEMO rồi ẩn danh
# ------------------------------------------------------------
# Chạy 1 lệnh, tự làm: dump cấu trúc + dữ liệu từ project THẬT,
# nạp sang project DEMO, rồi chạy ẩn danh mọi data khách.
#
# YÊU CẦU:
#   - Đã cài postgres client (pg_dump, psql). macOS: brew install libpq
#   - Đã tạo sẵn project Supabase DEMO (trống).
#
# CÁCH DÙNG:
#   export PROD_URI='postgresql://postgres:...@db.xxx.supabase.co:5432/postgres'   # project THẬT
#   export DEMO_URI='postgresql://postgres:...@db.yyy.supabase.co:5432/postgres'   # project DEMO
#   bash supabase/demo_clone.sh
#
# Lấy chuỗi kết nối: Supabase → Project Settings → Database → Connection string → URI
# ⚠️ KHÔNG chạy nhầm: DEMO_URI phải là project demo. Script chỉ GHI vào DEMO_URI.
# ============================================================
set -euo pipefail

: "${PROD_URI:?Thiếu PROD_URI (chuỗi kết nối project THẬT)}"
: "${DEMO_URI:?Thiếu DEMO_URI (chuỗi kết nối project DEMO)}"

HERE="$(cd "$(dirname "$0")" && pwd)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "==> [1/5] Dump CẤU TRÚC (schema) từ project thật..."
pg_dump "$PROD_URI" --schema=public --schema-only --no-owner --no-privileges -f "$TMPDIR/schema.sql"

echo "==> [2/5] Nạp cấu trúc vào project DEMO... (bỏ qua vài cảnh báo 'already exists' của Supabase là bình thường)"
psql "$DEMO_URI" -v ON_ERROR_STOP=0 -f "$TMPDIR/schema.sql" >/dev/null

echo "==> [3/5] Gỡ ràng buộc khoá ngoại profiles→auth.users trên DEMO (để nạp dữ liệu nhân sự mà không cần copy tài khoản đăng nhập)..."
psql "$DEMO_URI" -c "ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;"

echo "==> [4/5] Dump + nạp DỮ LIỆU..."
pg_dump "$PROD_URI" --schema=public --data-only --no-owner --no-privileges -f "$TMPDIR/data.sql"
psql "$DEMO_URI" -v ON_ERROR_STOP=0 -f "$TMPDIR/data.sql" >/dev/null

echo "==> [5/5] ẨN DANH mọi dữ liệu khách trên DEMO..."
psql "$DEMO_URI" -v ON_ERROR_STOP=1 -f "$HERE/demo_anonymize.sql"

echo ""
echo "✅ XONG phần dữ liệu. Kiểm tra nhanh (phải là tên/SĐT GIẢ):"
psql "$DEMO_URI" -c "select customer_name, phone from customer_appointments limit 5;" || true
echo ""
echo "👉 CÒN LẠI (làm tay trên dashboard DEMO — xem DEMO_SETUP.md):"
echo "   1) Authentication → Add user: admin@demo.local + mật khẩu → copy User UID"
echo "   2) SQL Editor: insert profile admin cho UID đó (câu lệnh có trong DEMO_SETUP.md mục 4)"
echo "   3) Deploy 1 bản web trỏ VITE_SUPABASE_URL/ANON_KEY vào project DEMO"
echo "   4) Authentication → tắt 'Enable sign ups'"
