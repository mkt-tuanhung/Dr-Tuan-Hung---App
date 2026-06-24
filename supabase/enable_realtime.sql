-- Bật realtime cho mọi bảng cần tự cập nhật ngay (không phải reload)
do $$
declare t text;
begin
  foreach t in array array[
    'leave_requests','expenses','attendance','customer_appointments',
    'cash_flows','payroll','inventory_transactions','inventory_items',
    'marketing_ads_performance','notifications'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; when undefined_table then null;
    end;
  end loop;
end $$;
