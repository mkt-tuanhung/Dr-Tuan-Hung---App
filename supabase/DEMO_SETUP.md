# Dựng bản DEMO để "khoe" hệ thống mà KHÔNG lộ data khách thật

Mục tiêu: cho người mua đăng nhập bằng tài khoản **admin** xem được **toàn bộ** tính năng,
nhưng **không thấy dữ liệu khách hàng thật**.

> ⚠️ Nguyên tắc bảo mật quan trọng: app tải dữ liệu **trực tiếp xuống trình duyệt**.
> Vì vậy **che ở giao diện là KHÔNG đủ** (người rành kỹ thuật mở Network tab vẫn thấy).
> Cách an toàn thật sự là: dữ liệu khách thật **không được tồn tại** trong bản demo.
> → Ta dựng **một project Supabase DEMO riêng** + **một bản web demo riêng**.

---

## Cách A — Clone rồi ẩn danh (khuyên dùng, nhìn "đầy đủ như thật")

Ý tưởng: nhân bản toàn bộ cấu trúc + dữ liệu sang project demo, rồi **ghi đè mọi thông tin
khách bằng dữ liệu giả**. Kết quả: demo trông đầy đủ, số liệu/biểu đồ vẫn đẹp, nhưng tên/SĐT/
ảnh/ghi âm/transcript đều là giả.

### 1. Tạo project Supabase DEMO
- Vào https://supabase.com → **New project** (đặt tên `dr-tuan-hung-DEMO`).
- Lưu lại `Project URL` và `anon key` (dùng cho web demo ở bước 5).

### 2 + 3. Clone dữ liệu và ẩn danh — CHẠY 1 LỆNH
Đã gói sẵn thành script [`demo_clone.sh`](./demo_clone.sh): nó tự dump cấu trúc + dữ liệu từ
project thật, nạp sang demo, rồi chạy ẩn danh. Cần cài Postgres client (`pg_dump`, `psql`).

```bash
# Lấy 2 chuỗi kết nối ở: Supabase → Project Settings → Database → Connection string → URI
export PROD_URI='postgresql://postgres:...@db.xxx.supabase.co:5432/postgres'   # project THẬT
export DEMO_URI='postgresql://postgres:...@db.yyy.supabase.co:5432/postgres'   # project DEMO (trống)

bash supabase/demo_clone.sh
```
> Script tự: (1) nạp cấu trúc, (2) gỡ ràng buộc khoá ngoại `profiles→auth.users` để nạp
> được dữ liệu nhân sự mà **không cần copy tài khoản đăng nhập thật**, (3) nạp dữ liệu,
> (4) chạy [`demo_anonymize.sql`](./demo_anonymize.sql) thay **mọi** tên/SĐT/ghi chú/
> transcript/ảnh/ghi âm bằng dữ liệu giả. Vài cảnh báo "already exists" khi nạp là bình thường.

Chạy tay (nếu không dùng script): nạp `pg_dump --schema=public` (schema rồi data) vào demo,
chạy `ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;`, rồi mở
**SQL Editor** dán [`demo_anonymize.sql`](./demo_anonymize.sql) → Run.

Kiểm tra lại (phải là tên/SĐT giả):
```sql
select customer_name, phone from customer_appointments limit 20;
select full_name, phone from profiles limit 20;
```

> Vì không copy tài khoản đăng nhập thật, các nhân sự chỉ còn là **dòng dữ liệu** (đủ để hiển
> thị tên trong app), không ai đăng nhập được — đúng ý: chỉ 1 admin demo bạn tạo ở bước 4 mới vào được.

### 4. Tạo tài khoản ADMIN demo (làm SAU bước 3)
- Supabase DEMO → **Authentication → Add user**: email `admin@demo.local`, đặt mật khẩu.
- Copy `User UID` vừa tạo, rồi chạy trong SQL Editor:
```sql
insert into public.profiles (id, employee_id, full_name, role, is_active)
values ('<USER_UID_VỪA_TẠO>', 'DEMO01', 'Quản trị Demo', 'admin', true)
on conflict (id) do update set role = 'admin', full_name = 'Quản trị Demo';
```
→ Đây là tài khoản bạn đưa cho người mua.

### 5. Deploy MỘT bản web demo trỏ vào project demo
- Tạo project hosting mới (Vercel/Netlify) từ cùng repo này, hoặc thêm 1 domain khác.
- Đặt biến môi trường **trỏ vào DEMO**:
  - `VITE_SUPABASE_URL` = URL project demo
  - `VITE_SUPABASE_ANON_KEY` = anon key project demo
  - (Các key khác như R2/LiveKit: để trống hoặc dùng bucket demo riêng — ảnh/ghi âm đã bị xoá URL nên sẽ không hiện đồ thật.)
- Deploy → được 1 link demo riêng (vd `demo.tenmien.com`). Gửi link này + tài khoản admin demo cho người mua.

### 6. Khoá lại cho an toàn
- Supabase DEMO → **Authentication → Providers → Email**: **tắt "Enable sign ups"** (không cho tự đăng ký).
- Không gắn Storage/R2 thật vào bản demo (tránh upload đè lên dữ liệu thật).
- Xem xong / bán xong: có thể **xoá hẳn project demo** để dọn sạch.

---

## Cách B — Data giả hoàn toàn (không đụng tới 1 byte data thật)

An toàn tuyệt đối về mặt riêng tư, nhưng tốn công tạo dữ liệu mẫu.

1. Tạo project Supabase DEMO.
2. Chỉ nạp **cấu trúc** (schema-only), KHÔNG nạp dữ liệu:
   ```bash
   pg_dump "<PROD_URI>" --schema=public --schema-only --no-owner --no-privileges -f schema_only.sql
   psql "<DEMO_URI>" -f schema_only.sql
   ```
3. Tạo vài tài khoản nhân sự demo qua **Authentication → Add user** (admin, kế toán, sale, cskh, media…), rồi insert `profiles` cho từng người.
4. Chèn dữ liệu mẫu giả (khách hàng, lịch hẹn, thu chi, kho, lương…). *Việc này cần một script seed riêng — nếu bạn chọn Cách B, báo mình sẽ soạn `demo_seed.sql` khớp đúng các UID nhân sự bạn vừa tạo.*
5. Deploy web demo + tài khoản admin như Cách A (bước 5–6).

---

## So sánh nhanh

| | Cách A (clone + ẩn danh) | Cách B (data giả thuần) |
|---|---|---|
| Độ an toàn | Cao — buyer không thấy data thật | Cao nhất — data thật không hề có mặt |
| Nhìn "đầy đủ" | ✅ đầy đủ, số liệu đẹp sẵn | Phụ thuộc số liệu mình seed |
| Công sức | Thấp (1 lần clone + chạy 1 script) | Cao hơn (tự dựng dữ liệu mẫu) |
| Rủi ro | Data thật nằm tạm ở DB demo tới khi chạy ẩn danh (bạn tự kiểm soát) | Không |

**Khuyến nghị:** dùng **Cách A**. Nhanh, demo nhìn thuyết phục, và sau khi chạy `demo_anonymize.sql`
thì người mua tuyệt đối không chạm được data khách thật.
