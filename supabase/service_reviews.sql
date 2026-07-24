-- ============================================================
-- SSM CarePulse — Đánh giá chất lượng dịch vụ sau phẫu thuật
-- Giai đoạn 1 (MVP theo PRD §34.1). Chạy 1 lần trên Supabase.
-- An toàn chạy lại (idempotent): dùng IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. Mẫu phiếu & câu hỏi (cho Survey Builder về sau) ----------
create table if not exists service_review_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  description text,
  version     int  not null default 1,
  status      text not null default 'published',   -- draft | published | archived
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists service_review_questions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references service_review_templates(id) on delete cascade,
  question_code text not null,
  question_text text not null,
  question_type text not null,                       -- rating5 | nps | single | multi | text
  is_required   boolean not null default true,
  display_order int not null default 0,
  config_json   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---------- 2. Phiếu mời đánh giá (mỗi ca 1 phiếu / mốc) ----------
create table if not exists service_review_invitations (
  id             uuid primary key default gen_random_uuid(),
  token          text unique not null default encode(gen_random_bytes(16), 'hex'),
  appointment_id uuid,                                -- ref customer_appointments (không FK cứng để linh hoạt)
  template_id    uuid references service_review_templates(id),
  milestone      text not null default 'D1',          -- D1 | D3_7 | D14_30 | D90
  customer_name  text,
  phone          text,                                -- chỉ nhân sự xem được (RLS)
  phone_hash     text,                                -- băm để đối chiếu, không lộ số
  service        text,
  surgery_date   date,
  staff_snapshot jsonb not null default '{}'::jsonb,  -- {doctor:{id,name}, nurses:[...], consultants:[...]}
  channel        text not null default 'qr',          -- qr | sms | zalo | email | link
  status         text not null default 'pending',     -- pending|opened|completed|expired|cancelled
  otp_required   boolean not null default false,      -- bật khi đã nối SMS/Zalo
  otp_code_hash  text,
  otp_expires_at timestamptz,
  otp_attempts   int not null default 0,
  otp_verified_at timestamptz,
  expires_at     timestamptz not null default (now() + interval '30 days'),
  opened_at      timestamptz,
  completed_at   timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists idx_sri_appt   on service_review_invitations(appointment_id);
create index if not exists idx_sri_status on service_review_invitations(status);

-- ---------- 3. Phản hồi (KHÔNG sửa đè — PRD §28) ----------
create table if not exists service_review_responses (
  id               uuid primary key default gen_random_uuid(),
  invitation_id    uuid unique references service_review_invitations(id) on delete cascade,
  template_version int,
  overall_score    int,          -- câu 1 (1..5)
  csat_score       numeric(4,2), -- TB câu 1..8
  nps_score        int,          -- câu 9 (0..10)
  staff_ratings    jsonb not null default '[]'::jsonb, -- [{staff_id,name,role,score}]
  answers          jsonb not null default '{}'::jsonb, -- toàn bộ câu trả lời theo question_code
  selected_topics  jsonb not null default '[]'::jsonb,
  wants_contact    text,         -- urgent | office_hours | none
  comment          text,
  sentiment        text,         -- AI (giai đoạn sau)
  risk_level       text,         -- low | medium | high
  verification_level int not null default 1, -- L1 gán ca hợp lệ, L2 đã OTP...
  fraud_score      int not null default 0,
  fraud_status     text not null default 'clean', -- clean | watch | suspect | high | confirmed_ok | confirmed_fraud
  device_hash      text,
  ip_hash          text,
  duration_seconds int,
  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists idx_srr_fraud on service_review_responses(fraud_status);

-- ---------- 4. Tín hiệu gian lận (PRD §12) ----------
create table if not exists service_review_fraud_signals (
  id          uuid primary key default gen_random_uuid(),
  response_id uuid references service_review_responses(id) on delete cascade,
  signal_type text not null,
  risk_points int  not null default 0,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Seed mẫu phiếu mặc định (10 câu) — dùng cho Survey Builder về sau.
-- ============================================================
insert into service_review_templates (code, name, description, is_default, status)
values ('POST_OP_STANDARD', 'Phiếu đánh giá sau phẫu thuật (10 câu)',
        'Bộ 10 câu hỏi trọng tâm theo PRD SSM CarePulse', true, 'published')
on conflict (code) do nothing;

-- ============================================================
-- RLS
-- ============================================================
alter table service_review_templates      enable row level security;
alter table service_review_questions       enable row level security;
alter table service_review_invitations     enable row level security;
alter table service_review_responses       enable row level security;
alter table service_review_fraud_signals   enable row level security;

-- Nhân sự đã đăng nhập: đọc cấu hình phiếu
drop policy if exists sr_tpl_read on service_review_templates;
create policy sr_tpl_read on service_review_templates for select to authenticated using (true);
drop policy if exists sr_q_read on service_review_questions;
create policy sr_q_read on service_review_questions for select to authenticated using (true);

-- Phiếu mời: nhân sự đăng nhập tạo & đọc; khách (anon) KHÔNG đọc trực tiếp (chỉ qua RPC).
drop policy if exists sr_inv_read on service_review_invitations;
create policy sr_inv_read on service_review_invitations for select to authenticated using (true);
drop policy if exists sr_inv_insert on service_review_invitations;
create policy sr_inv_insert on service_review_invitations for insert to authenticated with check (true);
drop policy if exists sr_inv_update on service_review_invitations;
create policy sr_inv_update on service_review_invitations for update to authenticated using (true);

-- Phản hồi & tín hiệu: nhân sự đọc; khách ghi qua RPC (SECURITY DEFINER).
drop policy if exists sr_resp_read on service_review_responses;
create policy sr_resp_read on service_review_responses for select to authenticated using (true);
drop policy if exists sr_resp_update on service_review_responses;
create policy sr_resp_update on service_review_responses for update to authenticated using (true);
drop policy if exists sr_sig_read on service_review_fraud_signals;
create policy sr_sig_read on service_review_fraud_signals for select to authenticated using (true);

-- ============================================================
-- RPC công khai (anon) — an toàn, không lộ dữ liệu nhạy cảm.
-- ============================================================

-- Lấy phiếu theo token (khách quét QR). Đánh dấu đã mở.
create or replace function get_review_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv service_review_invitations%rowtype;
begin
  select * into inv from service_review_invitations where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if inv.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'completed');
  end if;
  if inv.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;
  if inv.expires_at < now() then
    update service_review_invitations set status = 'expired' where id = inv.id and status <> 'expired';
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if inv.status = 'pending' then
    update service_review_invitations set status = 'opened', opened_at = now() where id = inv.id;
  end if;

  -- Chỉ trả về dữ liệu tối thiểu, KHÔNG trả số điện thoại đầy đủ.
  return jsonb_build_object(
    'ok', true,
    'invitation_id', inv.id,
    'customer_name', inv.customer_name,
    'service', inv.service,
    'surgery_date', inv.surgery_date,
    'milestone', inv.milestone,
    'staff', inv.staff_snapshot,
    'otp_required', inv.otp_required,
    'phone_masked', case when inv.phone is not null and length(inv.phone) >= 4
                         then repeat('*', greatest(length(inv.phone)-3, 0)) || right(inv.phone, 3)
                         else null end
  );
end;
$$;

-- Gửi phản hồi. Tính điểm + chấm rủi ro gian lận cơ bản.
create or replace function submit_review(
  p_token       text,
  p_answers     jsonb,
  p_staff       jsonb default '[]'::jsonb,
  p_topics      jsonb default '[]'::jsonb,
  p_wants       text  default null,
  p_comment     text  default null,
  p_device_hash text  default null,
  p_duration    int   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv service_review_invitations%rowtype;
  v_resp_id uuid;
  v_overall int;
  v_csat numeric(4,2);
  v_nps int;
  v_sum numeric := 0;
  v_cnt int := 0;
  k text;
  v int;
  v_fraud int := 0;
  v_dup int := 0;
  v_risk text := 'low';
begin
  select * into inv from service_review_invitations where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if inv.status = 'completed' then return jsonb_build_object('ok', false, 'error', 'completed'); end if;
  if inv.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if inv.otp_required and inv.otp_verified_at is null then
    return jsonb_build_object('ok', false, 'error', 'otp_required');
  end if;

  -- CSAT = trung bình các câu rating 1..8 (q1..q8) có trả lời số hợp lệ
  for k in select jsonb_object_keys(p_answers) loop
    if k in ('q1','q2','q3','q4','q5','q6','q7','q8') then
      begin
        v := (p_answers ->> k)::int;
        if v between 1 and 5 then v_sum := v_sum + v; v_cnt := v_cnt + 1; end if;
      exception when others then null; end;
    end if;
  end loop;
  if v_cnt > 0 then v_csat := round(v_sum / v_cnt, 2); end if;
  begin v_overall := (p_answers ->> 'q1')::int; exception when others then v_overall := null; end;
  begin v_nps := (p_answers ->> 'q9')::int; exception when others then v_nps := null; end;

  -- Chấm điểm rủi ro gian lận (PRD §12.3)
  if p_duration is not null and p_duration < 20 then v_fraud := v_fraud + 15; end if;
  if p_device_hash is not null then
    select count(*) into v_dup from service_review_responses r
      where r.device_hash = p_device_hash
        and r.submitted_at > now() - interval '30 days';
    if v_dup >= 1 then v_fraud := v_fraud + 30; end if;
  end if;
  if inv.otp_verified_at is not null then v_fraud := v_fraud - 20; end if;
  if v_fraud < 0 then v_fraud := 0; end if;
  if v_fraud > 100 then v_fraud := 100; end if;

  if v_overall is not null and v_overall <= 2 then v_risk := 'high';
  elsif v_overall = 3 then v_risk := 'medium'; end if;

  insert into service_review_responses (
    invitation_id, template_version, overall_score, csat_score, nps_score,
    staff_ratings, answers, selected_topics, wants_contact, comment,
    risk_level, verification_level, fraud_score,
    fraud_status, device_hash, duration_seconds
  ) values (
    inv.id, 1, v_overall, v_csat, v_nps,
    coalesce(p_staff, '[]'::jsonb), coalesce(p_answers, '{}'::jsonb),
    coalesce(p_topics, '[]'::jsonb), p_wants, p_comment,
    v_risk,
    case when inv.otp_verified_at is not null then 2 else 1 end,
    v_fraud,
    case when v_fraud >= 70 then 'high' when v_fraud >= 50 then 'suspect'
         when v_fraud >= 30 then 'watch' else 'clean' end,
    p_device_hash, p_duration
  ) returning id into v_resp_id;

  -- Ghi tín hiệu gian lận
  if p_duration is not null and p_duration < 20 then
    insert into service_review_fraud_signals(response_id, signal_type, risk_points)
    values (v_resp_id, 'too_fast', 15);
  end if;
  if v_dup >= 1 then
    insert into service_review_fraud_signals(response_id, signal_type, risk_points, metadata)
    values (v_resp_id, 'same_device', 30, jsonb_build_object('count', v_dup));
  end if;

  update service_review_invitations
     set status = 'completed', completed_at = now()
   where id = inv.id;

  return jsonb_build_object('ok', true, 'response_id', v_resp_id);
end;
$$;

-- OTP (chừa sẵn chỗ nối SMS/Zalo). Sinh mã & lưu băm; việc GỬI do Edge Function/nhà cung cấp đảm nhiệm.
create or replace function request_review_otp(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv service_review_invitations%rowtype;
  v_code text;
begin
  select * into inv from service_review_invitations where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if inv.status = 'completed' then return jsonb_build_object('ok', false, 'error', 'completed'); end if;
  v_code := lpad((floor(random()*1000000))::int::text, 6, '0');
  update service_review_invitations
     set otp_code_hash = encode(digest(v_code, 'sha256'), 'hex'),
         otp_expires_at = now() + interval '5 minutes',
         otp_attempts = 0
   where id = inv.id;
  -- KHÔNG trả mã cho client. Edge Function đọc pending OTP để gửi qua SMS/Zalo.
  return jsonb_build_object('ok', true, 'sent', true);
end;
$$;

create or replace function verify_review_otp(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv service_review_invitations%rowtype;
begin
  select * into inv from service_review_invitations where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if inv.otp_expires_at is null or inv.otp_expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'otp_expired');
  end if;
  if inv.otp_attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;
  if inv.otp_code_hash = encode(digest(p_code, 'sha256'), 'hex') then
    update service_review_invitations set otp_verified_at = now() where id = inv.id;
    return jsonb_build_object('ok', true);
  else
    update service_review_invitations set otp_attempts = otp_attempts + 1 where id = inv.id;
    return jsonb_build_object('ok', false, 'error', 'otp_wrong');
  end if;
end;
$$;

grant execute on function get_review_invitation(text) to anon, authenticated;
grant execute on function submit_review(text, jsonb, jsonb, jsonb, text, text, text, int) to anon, authenticated;
grant execute on function request_review_otp(text) to anon, authenticated;
grant execute on function verify_review_otp(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
