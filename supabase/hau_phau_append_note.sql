-- ============================================================
-- NỐI MỐC NHẬT KÝ AN TOÀN (Hậu phẫu / CSKH)
-- Trước đây app dựng lại TOÀN BỘ nhật ký ở client rồi ghi đè —
-- 2 lần lưu chồng nhau / dữ liệu cũ là MẤT mốc. Hàm này để database
-- tự NỐI THÊM mốc mới vào cuối nhật ký (atomic) -> không thể ghi đè.
-- SECURITY INVOKER: RLS vẫn áp dụng — ai không có quyền sửa ca đó
-- thì row_count = 0, app báo thiếu quyền.
-- Chạy trong Supabase SQL Editor. Idempotent.
-- ============================================================
create or replace function public.append_care_note(p_id uuid, p_kind text, p_note text)
returns int
language plpgsql
as $$
declare n int;
begin
  if p_note is null or p_note = '' then return 0; end if;
  if p_kind = 'cskh' then
    update customer_appointments set cskh_notes = coalesce(cskh_notes, '') || p_note where id = p_id;
  else
    update customer_appointments set post_op_notes = coalesce(post_op_notes, '') || p_note where id = p_id;
  end if;
  get diagnostics n = row_count;
  return n;
end
$$;

grant execute on function public.append_care_note(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
