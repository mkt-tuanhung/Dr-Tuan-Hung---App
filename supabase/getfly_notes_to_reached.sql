-- (12/11/2026, ĐÃ CHẠY) Note của sale trên GetFly (getfly_comments + "liên hệ lần cuối" trong last_exchange)
-- chuyển hết vào "Thông tin đã tiếp cận" (reached_info), sắp theo thời gian mới nhất ở trên, bỏ trùng,
-- bỏ nhãn "thong_tin_da_tiep_can:". Sao lưu: marketing_data_reached_bak_20261112b (id, reached_info, last_exchange).
-- Cột "Trao đổi gần nhất" từ nay chỉ hiện trao đổi nội bộ (marketing_activities.type = 'exchange').
-- Hàm phụ: md_short_name(text), md_split_note(body, ts, who) — xem nội dung đã chạy trong lịch sử phiên.
create or replace function public.md_short_name(n text) returns text language sql immutable as $f$
  select nullif((regexp_split_to_array(trim(coalesce(n,'')), '\s+'))[array_length(regexp_split_to_array(trim(coalesce(n,'')), '\s+'), 1)], '')
$f$;
create or replace function public.md_split_note(body text, ts timestamptz, who text) returns text language plpgsql immutable as $f$
declare b text := trim(regexp_replace(coalesce(body, ''), '\s+', ' ', 'g')); dd text;
begin
  if length(b) < 2 then return null; end if;
  dd := substring(b from '^(\d{1,2}/\d{1,2}(?:/\d{2,4})?)');
  if dd is not null then b := trim(regexp_replace(b, '^\d{1,2}/\d{1,2}(/\d{2,4})?[\s:.,-]*', ''));
  else dd := to_char(ts at time zone 'Asia/Ho_Chi_Minh', 'DD/MM'); end if;
  if b = '' then return null; end if;
  return dd || ' ' || b || coalesce(' (' || who || ')', '');
end $f$;
