// ============================================================
// QUAY LẠI bằng nút Back / vuốt (Android, iPhone, iPhone Duo)
// App là 1 trang duy nhất (không đổi URL) nên trước đây Back / vuốt không quay về màn trước
// và không đóng được ngăn kéo / hộp thoại. Module này:
//  1) Mỗi LỚP PHỦ mở ra (hộp thoại, ngăn kéo: [role=dialog], [aria-modal], .e-drawer, .e-modal,
//     [data-back-close]) -> ghi 1 mục lịch sử. Back / vuốt -> đóng lớp trên cùng (bấm nút Đóng /
//     Quay lại / Huỷ của chính lớp đó, không có thì bấm nền, cuối cùng mới gửi phím Esc).
//     Lớp tự đóng bằng nút trong app -> bỏ mục lịch sử tương ứng.
//  2) Đổi màn (tab) -> AppShell gọi pushTab(); Back -> về màn trước (setTabHandler).
//  3) App cài ra màn hình chính (standalone) trên iPhone không có cử chỉ vuốt quay lại của hệ
//     thống -> tự xử lý vuốt từ mép trái màn hình.
// Lớp tự quản lịch sử riêng: gắn data-own-history để bỏ qua.
// ============================================================
const LAYER_SEL = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .e-drawer, .e-modal, [data-back-close]';
const CLOSE_RE = /^(đóng|quay lại|huỷ|hủy|close|×|✕|‹ danh sách)$/i;

const layers = [];          // [{ el, id }] theo thứ tự mở
let skipPops = 0;           // số lần popstate do chính module gọi history.back()
let tabHandler = null;
let seq = 0;
let started = false;

const st = () => (window.history.state && typeof window.history.state === 'object' ? window.history.state : {});
const push = (extra) => window.history.pushState({ ...st(), ...extra }, '');

export function setTabHandler(fn) { tabHandler = fn; }
export function pushTab(tab) { push({ __tab: tab, __ov: undefined }); }
export function markTab(tab) { window.history.replaceState({ ...st(), __tab: tab }, ''); }

const visible = (el) => el.isConnected && el.getClientRects().length > 0;
const isLayerRoot = (el) => !el.closest('[data-own-history]') && !(el.parentElement && el.parentElement.closest(LAYER_SEL));

function scan() {
  const found = [...document.querySelectorAll(LAYER_SEL)].filter(el => isLayerRoot(el) && visible(el));
  // lớp mới mở
  for (const el of found) {
    if (layers.some(l => l.el === el)) continue;
    const id = ++seq;
    layers.push({ el, id });
    push({ __ov: id });
  }
  // lớp đã đóng bằng nút trong app -> lùi mục lịch sử của nó (nếu đang ở trên cùng)
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (found.includes(l.el)) continue;
    layers.splice(i, 1);
    if (!l.byBack && st().__ov === l.id) { skipPops++; window.history.back(); }
  }
}

// Thử lần lượt (dừng khi lớp đã đóng): nút Đóng / Quay lại / Huỷ -> bấm nền -> phím Esc -> bấm vào nền lớp
// (lớp xem ảnh / sheet đóng khi bấm nền). Không đóng được (lớp bắt buộc) -> giữ lại mục lịch sử.
const STEPS = [
  (el) => {
    const btn = [...el.querySelectorAll('button, [role="button"]')].find(b => {
      const t = (b.getAttribute('aria-label') || b.textContent || '').trim();
      return CLOSE_RE.test(t) && !b.disabled;
    });
    if (!btn) return false;
    btn.click(); return true;
  },
  (el) => {
    const bd = el.previousElementSibling?.matches?.('.e-modal-backdrop, [data-backdrop]') ? el.previousElementSibling
      : el.parentElement?.querySelector(':scope > .e-modal-backdrop, :scope > [data-backdrop]')
        || el.querySelector(':scope > .e-modal-backdrop, :scope > [data-backdrop]');
    if (!bd) return false;
    bd.click(); return true;
  },
  (el) => {
    const ev = { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', ev));
    return true;
  },
  (el) => { if (!el.hasAttribute('data-back-close')) return false; el.click(); return true; },
];
function closeLayer(l, i = 0) {
  if (!visible(l.el)) return;
  if (i >= STEPS.length) { l.byBack = false; push({ __ov: l.id }); return; }
  const tried = STEPS[i](l.el);
  setTimeout(() => closeLayer(l, i + 1), tried ? 120 : 0);
}

function onPop(e) {
  if (skipPops > 0) { skipPops--; return; }
  const top = layers[layers.length - 1];
  if (top) { top.byBack = true; closeLayer(top); return; }
  const tab = e.state?.__tab;
  if (tab && tabHandler) tabHandler(tab);
}

// ---------- Vuốt từ mép trái (chỉ khi chạy như app cài ra màn hình chính) ----------
function edgeSwipe() {
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  if (!standalone) return;   // Safari / trình duyệt đã có cử chỉ vuốt riêng
  let s = null;
  let hint = null;
  const showHint = (dx) => {
    if (!hint) {
      hint = document.createElement('div');
      hint.setAttribute('aria-hidden', 'true');
      hint.style.cssText = 'position:fixed;left:0;top:50%;z-index:2147483000;width:40px;height:40px;margin-top:-20px;border-radius:9999px;background:rgba(15,23,42,.72);color:#fff;display:grid;place-items:center;font:600 22px/1 system-ui;pointer-events:none;transition:opacity .15s';
      hint.textContent = '‹';
      document.body.appendChild(hint);
    }
    const p = Math.min(1, dx / 90);
    hint.style.transform = `translateX(${Math.min(dx, 90) * 0.6 + 6}px) scale(${0.7 + p * 0.3})`;
    hint.style.opacity = String(0.3 + p * 0.7);
  };
  const clear = () => { hint?.remove(); hint = null; s = null; };
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const left = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-left')) || 0;
    s = e.touches.length === 1 && t.clientX <= 24 + left ? { x: t.clientX, y: t.clientY, ok: true } : null;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = Math.abs(t.clientY - s.y);
    if (dy > 40 && dy > dx) { clear(); return; }   // đang cuộn dọc
    if (dx > 8) showHint(dx);
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = Math.abs(t.clientY - s.y);
    clear();
    if (dx > 80 && dy < 60) window.history.back();
  }, { passive: true });
  window.addEventListener('touchcancel', clear, { passive: true });
}

export function initBackNav() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('popstate', onPop);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
  edgeSwipe();
}
