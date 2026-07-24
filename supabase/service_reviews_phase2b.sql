-- ============================================================
-- SSM CarePulse — Giai đoạn 2b
--  (1) Phân tích cảm xúc tự động (rule-based, không cần AI ngoài)
--  (2) Khảo sát lại sau khi xử lý ticket (PRD §10)
-- Chạy 1 lần trên Supabase. An toàn chạy lại. Cần đã chạy các file trước.
-- ============================================================

-- ---------- Cột phục vụ khảo sát lại ----------
alter table service_review_invitations add column if not exists is_resurvey boolean not null default false;
alter table service_review_invitations add column if not exists ticket_id   uuid;

-- ---------- (1) Tự gán cảm xúc theo điểm + từ khoá nhận xét ----------
create or replace function sr_set_sentiment()
returns trigger
language plpgsql
as $$
begin
  new.sentiment := case
    when new.overall_score is null then 'trung lập'
    when new.overall_score <= 1 then 'rất tiêu cực'
    when new.overall_score = 2 then 'tiêu cực'
    when new.overall_score = 3 then 'trung lập'
    when new.overall_score = 4 then 'tích cực'
    else 'rất tích cực'
  end;
  -- Nhận xét có từ khoá tiêu cực mạnh → hạ cảm xúc dù điểm không quá thấp
  if new.comment is not null and coalesce(new.overall_score, 5) >= 3
     and new.comment ~* '(rất tệ|quá tệ|tồi tệ|thất vọng|bực|cáu gắt|khiếu nại|hoàn tiền|chặt chém|lừa|thái độ kém|quá lâu|chờ quá|nhiễm trùng|biến chứng)' then
    new.sentiment := 'tiêu cực';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sr_sentiment on service_review_responses;
create trigger trg_sr_sentiment
  before insert on service_review_responses
  for each row execute function sr_set_sentiment();

-- ---------- (2) get_review_invitation: trả thêm cờ khảo sát lại ----------
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
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if inv.status = 'completed' then return jsonb_build_object('ok', false, 'error', 'completed'); end if;
  if inv.status = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'cancelled'); end if;
  if inv.expires_at < now() then
    update service_review_invitations set status = 'expired' where id = inv.id and status <> 'expired';
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if inv.status = 'pending' then
    update service_review_invitations set status = 'opened', opened_at = now() where id = inv.id;
  end if;
  return jsonb_build_object(
    'ok', true,
    'invitation_id', inv.id,
    'customer_name', inv.customer_name,
    'service', inv.service,
    'surgery_date', inv.surgery_date,
    'milestone', inv.milestone,
    'staff', inv.staff_snapshot,
    'otp_required', inv.otp_required,
    'is_resurvey', inv.is_resurvey,
    'phone_masked', case when inv.phone is not null and length(inv.phone) >= 4
                         then repeat('*', greatest(length(inv.phone)-3, 0)) || right(inv.phone, 3)
                         else null end
  );
end;
$$;

-- ---------- (2) Tạo phiếu khảo sát lại gắn với ticket ----------
create or replace function create_resurvey(p_ticket_id uuid, p_created_by uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t   service_review_tickets%rowtype;
  inv service_review_invitations%rowtype;
  v_tk text;
begin
  select * into t from service_review_tickets where id = p_ticket_id;
  if not found then return null; end if;

  -- Dùng lại phiếu khảo sát lại chưa hoàn thành nếu có
  select token into v_tk from service_review_invitations
   where ticket_id = p_ticket_id and is_resurvey = true and status in ('pending', 'opened')
   order by created_at desc limit 1;
  if v_tk is not null then return v_tk; end if;

  select * into inv from service_review_invitations where id = t.invitation_id;
  insert into service_review_invitations
    (appointment_id, customer_name, phone, service, surgery_date, staff_snapshot,
     milestone, channel, created_by, is_resurvey, ticket_id, expires_at)
  values
    (inv.appointment_id, coalesce(t.customer_name, inv.customer_name), inv.phone, inv.service, inv.surgery_date, '{}'::jsonb,
     'post_resolution', 'qr', p_created_by, true, p_ticket_id, now() + interval '30 days')
  returning token into v_tk;
  return v_tk;
end;
$$;

grant execute on function create_resurvey(uuid, uuid) to authenticated;

-- ---------- Ticket không tự sinh từ phiếu KHẢO SÁT LẠI ----------
create or replace function sr_make_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv  service_review_invitations%rowtype;
  v_prio text;
  v_sla  interval;
  v_cat  text;
begin
  select * into v_inv from service_review_invitations where id = new.invitation_id;
  if v_inv.is_resurvey then return new; end if;  -- phiếu khảo sát lại: không tạo ticket mới

  if (new.overall_score is not null and new.overall_score <= 2)
     or new.wants_contact in ('urgent', 'office_hours')
     or new.risk_level = 'high' then

    if new.wants_contact = 'urgent' or new.overall_score = 1 then
      v_prio := 'urgent'; v_sla := interval '4 hours';
    elsif coalesce(new.overall_score, 5) <= 2 then
      v_prio := 'high';   v_sla := interval '24 hours';
    else
      v_prio := 'normal'; v_sla := interval '72 hours';
    end if;

    begin v_cat := new.selected_topics ->> 0; exception when others then v_cat := null; end;

    insert into service_review_tickets
      (response_id, invitation_id, customer_name, category, priority, status, sla_due_at, overall_score, wants_contact)
    values
      (new.id, new.invitation_id, coalesce(v_inv.customer_name, 'Khách'), v_cat,
       v_prio, 'new', now() + v_sla, new.overall_score, new.wants_contact);
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
