-- ============================================================
-- Vị trí nhân viên SEEDING
-- - Thêm role 'seeding'
-- - Cho seeding đọc khách nguồn Seeding (doanh thu + hoa hồng chung team)
-- - Cho seeding xem Kho media & Video Ads (chỉ đọc)
-- Chạy trong Supabase SQL Editor.
-- ============================================================

-- 1) Thêm giá trị enum role (an toàn, chạy lại nhiều lần không sao)
alter type user_role add value if not exists 'seeding';

-- 2) Seeding đọc khách nguồn Seeding (để xem doanh thu + tính hoa hồng)
--    So sánh role bằng ::text để không vướng lỗi "dùng enum mới trong cùng transaction".
drop policy if exists "seeding_read_appointments" on customer_appointments;
create policy "seeding_read_appointments" on customer_appointments for select using (
  customer_source = 'Seeding'
  and exists (
    select 1 from profiles p
    where p.id = auth.uid() and (p.role::text = 'seeding' or coalesce(p.role_2::text, '') = 'seeding')
  )
);

-- 3) Seeding xem Kho media & Video Ads (chỉ đọc)
drop policy if exists "seeding_read_media_customers" on media_customers;
create policy "seeding_read_media_customers" on media_customers for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text = 'seeding' or coalesce(p.role_2::text, '') = 'seeding'))
);

drop policy if exists "seeding_read_media_clips" on media_clips;
create policy "seeding_read_media_clips" on media_clips for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and (p.role::text = 'seeding' or coalesce(p.role_2::text, '') = 'seeding'))
);

-- Ghi chú:
-- • Cộng đồng & Phòng họp: seeding truy cập được sẵn (chính sách cho mọi user đã đăng nhập).
-- • Sau khi chạy xong, vào Quản lý Nhân sự tạo/đổi nhân viên sang vai trò "Seeding".
-- • Hoa hồng = 20% × (Doanh thu − Viện phí) cho ca mổ nguồn Seeding (tính trong trang "Doanh thu Seeding").
