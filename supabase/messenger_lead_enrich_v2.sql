-- ============================================================
-- KHÁCH TỰ TẠO TỪ MESSENGER v2 (anh Dũng góp ý 11/11/2026: nhu cầu ghi số, tiếp cận linh tinh, không có dịch vụ)
--  • Nhu cầu: "Quan tâm: <dịch vụ>" + câu khách hỏi có nghĩa (bỏ tin chỉ có SĐT, "Tư vấn", "Bắt đầu", ảnh…)
--  • Nhóm dịch vụ (customer_group) tự nhận từ từ khoá: hàm mặt / mũi / mắt / ngực / body / da
--  • Thông tin đã tiếp cận: 1–2 dòng gọn (qua quảng cáo?, lúc, số tin, khách hỏi gì, page đã làm gì)
--  • Mặc định Telesale = Hoàng Thị Xuân, Trực page = Bảo Bei (công ty hiện 1 telesale + 1 trực page)
--  • Không ghi nhật ký riêng (tin KHÁCH MỚI ở nhóm Data khách hàng đã đủ thông tin)
-- ============================================================
create or replace function public.msg_meaningful(t text) returns boolean language sql immutable as $q$
  select t is not null
    and t !~* 'đã trả lời một quảng cáo'
    and length(regexp_replace(regexp_replace(t, '(\+?84|0)[0-9 .\-]{8,12}', '', 'g'), '[^[:alpha:]]', '', 'g')) >= 6
    and not (t ~ '(\+?84|0)[0-9 .\-]{8,12}' and length(regexp_replace(t, '[^[:alpha:]]', '', 'g')) < 18)   -- "0945… em gửi số ạ"
    and lower(trim(regexp_replace(t, '[[:punct:]]', '', 'g'))) not in ('tư vấn','tu van','bắt đầu','bat dau','ok','oke','vâng','dạ','có','hi','alo','chào','chào shop','em gửi ạ','số zalo em nhé ạ','em gửi số ạ')
$q$;

create or replace function public.messenger_lead_info(p_conv text) returns jsonb
language sql stable security definer set search_path = public as $q$
  with m as (
    select is_page, trim(text) t, created_time from fb_messages where conv_key = p_conv
  ), cust as (
    select left(regexp_replace(t, '(\+?84|0)[0-9 .\-]{8,12}', '[SĐT]', 'g'), 120) t, created_time from m
    where not is_page and public.msg_meaningful(t)
  ), tx as (
    select lower(coalesce((select string_agg(t, ' ') from m where not is_page and t is not null), '')) sc,
           lower(coalesce((select string_agg(t, ' ') from m where is_page and t is not null and t !~* 'quan tâm đến dịch vụ thẩm mỹ nào'), '')) sp
  )
  select jsonb_build_object(
    'first', (select min(created_time) from m),
    'n', (select count(*) from m),
    'ad', exists(select 1 from m where t ~* 'đã trả lời một quảng cáo'),
    'asked', (select string_agg(t, ' | ' order by created_time) from (select t, created_time from cust order by created_time limit 3) a),
    'photo', exists(select 1 from fb_messages where conv_key = p_conv and not is_page and attachments is not null),
    'svc_cust', (select nullif(concat_ws(', ',
        case when sc ~ '(gọt hàm|v-?line|góc hàm|hàm vuông|chỉnh hàm|khớp cắn|(^|[^[:alpha:]])(hô|móm)([^[:alpha:]]|$))' then 'Gọt / chỉnh hàm' end,
        case when sc ~ '(gò má|hạ gò)' then 'Hạ gò má' end,
        case when sc ~ '(trượt cằm|độn cằm|cằm lẹm)' then 'Cằm' end,
        case when sc ~ '(cơ cắn)' then 'Bóc cơ cắn' end,
        case when sc ~ '(mũi)' then 'Nâng mũi' end,
        case when sc ~ '(cắt mí|mí mắt|bọng mắt|bấm mí|mắt)' then 'Mắt' end,
        case when sc ~ '(ngực|nâng ngực)' then 'Nâng ngực' end,
        case when sc ~ '(hút mỡ|mỡ bụng|vòng eo|body)' then 'Hút mỡ / body' end,
        case when sc ~ '(căng da|trẻ hoá|trẻ hóa|chảy xệ|nếp nhăn)' then 'Căng da / trẻ hoá' end,
        case when sc ~ '(răng|niềng|implant)' then 'Răng (không thuộc dịch vụ chính)' end), '') from tx),
    'svc_page', (select nullif(concat_ws(', ',
        case when sp ~ '(gọt hàm|v-?line|góc hàm|hàm vuông|chỉnh hàm|khớp cắn|(^|[^[:alpha:]])(hô|móm)([^[:alpha:]]|$))' then 'Gọt / chỉnh hàm' end,
        case when sp ~ '(gò má|hạ gò)' then 'Hạ gò má' end,
        case when sp ~ '(trượt cằm|độn cằm|cằm lẹm)' then 'Cằm' end,
        case when sp ~ '(cơ cắn)' then 'Bóc cơ cắn' end,
        case when sp ~ '(mũi)' then 'Nâng mũi' end,
        case when sp ~ '(cắt mí|mí mắt|bọng mắt|bấm mí|mắt)' then 'Mắt' end,
        case when sp ~ '(ngực|nâng ngực)' then 'Nâng ngực' end,
        case when sp ~ '(hút mỡ|mỡ bụng|vòng eo|body)' then 'Hút mỡ / body' end,
        case when sp ~ '(căng da|trẻ hoá|trẻ hóa|chảy xệ|nếp nhăn)' then 'Căng da / trẻ hoá' end,
        case when sp ~ '(răng|niềng|implant)' then 'Răng (không thuộc dịch vụ chính)' end), '') from tx),
    'group', (select coalesce(case
        when sc ~ '(hàm|gò má|cằm|cơ cắn|khớp cắn|(^|[^[:alpha:]])(hô|móm)([^[:alpha:]]|$))' then 'Nhóm hàm mặt'
        when sc ~ 'mũi' then 'Nhóm mũi'
        when sc ~ '(cắt mí|bấm mí|mí mắt|mắt)' then 'Nhóm mắt'
        when sc ~ 'ngực' then 'Nhóm ngực'
        when sc ~ '(hút mỡ|mỡ bụng|body|vòng eo)' then 'Nhóm body'
        when sc ~ '(căng da|trẻ ho|chảy xệ|nhăn)' then 'Nhóm da / trẻ hoá' end, case
        when sp ~ '(hàm|gò má|cằm|cơ cắn|khớp cắn|(^|[^[:alpha:]])(hô|móm)([^[:alpha:]]|$))' then 'Nhóm hàm mặt'
        when sp ~ 'mũi' then 'Nhóm mũi'
        when sp ~ '(cắt mí|bấm mí|mí mắt|mắt)' then 'Nhóm mắt'
        when sp ~ 'ngực' then 'Nhóm ngực'
        when sp ~ '(hút mỡ|mỡ bụng|body|vòng eo)' then 'Nhóm body'
        when sp ~ '(căng da|trẻ ho|chảy xệ|nhăn)' then 'Nhóm da / trẻ hoá' end) from tx)
  );
$q$;

-- Mặc định phân công khi KHÔNG ghi rõ (hệ thống tự tạo / import): Telesale Xuân, Trực page Bảo Bei
create or replace function public.md_default_assign() returns trigger
language plpgsql security definer set search_path = public as $q$
begin
  if new.telesale_id is null then new.telesale_id := '3a7b1dab-978a-4f9a-abba-f097af83ccdc'; end if;   -- Hoàng Thị Xuân
  if new.truc_page_id is null then new.truc_page_id := '8dfd4461-de72-4db7-891e-a8bd6692a8ed'; end if; -- Bảo Bei
  return new;
end $q$;
drop trigger if exists trg_md_default_assign on public.marketing_data;
create trigger trg_md_default_assign before insert on public.marketing_data
  for each row execute function public.md_default_assign();

create or replace function public.apply_messenger_info(p_data uuid, p_conv text, p_name text) returns void
language plpgsql security definer set search_path = public as $q$
declare i jsonb; t0 text; need text; info text;
begin
  i := public.messenger_lead_info(p_conv);
  t0 := to_char((i->>'first')::timestamptz at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM');
  need := concat_ws(' — ',
    case when i->>'svc_cust' is not null then 'Quan tâm: ' || (i->>'svc_cust')
         when i->>'svc_page' is not null then 'Quan tâm (theo QC/page tư vấn): ' || (i->>'svc_page') end,
    coalesce(i->>'asked', case when coalesce(i->>'svc_cust', i->>'svc_page') is null then 'Khách để lại SĐT qua Messenger, chưa nói rõ dịch vụ — telesale hỏi nhu cầu' end));
  info := concat_ws(' · ',
    'Khách nhắn Messenger' || case when (i->>'ad')::boolean then ' qua quảng cáo' else '' end || coalesce(' lúc ' || t0, ''),
    (i->>'n') || ' tin',
    case when (i->>'photo')::boolean then 'có gửi ảnh' end,
    'đã để lại SĐT, page đã xin số/Zalo — chờ telesale gọi');
  update marketing_data set
    customer_name = coalesce(nullif(trim(customer_name), ''), p_name),
    description = need,
    customer_group = coalesce(customer_group, i->>'group'),
    reached_info = info,
    telesale_id = coalesce(telesale_id, '3a7b1dab-978a-4f9a-abba-f097af83ccdc'),
    truc_page_id = coalesce(truc_page_id, '8dfd4461-de72-4db7-891e-a8bd6692a8ed')
  where id = p_data;
end $q$;

create or replace function public.enrich_messenger_lead() returns trigger
language plpgsql security definer set search_path = public as $q$
declare k record;
begin
  if new.data_id is null or (tg_op = 'UPDATE' and old.data_id is not distinct from new.data_id) then return new; end if;
  select id, description, source into k from marketing_data where id = new.data_id;
  if k.id is null or coalesce(k.source, '') <> 'Messenger' then return new; end if;
  if coalesce(k.description, '') not in ('', 'Tự tạo từ hội thoại Messenger') then return new; end if;
  perform public.apply_messenger_info(k.id, new.conv_key, new.participant_name);
  return new;
exception when others then
  return new;
end $q$;

-- Bổ sung lại cho khách Messenger hệ thống đã tạo (chưa có nhân viên ghi chú / sửa)
select public.apply_messenger_info(c.data_id, c.conv_key, c.participant_name)
from (select distinct on (c.data_id) c.data_id, c.conv_key, c.participant_name
      from fb_conversations c join marketing_data m on m.id = c.data_id
      where m.source = 'Messenger' and m.created_by is null
        and (m.reached_info like 'Hội thoại Messenger%' or m.reached_info like 'Khách nhắn Messenger%' or coalesce(m.description,'') in ('', 'Tự tạo từ hội thoại Messenger'))
        and position(E'\n' in coalesce(m.description,'')) = 0   -- chưa có trực page gộp thêm thông tin
      order by c.data_id, c.last_time desc nulls last) c;

-- Khách đang chưa có telesale / trực page -> mặc định Xuân / Bảo Bei
update marketing_data set telesale_id = coalesce(telesale_id, '3a7b1dab-978a-4f9a-abba-f097af83ccdc'),
  truc_page_id = coalesce(truc_page_id, '8dfd4461-de72-4db7-891e-a8bd6692a8ed')
where telesale_id is null or truc_page_id is null;
