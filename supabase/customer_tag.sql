-- ============================================================
-- Tag khách theo SĐT: tìm khách (bỏ RLS) + lấy thẻ chi tiết có kiểm tra quyền
-- ============================================================

-- Tìm khách theo số điện thoại (ai cũng tag được; mỗi SĐT lấy bản mới nhất)
create or replace function search_customer_by_phone(q text)
returns table(id uuid, customer_name text, phone text)
language sql stable security definer set search_path = public as $$
  select t.id, t.customer_name, t.phone from (
    select distinct on (phone) id, customer_name, phone, updated_at
    from customer_appointments
    where phone ilike '%' || q || '%'
    order by phone, updated_at desc nulls last
  ) t order by t.updated_at desc nulls last limit 6;
$$;

-- Lấy thẻ thông tin khách + kiểm tra quyền theo bộ phận (ở DB)
create or replace function get_customer_card(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record; arole text; arole2 text; allowed boolean; roles text[];
begin
  select * into c from customer_appointments where id = p_id;
  if not found then return null; end if;
  select role, role_2 into arole, arole2 from profiles where id = auth.uid();
  if arole = 'admin' then
    allowed := true;
  else
    roles := case c.status
      when 'scheduled' then array['telesale','sale_offline','accountant','shareholder','cskh','dieu_duong','marketing']
      when 'coc' then array['telesale','sale_offline','accountant','shareholder','marketing']
      when 'bong' then array['telesale','sale_offline','cskh']
      when 'phau_thuat' then array['dieu_duong','cskh','accountant','shareholder']
      else array[]::text[] end;
    allowed := (arole = any(roles)) or (arole2 = any(roles));
  end if;
  if not allowed then return jsonb_build_object('denied', true); end if;
  return jsonb_build_object(
    'id', c.id, 'customer_name', c.customer_name, 'phone', c.phone,
    'service', c.service, 'status', c.status, 'surgery_date', c.surgery_date, 'notes', c.notes,
    'telesale', (select full_name from profiles where id = c.telesale_id),
    'sale', (select full_name from profiles where id = c.sale_id)
  );
end $$;
