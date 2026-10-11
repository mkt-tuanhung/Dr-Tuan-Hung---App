-- ============================================================
-- NHẬT KÝ THAO TÁC (theo Ethics BOS docs/11 — AUDITABLE) — chạy 1 lần trong SQL Editor
-- (chạy lại nhiều lần vẫn an toàn)
--
-- audit_log: CHỈ GHI THÊM. Không có policy insert/update/delete cho người dùng:
--   - trigger audit_row_change() tự ghi khi bảng nhạy cảm thay đổi
--   - hàm log_audit_event() để app ghi sự kiện không phải sửa bảng (VD: xuất file)
--
-- Ghi gì: ai làm (actor_id), làm gì (insert/update/delete/…), bảng + id bản ghi,
--   CÁC CỘT ĐÃ ĐỔI với giá trị trước/sau, lý do (nếu app gửi kèm), IP, trình duyệt, lúc nào.
-- Lý do: app gửi header "x-audit-reason" (UTF-8 mã hoá base64) cùng câu lệnh — xem
--   apps/web/src/lib/audit.js. Không gửi thì để trống.
--
-- Mỗi bảng chỉ theo dõi các cột nhạy cảm (để nhật ký không bị nhiễu):
--   payroll ............. thưởng khác, khấu trừ, trạng thái chốt
--   profiles ............ vai trò, lương, phụ cấp, khoá tài khoản, tài khoản nhận lương…
--   customer_appointments  trạng thái, người phụ trách, tiền cọc, doanh thu, viện phí, bác sĩ (không ghi lúc tạo)
--   finance_transactions, cash_flows, risk_fund ... mọi thay đổi
--   salary_advances, expenses, leave_requests, attendance ... chỉ khi NGƯỜI KHÁC sửa
--     (nhân sự tự gửi đơn / tự chấm công của mình thì không ghi)
--   partner_surgeries ... phí đối tác, phí mổ, vật tư, đã thanh toán, ê-kíp
-- ============================================================

create table if not exists public.audit_log (
  id              bigserial primary key,
  actor_id        uuid references public.profiles(id) on delete set null,
  action          text not null,                -- insert | update | delete | export | …
  entity          text not null,                -- tên bảng / loại đối tượng
  entity_id       text,
  changed_fields  text[],
  before_data     jsonb,
  after_data      jsonb,
  reason          text,
  ip              text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;

-- Admin đọc tất cả; Kế toán / Cổ đông đọc phần tài chính - lương
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid()
            and (p.role::text = 'admin' or p.role_2::text = 'admin'))
    or (
      entity in ('payroll', 'finance_transactions', 'cash_flows', 'risk_fund', 'salary_advances', 'expenses', 'partner_surgeries')
      and exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role::text in ('accountant', 'shareholder') or p.role_2::text in ('accountant', 'shareholder')))
    )
  );
grant select on public.audit_log to authenticated;

-- ---------- Thông tin phiên gọi (header PostgREST) ----------
create or replace function public.audit_request_meta()
returns table (reason text, ip text, user_agent text) language plpgsql stable as $$
declare
  h json;
  r text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  if h is null then return query select null::text, null::text, null::text; return; end if;
  r := h->>'x-audit-reason';
  if r is not null then
    begin
      r := convert_from(decode(r, 'base64'), 'UTF8');
    exception when others then r := null;
    end;
  end if;
  return query select
    left(nullif(trim(r), ''), 500),
    left(trim(split_part(coalesce(h->>'cf-connecting-ip', h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1)), 64),
    left(h->>'user-agent', 300);
end $$;

-- ---------- Trigger chung ----------
-- Tham số: (1) cột theo dõi: '*' = mọi cột, hoặc 'a,b,c'
--          (2) cột chủ sở hữu: bỏ qua khi chính chủ (hoặc hệ thống) tự sửa bản ghi của mình; '' = không bỏ qua
--          (3) 'skip_insert' = không ghi lúc tạo mới
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_watch text[] := case when coalesce(tg_argv[0], '*') = '*' then null else string_to_array(replace(tg_argv[0], ' ', ''), ',') end;
  v_owner text := nullif(coalesce(tg_argv[1], ''), '');
  v_skip_insert boolean := coalesce(tg_argv[2], '') = 'skip_insert';
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  row_ jsonb := coalesce(n, o);
  v_keys text[];
  v_before jsonb;
  v_after jsonb;
  m record;
begin
  if tg_op = 'INSERT' and v_skip_insert then return null; end if;
  if v_owner is not null and (v_actor is null or v_actor::text = row_->>v_owner) then return null; end if;

  select array_agg(k order by k) into v_keys
  from jsonb_object_keys(row_) as k
  where k not in ('updated_at', 'created_at')
    and (v_watch is null or k = any(v_watch))
    and (tg_op <> 'UPDATE' or (o->k) is distinct from (n->k));

  if v_keys is null then return null; end if;   -- không có cột theo dõi nào đổi

  select jsonb_object_agg(k, o->k) filter (where o is not null),
         jsonb_object_agg(k, n->k) filter (where n is not null)
    into v_before, v_after
  from unnest(v_keys) as k;

  select * into m from public.audit_request_meta();

  insert into public.audit_log (actor_id, action, entity, entity_id, changed_fields, before_data, after_data, reason, ip, user_agent)
  values (v_actor, lower(tg_op), tg_table_name,
          coalesce(row_->>'id', concat_ws('-', row_->>'staff_id', row_->>'year', row_->>'month')),
          case when tg_op = 'UPDATE' then v_keys end,
          v_before, v_after, m.reason, m.ip, m.user_agent);
  return null;
end $$;

-- Gắn trigger cho 1 bảng nếu bảng tồn tại
create or replace function public.audit_attach(p_table text, p_watch text, p_owner text default '', p_flags text default '')
returns void language plpgsql as $$
begin
  if to_regclass('public.' || p_table) is null then
    raise notice 'Bỏ qua %, bảng chưa có', p_table;
    return;
  end if;
  execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', p_table);
  execute format(
    'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row_change(%2$L, %3$L, %4$L)',
    p_table, p_watch, p_owner, p_flags);
end $$;

revoke all on function public.audit_attach(text, text, text, text) from public;

select public.audit_attach('payroll', 'other_bonus,other_deduction,status');
select public.audit_attach('profiles', 'role,role_2,position,base_salary,allowance,fixed_salary,is_active,employment_status,probation_started_at,official_started_at,bank_name,bank_account,employee_id');
select public.audit_attach('customer_appointments', 'status,sale_id,telesale_id,telesale_id_2,bac_si_id,deposit_amount,deposit_date,revenue,upsale_revenue,hospital_fee,surgery_date', '', 'skip_insert');
select public.audit_attach('finance_transactions', '*');
select public.audit_attach('cash_flows', '*');
select public.audit_attach('risk_fund', '*');
select public.audit_attach('salary_advances', 'amount,status,reject_reason,month,year', 'staff_id');
select public.audit_attach('expenses', 'amount,status,is_advance,category,deleted_at,paid_at,advance_repaid_at', 'staff_id');
select public.audit_attach('leave_requests', 'type,date,status', 'staff_id');
select public.audit_attach('attendance', 'status,leave_type,check_in,check_out,late_time,early_time,late_early_hours,overtime_hours,overtime_ranges', 'staff_id');
select public.audit_attach('partner_surgeries', 'partner_fee,surgery_fee,material_fee,partner_paid,bac_si_id,phu_mo_1_id,phu_mo_2_id,phu_mo_3_id');

-- ---------- Sự kiện không phải sửa bảng (xuất file, …) ----------
create or replace function public.log_audit_event(p_action text, p_entity text, p_entity_id text default null, p_details jsonb default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_action not in ('export', 'print', 'view_sensitive', 'impersonate') then
    raise exception 'Loại sự kiện không hợp lệ: %', p_action;
  end if;
  select * into m from public.audit_request_meta();
  insert into public.audit_log (actor_id, action, entity, entity_id, after_data, reason, ip, user_agent)
  values (auth.uid(), p_action, left(p_entity, 80), left(p_entity_id, 120), p_details,
          coalesce(left(nullif(trim(p_reason), ''), 500), m.reason), m.ip, m.user_agent);
end $$;

revoke all on function public.log_audit_event(text, text, text, jsonb, text) from public;
grant execute on function public.log_audit_event(text, text, text, jsonb, text) to authenticated;
