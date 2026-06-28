// ============================================================
// r2Client — upload qua Edge Function `r2-upload` (proxy), không chứa secret.
// Trình duyệt gửi file (FormData) cho function → function tự đẩy lên R2.
// Hàm uploadToR2(file, folder) giữ NGUYÊN chữ ký + giá trị trả về (URL công khai).
// ============================================================
import { supabase } from '@/lib/supabaseClient';

export const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

export const uploadToR2 = async (file, folder = 'avatars') => {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);

  const { data, error } = await supabase.functions.invoke('r2-upload', { body: form });
  if (error) throw new Error('Upload thất bại: ' + error.message);
  if (data?.error) throw new Error(data.error);

  // URL công khai để lưu vào DB / hiển thị (giống bản cũ)
  return data.publicUrl;
};

// Upload THẲNG lên R2 qua presigned URL (không qua Edge Function) — dùng cho file lớn
// như audio chất lượng cao, không vướng giới hạn dung lượng. Trả về URL công khai.
export const uploadViaPresign = async (file, folder = 'misc') => {
  const { data, error } = await supabase.functions.invoke('r2-presign', { body: { folder, filename: file.name } });
  if (error) throw new Error('Không lấy được link tải lên: ' + error.message);
  if (data?.error) throw new Error(data.error);
  const put = await fetch(data.uploadUrl, { method: 'PUT', body: file });
  if (!put.ok) throw new Error('Tải lên R2 thất bại (HTTP ' + put.status + ')');
  return data.publicUrl;
};
