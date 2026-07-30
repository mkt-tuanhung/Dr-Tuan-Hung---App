import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App.jsx';
import '@/index.css';
import { resolveNotifLink } from '@/lib/notif';

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
