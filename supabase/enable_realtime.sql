-- Bật realtime cho các bảng cần tự cập nhật (duyệt qua Telegram phản ánh ngay lên giao diện)
do $$ begin alter publication supabase_realtime add table leave_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table expenses; exception when duplicate_object then null; end $$;
