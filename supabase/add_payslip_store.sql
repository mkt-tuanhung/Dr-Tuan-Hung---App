-- ============================================================
-- LƯU PHIẾU LƯƠNG ĐÃ MÃ HOÁ Ở MÁY CHỦ — QR CHỈ CHỨA 1 ID NGẮN
-- ------------------------------------------------------------
-- Trước đây toàn bộ dữ liệu lương (đã mã hoá) nhồi vào trong QR => khi có
-- nhiều khách/chi tiết, QR quá dày (version 29-40) nên KHÔNG QUÉT ĐƯỢC.
-- Nay: blob mã hoá lưu ở bảng payslips, QR chỉ chứa id (uuid) => QR nhỏ,
-- luôn quét được. Máy chủ chỉ giữ BẢN MÃ HOÁ (không có mã bảo mật, không
-- giải mã được) — vẫn cần đúng mã của nhân sự + Admin duyệt mới xem.
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

create table if not exists payslips (
  id uuid default gen_random_uuid() primary key,
  slip_key text unique,          -- id nhân sự + kỳ (in lại cùng kỳ sẽ ghi đè, giữ 1 dòng)
  staff_name text,
  period text,
  token text not null,           -- chuỗi đã mã hoá AES-GCM (base64url)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table payslips enable row level security;
-- Không cấp policy trực tiếp: mọi thao tác qua RPC SECURITY DEFINER bên dưới.

-- ---------- Lưu / cập nhật phiếu (Admin in lương gọi) ----------
create or replace function save_payslip(p_key text, p_staff text, p_period text, p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into payslips(slip_key, staff_name, period, token)
  values (p_key, p_staff, p_period, p_token)
  on conflict (slip_key) do update
    set token = excluded.token, staff_name = excluded.staff_name,
        period = excluded.period, updated_at = now()
  returning id into new_id;
  return new_id;
end $$;
grant execute on function save_payslip(text, text, text, text) to authenticated;

-- ---------- Lấy blob mã hoá theo id (trang xem công khai, anon) ----------
-- Chỉ trả về BẢN MÃ HOÁ; không có mã bảo mật thì không đọc được nội dung.
create or replace function get_payslip(p_id uuid)
returns text language sql security definer set search_path = public as $$
  select token from payslips where id = p_id;
$$;
grant execute on function get_payslip(uuid) to anon, authenticated;
