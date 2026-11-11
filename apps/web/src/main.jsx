import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App.jsx';
import '@fontsource-variable/inter';
import '@/index.css';
import { resolveNotifLink } from '@/lib/notif';
import AppUpdateWatcher from '@/components/AppUpdateWatcher.jsx';
import { initBackNav } from '@/lib/backNav';
import RootErrorBoundary from '@/components/RootErrorBoundary.jsx';
import ReasonPromptHost from '@/components/ReasonPrompt.jsx';
import { safeReload, isChunkError, cleanReloadParam } from '@/lib/safeReload';

// ===== CHỐNG MÀN HÌNH TRẮNG (PWA iPhone mở lại sau khi app có bản mới) =====
cleanReloadParam();
window.__APP_BOOTED = true;   // báo cho "chó canh" trong index.html là app đã chạy
// Vite báo không tải được file code phụ -> tải lại lấy bản mới
window.addEventListener('vite:preloadError', (e) => { e.preventDefault?.(); safeReload('vite:preloadError'); });
window.addEventListener('unhandledrejection', (e) => { if (isChunkError(e.reason)) safeReload('chunk error (promise)'); });
window.addEventListener('error', (e) => { if (isChunkError(e.error || e.message)) safeReload('chunk error'); });
// iOS khôi phục trang từ bộ nhớ (bfcache) mà khung app trống -> tải lại
window.addEventListener('pageshow', (e) => {
  if (e.persisted && !document.getElementById('root')?.childElementCount) safeReload('pageshow empty');
});

// Nút Back / vuốt quay lại: đóng hộp thoại, ngăn kéo, về màn trước
initBackNav();

// Đăng ký service worker (PWA + Web Push) + cầu nối bấm thông báo -> điều hướng.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'NOTIF_NAV' && e.data.link) {
      const dest = resolveNotifLink(e.data.link);
      if (dest) window.dispatchEvent(new CustomEvent('NAVIGATE', { detail: dest }));
    }
  });
}

// Bàn phím điện thoại (nhất là iPhone) đè lên đáy màn hình nhưng KHÔNG thu nhỏ trang
// -> form trượt từ dưới bị che mất nút Lưu. Ghi lại vùng còn nhìn thấy để CSS cho form
// co vừa phần phía trên bàn phím (--vvh, --vv-top; xem ethics-ui.css).
if (window.visualViewport) {
  const vv = window.visualViewport;
  const setVV = () => {
    const st = document.documentElement.style;
    st.setProperty('--vvh', `${Math.round(vv.height)}px`);
    st.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    // Form vừa co lại vì bàn phím -> cuộn ô đang gõ vào giữa để vẫn thấy chữ mình gõ
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.closest('.e-modal')) {
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
  };
  setVV();
  vv.addEventListener('resize', setVV);
  vv.addEventListener('scroll', setVV);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <BrowserRouter>
      <App />
      <AppUpdateWatcher />
      <ReasonPromptHost />
    </BrowserRouter>
  </RootErrorBoundary>
);
