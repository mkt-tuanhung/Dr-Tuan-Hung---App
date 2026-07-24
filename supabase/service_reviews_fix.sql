-- ============================================================
-- VÁ LỖI "Tạo phiếu đánh giá" — chạy 1 lần trên Supabase (SQL Editor).
-- An toàn chạy lại. Cần đã chạy service_reviews.sql trước đó.
-- Nguyên nhân: bảng mới bị RLS chặn ghi. Chuyển việc tạo phiếu sang
-- RPC SECURITY DEFINER (bỏ qua RLS an toàn) + cấp lại quyền/chính sách.
-- ============================================================

-- 1) Cấp quyền bảng cho vai trò đăng nhập (phòng khi default privileges chưa áp)
grant usage on schema public to anon, authenticated;
grant select, insert, update on service_review_invitations   to authenticated;
grant select, insert, update on service_review_responses     to authenticated;
grant select on service_review_templates    to authenticated;
grant select on service_review_questions     to authenticated;
grant select on service_review_fraud_signals to authenticated;

-- 2) Bảo đảm chính sách RLS tồn tại
drop policy if exists sr_inv_read   on service_review_invitations;
create policy sr_inv_read   on service_review_invitations for select to authenticated using (true);
drop policy if exists sr_inv_insert on service_review_invitations;
create policy sr_inv_insert on service_review_invitations for insert to authenticated with check (true);
drop policy if exists sr_inv_update on service_review_invitations;
create policy sr_inv_update on service_review_invitations for update to authenticated using (true);

-- 3) RPC tạo phiếu (bỏ qua RLS an toàn — chạy bằng quyền chủ bảng)
create or replace function create_review_invitation(
  p_appointment_id uuid,
  p_customer_name  text,
  p_phone          text,
  p_service        text,
  p_surgery_date   date,
  p_staff          jsonb,
  p_created_by     uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_token text;
begin
  -- Dùng lại phiếu chưa hoàn thành nếu có
  select token into v_token
    from service_review_invitations
   where appointment_id = p_appointment_id and status in ('pending', 'opened')
   order by created_at desc
   limit 1;
  if v_token is not null then return v_token; end if;

  insert into service_review_invitations
    (appointment_id, customer_name, phone, service, surgery_date, staff_snapshot, milestone, channel, created_by)
  values
    (p_appointment_id, p_customer_name, p_phone, p_service, p_surgery_date,
     coalesce(p_staff, '{}'::jsonb), 'D14_30', 'qr', p_created_by)
  returning token into v_token;

  return v_token;
end;
$$;

grant execute on function create_review_invitation(uuid, text, text, text, date, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
