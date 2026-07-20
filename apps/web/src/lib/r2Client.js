// ============================================================
// r2Client — upload qua Edge Function `r2-upload` (proxy), không chứa secret.
// Trình duyệt gửi file (FormData) cho function → function tự đẩy lên R2.
// Hàm uploadToR2(file, folder) giữ NGUYÊN chữ ký + giá trị trả về (URL công khai).
// ============================================================
import { supabase } from '@/lib/supabaseClient';

export const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

// Nén/thu nhỏ ảnh trước khi upload (ảnh chụp điện thoại rất nặng -> đẩy qua Edge Function dễ lỗi).
// Trả về File JPEG nhỏ gọn; nếu không nén được thì giữ nguyên file gốc.
export const compressImage = async (file, { maxDim = 1600, quality = 0.82 } = {}) => {
  const t = (file?.type || '').toLowerCase();
  if (!t.startsWith('image/') || t === 'image/svg+xml' || t === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    let { width, height } = bmp;
    if (Math.max(width, height) > maxDim) {
      const s = maxDim / Math.max(width, height);
      width = Math.round(width * s); height = Math.round(height * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(bmp, 0, 0, width, height);
    bmp.close?.();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // không nhỏ hơn thì giữ nguyên
    return new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // trình duyệt cũ / lỗi -> giữ nguyên
  }
};

export const uploadToR2 = async (file, folder = 'avatars') => {
  const toSend = await compressImage(file);
  const attempt = () => {
    const form = new FormData();
    form.append('file', toSend);
    form.append('folder', folder);
    return supabase.functions.invoke('r2-upload', { body: form });
  };
  let res = await attempt();
  if (res.error) res = await attempt();   // thử lại 1 lần nếu lỗi mạng/tạm thời
  const { data, error } = res;
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
