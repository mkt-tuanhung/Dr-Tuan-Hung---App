-- ============================================================
-- SSM CarePulse — Giai đoạn 2a: Vòng xử lý phản hồi khép kín (Ticket)
-- PRD §9, §11, §30.7/§30.8. Chạy 1 lần trên Supabase. An toàn chạy lại.
-- Cần đã chạy service_reviews.sql trước.
-- ============================================================

-- ---------- Bảng ticket ----------
create table if not exists service_review_tickets (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid references service_review_responses(id) on delete cascade,
  invitation_id uuid,
  customer_name text,
  category      text,                          -- nhóm vấn đề (từ ý kiến khách)
  priority      text not null default 'normal',-- low | normal | high | urgent
  status        text not null default 'new',   -- new|in_progress|contacting|resolved|closed|no_contact|escalated
  assigned_to   uuid,                          -- nhân sự xử lý
  sla_due_at    timestamptz,
  overall_score int,
  wants_contact text,
  root_cause    text,
  resolution    text,
  resolved_at   timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_srt_status   on service_review_tickets(status);
create index if not exists idx_srt_assigned on service_review_tickets(assigned_to);

-- ---------- Nhật ký xử lý ticket ----------
create table if not exists service_review_ticket_activities (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid references service_review_tickets(id) on delete cascade,
  activity_type text not null default 'note',  -- note | status | assign | call
  content       text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_srta_ticket on service_review_ticket_activities(ticket_id);

-- ---------- RLS ----------
alter table service_review_tickets            enable row level security;
alter table service_review_ticket_activities  enable row level security;

drop policy if exists srt_all on service_review_tickets;
create policy srt_all  on service_review_tickets           for all to authenticated using (true) with check (true);
drop policy if exists srta_all on service_review_ticket_activities;
create policy srta_all on service_review_ticket_activities for all to authenticated using (true) with check (true);

grant select, insert, update, delete on service_review_tickets           to authenticated;
grant select, insert, update, delete on service_review_ticket_activities to authenticated;

-- ---------- Tự động tạo ticket khi phản hồi tiêu cực (PRD §9.1, §11) ----------
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
  if (new.overall_score is not null and new.overall_score <= 2)
     or new.wants_contact in ('urgent', 'office_hours')
     or new.risk_level = 'high' then

    select * into v_inv from service_review_invitations where id = new.invitation_id;

    if new.wants_contact = 'urgent' or new.overall_score = 1 then
      v_prio := 'urgent'; v_sla := interval '4 hours';
    elsif coalesce(new.overall_score, 5) <= 2 then
      v_prio := 'high';   v_sla := interval '24 hours';
    else
      v_prio := 'normal'; v_sla := interval '72 hours';
    end if;

    -- Nhóm vấn đề: ưu tiên phần khách nêu (selected_topics[0])
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

drop trigger if exists trg_sr_make_ticket on service_review_responses;
create trigger trg_sr_make_ticket
  after insert on service_review_responses
  for each row execute function sr_make_ticket();

notify pgrst, 'reload schema';
