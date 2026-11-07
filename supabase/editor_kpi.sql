-- ============================================================
-- KPI EDITOR (chạy lại vẫn an toàn)
-- Chỉ tiêu tháng của editor = kpi_targets.target_clips (số video ĐƯỢC DUYỆT trong tháng).
-- Admin đã có quyền (policy admin_all). Bổ sung:
--   Giám đốc Marketing (is_marketing_director(), xem marketing_director.sql): xem / giao / sửa KPI
--   của nhân sự có vai trò editor (role hoặc role_2).
--   Editor xem KPI của chính mình: đã có (policy staff_read_own).
-- ============================================================

create or replace function public.is_editor(p_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = p_id and (p.role::text = 'editor' or p.role_2::text = 'editor'))
$$;
revoke all on function public.is_editor(uuid) from public;
grant execute on function public.is_editor(uuid) to authenticated;

drop policy if exists "mktdir_kpi_editor" on public.kpi_targets;
create policy "mktdir_kpi_editor" on public.kpi_targets for all to authenticated
  using (public.is_marketing_director() and public.is_editor(staff_id))
  with check (public.is_marketing_director() and public.is_editor(staff_id));

notify pgrst, 'reload schema';

-- Kiểm tra:
--   select p.full_name, k.month, k.year, k.target_clips from kpi_targets k join profiles p on p.id = k.staff_id
--   where public.is_editor(k.staff_id) order by k.year desc, k.month desc;
