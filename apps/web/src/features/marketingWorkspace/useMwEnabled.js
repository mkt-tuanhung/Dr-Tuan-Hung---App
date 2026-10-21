// Cờ bật Marketing Workspace (clinic_settings.mw_enabled) cho menu.
// - Chưa chạy SQL / lỗi đọc -> coi như TẮT (menu y như trước).
// - Nhớ giá trị gần nhất trong localStorage để tải lại trang không bị "nháy" mất tab đang mở.
// - Admin bật / tắt -> phát sự kiện MW_FLAG_CHANGED để menu cập nhật ngay.
import { useEffect, useState } from 'react';
import { mwApi } from './mwApi';

const KEY = 'mw_enabled_cache';
const EVT = 'MW_FLAG_CHANGED';
let inflight = null;

const readCache = () => { try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; } };
const writeCache = (on) => { try { window.localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* bỏ qua */ } };

export function announceMwEnabled(on) {
  writeCache(on);
  window.dispatchEvent(new CustomEvent(EVT, { detail: !!on }));
}

export function useMwEnabled(active = true) {
  const [on, setOn] = useState(readCache);
  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    inflight = inflight || mwApi.enabled().finally(() => { setTimeout(() => { inflight = null; }, 0); });
    inflight.then(v => { if (alive) { setOn(v); writeCache(v); } });
    const onEvt = (e) => setOn(!!e.detail);
    window.addEventListener(EVT, onEvt);
    return () => { alive = false; window.removeEventListener(EVT, onEvt); };
  }, [active]);
  return on;
}
