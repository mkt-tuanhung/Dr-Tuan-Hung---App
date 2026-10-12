import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App.jsx';
import '@fontsource-variable/inter';
import '@/index.css';
import { resolveNotifLink } from '@/lib/notif';
import AppUpdateWatcher from '@/components/AppUpdateWatcher.jsx';

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
  <BrowserRouter>
    <App />
    <AppUpdateWatcher />
  </BrowserRouter>
);
