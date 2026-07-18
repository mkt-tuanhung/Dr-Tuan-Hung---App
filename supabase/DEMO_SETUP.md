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

### 2. Nhân bản CẤU TRÚC + DỮ LIỆU từ project thật sang demo
Dùng connection string (Database → Settings → Connection string → URI) của **cả 2** project.

```bash
# Cần cài Postgres client (pg_dump/psql). Thay <PROD_URI> và <DEMO_URI> bằng chuỗi thật.

# a) Dump toàn bộ (cả schema auth + public + dữ liệu). Bao gồm cả bảng đăng nhập.
pg_dump "<PROD_URI>" \
  --schema=public --schema=auth \
  --no-owner --no-privileges \
  -f dump_full.sql

# b) Nạp vào project DEMO
psql "<DEMO_URI>" -f dump_full.sql
```
> Nếu `psql` báo lỗi vài dòng về extension/owner có sẵn của Supabase → bỏ qua, không sao.
> Có thể thêm `--exclude-schema=storage` nếu không muốn kéo metadata file.

### 3. ⭐ ẨN DANH dữ liệu khách (bắt buộc, làm ngay)
Mở **SQL Editor của project DEMO** → dán toàn bộ file [`demo_anonymize.sql`](./demo_anonymize.sql) → Run.

Script này thay **mọi** tên/SĐT/ghi chú/transcript/ảnh/ghi âm bằng dữ liệu giả, và đổi cả
email đăng nhập của nhân viên. Nó có kiểm tra tồn tại bảng/cột nên an toàn.

Kiểm tra lại:
```sql
select customer_name, phone from customer_appointments limit 20;  -- phải là tên/SĐT giả
select full_name, phone from profiles limit 20;                    -- phải là tên/SĐT giả
```

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
