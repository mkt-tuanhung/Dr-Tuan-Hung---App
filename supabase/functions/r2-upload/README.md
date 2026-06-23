# Edge Function `r2-upload` — Hướng dẫn deploy

Mục tiêu: đưa secret key R2 ra khỏi frontend. Sau khi làm xong, trình duyệt
không còn chứa key; mọi upload đi qua presigned URL do function ký.

## 1. Cấu hình biến môi trường (secret) cho function

Trên Supabase Dashboard → **Edge Functions → Manage secrets**, hoặc dùng CLI:

```bash
supabase secrets set \
  R2_ACCOUNT_ID=...        \
  R2_ACCESS_KEY_ID=...     \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=dr-tuanhung... \
  R2_PUBLIC_URL=https://...
```

> `SUPABASE_URL` và `SUPABASE_ANON_KEY` đã có sẵn trong môi trường Edge Function,
> không cần set lại.

## 2. Deploy function

```bash
supabase functions deploy r2-upload
```

## 3. Cấu hình CORS cho bucket R2

Vì trình duyệt `PUT` thẳng lên R2, cần bật CORS cho bucket (Cloudflare Dashboard →
R2 → bucket → Settings → CORS Policy):

```json
[
  {
    "AllowedOrigins": ["https://TEN-MIEN-CUA-BAN", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

## 4. Chuyển frontend sang bản mới

```bash
cd apps/web/src/lib
mv r2Client.new.js r2Client.js   # ghi đè bản cũ
```

Không cần sửa các trang đang dùng — hàm `uploadToR2(file, folder)` giữ nguyên.

## 5. Dọn key khỏi frontend & ROTATE

1. Xoá khỏi `apps/web/.env` 2 dòng:
   - `VITE_R2_ACCESS_KEY_ID`
   - `VITE_R2_SECRET_ACCESS_KEY`
   (Có thể giữ `VITE_R2_PUBLIC_URL` vì không phải bí mật.)
2. **Đổi (rotate) cặp key R2 trên Cloudflare** — vì key cũ đã từng bị đóng gói
   vào bundle nên coi như đã lộ. Cập nhật key mới vào secret của function (bước 1).
3. (Tuỳ chọn) Gỡ `@aws-sdk/client-s3` khỏi `apps/web/package.json` để giảm bundle:
   ```bash
   npm uninstall @aws-sdk/client-s3 --prefix apps/web
   ```

## 6. Kiểm thử

- Đăng nhập → đổi avatar / upload ảnh chứng từ → ảnh hiển thị bình thường.
- Mở DevTools → Network: chỉ thấy gọi `functions/v1/r2-upload` rồi `PUT` lên R2,
  KHÔNG còn secret trong file JS.
