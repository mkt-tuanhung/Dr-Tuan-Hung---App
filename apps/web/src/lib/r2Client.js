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
