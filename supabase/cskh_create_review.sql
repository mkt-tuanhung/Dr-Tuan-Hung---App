-- (21/11/2026) Cho phép ADMIN và CSKH (role hoặc role_2) tạo phiếu đánh giá dịch vụ (QR).
-- Thay cho chặn "chỉ admin" trong only_admin_create_review.sql. An toàn chạy lại.
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
declare v_token text; v_ok boolean;
begin
  select (p.role::text in ('admin', 'cskh') or coalesce(p.role_2::text, '') in ('admin', 'cskh')) into v_ok
    from profiles p where p.id = auth.uid();
  if not coalesce(v_ok, false) then
    raise exception 'Chỉ admin hoặc CSKH mới được tạo phiếu đánh giá';
  end if;

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

notify pgrst, 'reload schema';
