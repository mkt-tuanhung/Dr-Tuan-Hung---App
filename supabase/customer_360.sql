-- ============================================================
-- HỒ SƠ KHÁCH HÀNG 360 (Ethics BOS D03) — chạy 1 lần trong SQL Editor (chạy lại vẫn an toàn)
--
-- get_customer_360(p_phone): gom MỌI dữ liệu của 1 khách (khớp theo 9 số cuối SĐT)
--   lead Data KH · lịch hẹn / cọc / phẫu thuật / hậu phẫu · cuộc gọi & chăm sóc ·
--   đánh giá dịch vụ · ghi âm tư vấn (điểm AI) · hình ảnh media · tin nhắn Messenger ·
--   lịch sử ghi chú GetFly (getfly_comments.sql)
-- để mọi màn (Lịch hẹn, Khách cọc, Phẫu thuật, Hậu phẫu, CSKH…) mở cùng 1 hồ sơ.
--
-- Ai xem được (giống quy tắc get_customer_card đang dùng):
--   - Admin, Kế toán, Cổ đông
--   - người có tên trên hồ sơ: sale, telesale, bác sĩ, phụ mổ, trực đêm, hậu phẫu, trực page…
--   - vai trò được xem theo trạng thái lịch hẹn của khách (chờ tư vấn / cọc / bong / phẫu thuật)
--   Không đủ quyền -> trả { denied: true }.
-- Sale Offline (không phải admin): SĐT bị che 4 số cuối NGAY TRÊN MÁY CHỦ.
-- Bảng tuỳ chọn chưa có (đánh giá, ghi âm, media, Messenger, ghi chú GetFly) -> phần đó để trống.
-- ============================================================

create or replace function public.c360_phone_key(p text)
returns text language sql immutable as $$
  select right(case when d like '84%' then '0' || substr(d, 3) else d end, 9)
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;

create or replace function public.get_customer_360(p_phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_key text := public.c360_phone_key(p_phone);
  v_roles text[];
  v_lead jsonb;
  v_appts jsonb := '[]'::jsonb;
  v_appt_ids uuid[];
  v_allowed boolean := false;
  v_mask boolean;
  v_phone text;
  v_activities jsonb := '[]'::jsonb;
  v_reviews jsonb := '[]'::jsonb;
  v_recordings jsonb := '[]'::jsonb;
  v_media jsonb := '[]'::jsonb;
  v_messages jsonb := '[]'::jsonb;
  v_getfly jsonb := '[]'::jsonb;
  v_names jsonb := '{}'::jsonb;
  v_people text[] := array['sale_id', 'telesale_id', 'telesale_id_2', 'bac_si_id', 'phu_mo_1_id', 'phu_mo_2_id',
                           'phu_mo_3_id', 'truc_dem_id', 'truc_dem_id_2', 'hau_phau_id', 'created_by', 'truc_page_id'];
begin
  if v_me is null then raise exception 'Chưa đăng nhập'; end if;
  if length(v_key) < 8 then raise exception 'Số điện thoại không hợp lệ'; end if;
  select array_remove(array[role::text, role_2::text], null) into v_roles from profiles where id = v_me and is_active;
  if v_roles is null then raise exception 'Tài khoản không hợp lệ hoặc đã bị khoá'; end if;

  select to_jsonb(m) into v_lead from marketing_data m where public.c360_phone_key(m.phone) = v_key
    order by m.created_at limit 1;

  select coalesce(jsonb_agg(to_jsonb(a) order by coalesce(a.appointment_date::text, a.created_at::text) desc), '[]'::jsonb),
         array_agg(a.id)
    into v_appts, v_appt_ids
  from customer_appointments a where public.c360_phone_key(a.phone) = v_key;
  v_appt_ids := coalesce(v_appt_ids, array[]::uuid[]);

  if v_lead is null and jsonb_array_length(v_appts) = 0 then
    return jsonb_build_object('found', false);
  end if;

  -- ---------- Quyền ----------
  v_allowed := v_roles && array['admin', 'accountant', 'shareholder'];
  if not v_allowed then
    -- Có tên trên hồ sơ (bất kỳ vị trí nào)
    v_allowed := exists (
      select 1 from jsonb_array_elements(v_appts || coalesce(jsonb_build_array(v_lead), '[]'::jsonb)) r,
                    jsonb_each_text(r) kv
      where kv.key = any(v_people) and kv.value = v_me::text);
  end if;
  if not v_allowed then
    -- Theo trạng thái lịch hẹn (giống get_customer_card)
    v_allowed := exists (
      select 1 from jsonb_array_elements(v_appts) r
      where v_roles && (case r->>'status'
        when 'scheduled' then array['telesale', 'sale_offline', 'cskh', 'dieu_duong', 'marketing']
        when 'coc' then array['telesale', 'sale_offline', 'marketing']
        when 'bong' then array['telesale', 'sale_offline', 'cskh']
        when 'phau_thuat' then array['dieu_duong', 'cskh', 'bac_si']
        else array[]::text[] end));
  end if;
  if not v_allowed and v_lead is not null then
    -- Lead chưa có lịch hẹn: đội Data KH
    v_allowed := v_roles && array['marketing', 'truc_page', 'telesale'];
  end if;
  if not v_allowed then return jsonb_build_object('denied', true); end if;

  v_mask := 'sale_offline' = any(v_roles) and not ('admin' = any(v_roles));
  v_phone := coalesce(v_lead->>'phone', v_appts->0->>'phone');
  if v_mask and length(v_phone) > 4 then v_phone := left(v_phone, length(v_phone) - 4) || '••••'; end if;

  -- ---------- Cuộc gọi & chăm sóc ----------
  select coalesce(jsonb_agg(to_jsonb(x) - 'phone' order by x.created_at desc), '[]'::jsonb) into v_activities
  from (select * from marketing_activities ma
        where (v_lead is not null and ma.data_id = (v_lead->>'id')::uuid) or public.c360_phone_key(ma.phone) = v_key
        order by ma.created_at desc limit 100) x;

  -- ---------- Bảng tuỳ chọn ----------
  if to_regclass('public.service_review_invitations') is not null and to_regclass('public.service_review_responses') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'appointment_id', i.appointment_id, 'milestone', i.milestone, 'service', i.service,
        'csat_score', r.csat_score, 'nps_score', r.nps_score, 'overall_score', r.overall_score,
        'comment', r.comment, 'sentiment', r.sentiment, 'submitted_at', r.submitted_at
      ) order by r.submitted_at desc), '[]'::jsonb)
      from service_review_invitations i join service_review_responses r on r.invitation_id = i.id
      where i.appointment_id = any($1) or public.c360_phone_key(i.phone) = $2 $q$
    into v_reviews using v_appt_ids, v_key;
  end if;

  if to_regclass('public.consult_recordings') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'appointment_id', c.appointment_id, 'duration_sec', c.duration_sec, 'ai_score', c.ai_score,
        'summary', coalesce(c.ai_analysis->>'summary', c.ai_analysis->>'tom_tat', c.ai_analysis->>'overview'),
        'status', c.status, 'created_by', c.created_by, 'created_at', c.created_at
      ) order by c.created_at desc), '[]'::jsonb)
      from consult_recordings c where c.appointment_id = any($1) $q$
    into v_recordings using v_appt_ids;
  end if;

  if to_regclass('public.media_customers') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(mc) - 'customer_phone' order by mc.created_at desc), '[]'::jsonb)
      from media_customers mc where mc.appointment_id = any($1) or public.c360_phone_key(mc.customer_phone) = $2 $q$
    into v_media using v_appt_ids, v_key;
  end if;

  if to_regclass('public.fb_conversations') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'conv_key', f.conv_key, 'participant_name', f.participant_name, 'last_message', f.last_message, 'last_time', f.last_time
      ) order by f.last_time desc nulls last), '[]'::jsonb)
      from fb_conversations f where ($1 is not null and f.data_id = $1) or public.c360_phone_key(f.phone) = $2 $q$
    into v_messages using (v_lead->>'id')::uuid, v_key;
  end if;

  if to_regclass('public.getfly_comments') is not null and v_lead is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'title', g.title, 'content', g.content, 'creator_name', g.creator_name,
        'is_feedback', g.is_feedback, 'created_at', g.created_at
      ) order by g.created_at desc nulls last), '[]'::jsonb)
      from (select * from getfly_comments where data_id = $1 order by created_at desc nulls last limit 200) g $q$
    into v_getfly using (v_lead->>'id')::uuid;
  end if;

  -- Tên nhân sự cho mọi mã người xuất hiện trong hồ sơ
  select coalesce(jsonb_object_agg(p.id, p.full_name), '{}'::jsonb) into v_names
  from profiles p
  where p.id::text in (
    select kv.value from jsonb_array_elements(v_appts || v_activities || v_recordings || v_media || coalesce(jsonb_build_array(v_lead), '[]'::jsonb)) r,
                         jsonb_each_text(r) kv
    where kv.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

  return jsonb_build_object(
    'found', true,
    'phone', v_phone,
    'phone_masked', v_mask,
    'lead', case when v_lead is null then null else v_lead - 'phone' end,
    'appointments', (select coalesce(jsonb_agg(e - 'phone'), '[]'::jsonb) from jsonb_array_elements(v_appts) e),
    'activities', v_activities,
    'reviews', v_reviews,
    'recordings', v_recordings,
    'media', v_media,
    'messages', v_messages,
    'getfly_notes', v_getfly,
    'names', v_names
  );
end $$;

revoke all on function public.get_customer_360(text) from public;
grant execute on function public.get_customer_360(text) to authenticated;
