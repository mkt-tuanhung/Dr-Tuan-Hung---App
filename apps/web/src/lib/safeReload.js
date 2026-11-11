// Tải lại app AN TOÀN cho PWA "thêm vào màn hình chính" (iPhone):
//  • chỉ 1 lần trong 20 giây (tránh vòng lặp tải lại)
//  • trễ 1 nhịp sau khi app vừa hiện lại (iOS hay ra màn trắng nếu reload đúng lúc resume)
//  • thêm tham số _r để chắc chắn lấy index.html mới (bỏ qua bộ nhớ đệm), rồi app tự xoá tham số
const KEY = 'app_reload_at';
export function safeReload(reason = '') {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 20000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* private mode */ }
  console.warn('[app] tải lại:', reason);
  setTimeout(() => {
    const u = new URL(window.location.href);
    u.searchParams.set('_r', String(Date.now()));
    window.location.replace(u.toString());
  }, 350);
  return true;
}
// Lỗi tải file code (sau khi app có bản mới, file cũ không còn trên máy chủ)
export const isChunkError = (err) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk|Unable to preload CSS|MIME type/i
  .test(String(err?.message || err || ''));
// Xoá tham số _r khỏi địa chỉ sau khi đã tải lại xong
export function cleanReloadParam() {
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has('_r')) { u.searchParams.delete('_r'); window.history.replaceState(window.history.state, '', u.toString()); }
  } catch { /* bỏ qua */ }
}
