-- ============================================================
-- THÔNG BÁO TELEGRAM CHO KẾ TOÁN
-- ------------------------------------------------------------
-- Bổ sung các sự kiện tài chính → insert vào bảng notifications.
-- Đường đi: notifications (INSERT) → Database Webhook → Edge Function
-- notify-telegram → Telegram của người có profiles.telegram_chat_id.
-- KHÔNG cần deploy lại Edge Function — pipeline đã xử lý generic.
--
-- Điều kiện trước khi chạy: đã chạy notifications.sql + telegram.sql,
-- đã cấu hình Database Webhook (INSERT on notifications → notify-telegram).
-- Idempotent — chạy trong Supabase SQL Editor.
-- ============================================================

-- Helper: danh sách kế toán đang hoạt động (kể cả kiêm nhiệm role_2)
create or replace function accountant_ids(p_exclude uuid default null)
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from profiles p
  where (p.role::text = 'accountant' or p.role_2::text = 'accountant')
    and coalesce(p.is_active, true) = true
    and p.id is distinct from p_exclude;
$$;

-- ---------- 1) Giao dịch thu / chi mới (finance_transactions) ----------
create or replace function notify_acct_finance_trans() returns trigger
language plpgsql security definer set search_path = public as $$
declare aname text;
begin
  select full_name into aname from profiles where id = NEW.created_by;
  insert into notifications(user_id, actor_id, type, title, body, link)
  select uid, NEW.created_by, 'finance_transaction',
         (case when NEW.type = 'income' then '💰 Khoản thu mới' else '💸 Khoản chi mới' end)
           || coalesce(' — ' || aname, ''),
         'Ngày ' || to_char(NEW.date, 'DD/MM/YYYY')
           || ' · ' || to_char(NEW.amount, 'FM999G999G999') || 'đ'
           || coalesce(' · ' || nullif(NEW.notes, ''), ''),
         'finance'
  from accountant_ids(NEW.created_by) uid;
  return NEW;
end $$;
drop trigger if exists trg_notify_acct_finance_trans on finance_transactions;
create trigger trg_notify_acct_finance_trans
  after insert on finance_transactions
  for each row execute function notify_acct_finance_trans();

-- ---------- 2) Dòng tiền mới (cash_flows) ----------
create or replace function notify_acct_cash_flow() returns trigger
language plpgsql security definer set search_path = public as $$
declare aname text;
begin
  select full_name into aname from profiles where id = NEW.created_by;
  insert into notifications(user_id, actor_id, type, title, body, link)
  select uid, NEW.created_by, 'cash_flow',
         (case when NEW.flow_type = 'in' then '🟢 Nhận tiền' else '🔴 Chi tiền' end)
           || ' (' || (case when NEW.method = 'cash' then 'tiền mặt' else 'chuyển khoản' end) || ')'
           || coalesce(' — ' || aname, ''),
         'Ngày ' || to_char(NEW.date, 'DD/MM/YYYY')
           || ' · ' || to_char(NEW.amount, 'FM999G999G999') || 'đ'
           || coalesce(' · ' || nullif(NEW.handover_person, ''), '')
           || coalesce(' · ' || nullif(NEW.notes, ''), ''),
         'finance'
  from accountant_ids(NEW.created_by) uid;
  return NEW;
end $$;
drop trigger if exists trg_notify_acct_cash_flow on cash_flows;
create trigger trg_notify_acct_cash_flow
  after insert on cash_flows
  for each row execute function notify_acct_cash_flow();

-- ---------- 3) Viện phí vừa được ghi nhận trên lịch hẹn ----------
create or replace function notify_acct_hospital_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.hospital_fee is not null
     and NEW.hospital_fee is distinct from OLD.hospital_fee then
    insert into notifications(user_id, type, title, body, link)
    select uid, 'hospital_fee',
           '🏥 Đã thu viện phí: ' || coalesce(NEW.customer_name, 'Khách hàng'),
           to_char(NEW.hospital_fee, 'FM999G999G999') || 'đ'
             || coalesce(' · ' || nullif(NEW.hospital_fee_method, ''), '')
             || coalesce(' · ' || nullif(NEW.service, ''), ''),
           'appointments'
    from accountant_ids() uid;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_acct_hospital_fee on customer_appointments;
create trigger trg_notify_acct_hospital_fee
  after update on customer_appointments
  for each row execute function notify_acct_hospital_fee();

-- ---------- 4) Khoản chi được duyệt → nhắc kế toán chi tiền ----------
-- (Nhân sự đã có thông báo riêng qua notify_expense; đây là nhắc việc cho kế toán)
create or replace function notify_acct_expense_approved() returns trigger
language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    select full_name into sname from profiles where id = NEW.staff_id;
    insert into notifications(user_id, actor_id, type, title, body, link)
    select uid, NEW.approved_by, 'expense_to_pay',
           '💵 Cần chi: ' || (case when NEW.is_advance then 'tạm ứng' else 'khoản chi' end)
             || ' của ' || coalesce(sname, 'nhân sự') || ' đã được duyệt',
           'Số tiền ' || to_char(NEW.amount, 'FM999G999G999') || 'đ'
             || coalesce(' · ' || nullif(NEW.description, ''), ''),
           'advances'
    from accountant_ids(NEW.approved_by) uid
    where uid is distinct from NEW.staff_id; -- nhân sự đã có thông báo riêng
  end if;
  return NEW;
end $$;
drop trigger if exists trg_notify_acct_expense_approved on expenses;
create trigger trg_notify_acct_expense_approved
  after update on expenses
  for each row execute function notify_acct_expense_approved();
