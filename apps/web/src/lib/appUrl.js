// URL gốc (production) của app — nơi DUY NHẤT để đổi khi đổi domain/Vercel.
// Ưu tiên biến môi trường VITE_APP_URL (đặt trong Vercel → Settings → Environment
// Variables) để đổi domain KHÔNG cần sửa code; nếu chưa đặt thì dùng link Vercel
// hiện tại. Bỏ dấu "/" ở cuối để nối path cho gọn.
export const APP_URL = (
  import.meta.env.VITE_APP_URL || 'https://dr-tuan-hung-app-web-ujkb.vercel.app'
).replace(/\/$/, '');
