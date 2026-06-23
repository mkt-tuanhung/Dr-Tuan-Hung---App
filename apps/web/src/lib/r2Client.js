// ============================================================
// r2Client (BẢN MỚI — an toàn, không chứa secret)
//
// Cách dùng: sau khi đã deploy Edge Function `r2-upload` và cấu hình
// biến môi trường R2 trên Supabase (xem supabase/functions/r2-upload/README.md),
// thì THAY THẾ file r2Client.js hiện tại bằng nội dung file này:
//
//     mv r2Client.new.js r2Client.js   (ghi đè bản cũ)
//
// Hàm uploadToR2(file, folder) giữ NGUYÊN chữ ký + giá trị trả về (URL công khai),
// nên 7 trang đang import KHÔNG cần sửa gì.
//
// Sau khi đổi xong, có thể bỏ các biến VITE_R2_ACCESS_KEY_ID /
// VITE_R2_SECRET_ACCESS_KEY khỏi .env frontend và ROTATE (đổi) key R2.
// ============================================================
import { supabase } from '@/lib/supabaseClient';

export const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

export const uploadToR2 = async (file, folder = 'avatars') => {
  // 1. Xin presigned URL từ Edge Function (đã xác thực qua session đăng nhập)
  const { data, error } = await supabase.functions.invoke('r2-upload', {
    body: { fileName: file.name, contentType: file.type, folder },
  });
  if (error) throw new Error('Không lấy được link upload: ' + error.message);
  if (data?.error) throw new Error(data.error);

  // 2. Upload thẳng file lên R2 bằng presigned URL
  const res = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Upload thất bại (HTTP ' + res.status + ')');

  // 3. Trả về URL công khai để lưu vào DB / hiển thị (giống bản cũ)
  return data.publicUrl;
};
