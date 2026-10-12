// Tự phát hiện bản app mới (sau mỗi lần deploy Vercel) cho máy đang mở app lâu ngày
// — nhất là app "thêm vào màn hình chính" trên iPhone: không bao giờ tự tải lại nên chạy mãi bản cũ.
// Cách làm: đọc lại index.html (không dùng cache), so tên file JS chính (/assets/index-<hash>.js)
// với file đang chạy. Khác -> có bản mới:
//   - quay lại app (mở lại / chuyển tab) mà KHÔNG có form nào đang mở -> tự tải lại
//   - còn lại -> hiện thanh "Có bản cập nhật mới · Tải lại" (không làm mất dữ liệu đang nhập)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const ENTRY_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

const currentEntry = () => {
  const s = [...document.querySelectorAll('script[type="module"][src]')].map(e => e.getAttribute('src')).find(src => ENTRY_RE.test(src || ''));
  return s ? s.match(ENTRY_RE)[0] : null;
};
// Đang mở form / ngăn chi tiết -> không tự tải lại kẻo mất dữ liệu đang nhập
const hasOpenOverlay = () => !!document.querySelector('.e-modal-backdrop, [role="dialog"], .fixed.inset-0');

export default function AppUpdateWatcher() {
  const [ready, setReady] = useState(false);
  const current = useRef(currentEntry());

  const check = useCallback(async () => {
    if (!current.current) return false;
    try {
      const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' });
      const m = (await res.text()).match(ENTRY_RE);
      if (m && m[0] !== current.current) { setReady(true); return true; }
    } catch { /* mất mạng: thử lại lần sau */ }
    return false;
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !current.current) return undefined;
    const first = setTimeout(check, 30 * 1000);
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onShow = async () => {
      if (document.visibilityState !== 'visible') return;
      const hasNew = ready || await check();
      if (hasNew && !hasOpenOverlay()) window.location.reload();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow); };
  }, [check, ready]);

  if (!ready) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-slate-900 text-white shadow-float pl-4 pr-1.5 py-1.5 text-[13.5px] max-w-full">
        <span className="min-w-0 truncate">Có bản cập nhật mới của app</span>
        <button type="button" onClick={() => window.location.reload()}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 font-semibold">
          <RefreshCw className="w-4 h-4" />Tải lại
        </button>
      </div>
    </div>
  );
}
