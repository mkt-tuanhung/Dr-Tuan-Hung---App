// ============================================================
// TRÌNH ĐỌC TÀI LIỆU — lật trang 3D
// - Máy tính / màn rộng: 2 trang như cuốn sách (bìa đứng riêng bên phải); điện thoại: 1 trang
// - Lật trang: bấm mép trái/phải, vuốt / kéo trang, phím ← →; tờ giấy xoay 3D quanh gáy sách
// - Mục lục theo chương, tìm kiếm trong tài liệu, kéo thanh trang, phóng to, toàn màn hình
// - Ghi nhận đọc: trang hiển thị >= 3 giây = đã đọc; chỉ đếm thời gian khi app đang mở
//   và có thao tác trong 2 phút gần nhất -> gửi log_library_reading mỗi 15 giây
// pdf.js chỉ được nạp khi mở trình đọc (file này được lazy-load).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, List, Search, ZoomIn, ZoomOut, Maximize, Minimize, Loader2, BookOpen,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { loadPdfjs, chapterOf, chapterLabel, normQuery, snippetOf, cleanText } from './libraryUtil';

const SEEN_AFTER_MS = 3000;
const FLUSH_EVERY_MS = 15000;
const IDLE_AFTER_MS = 120000;
const FLIP_MS = 700;
const CACHE_MAX = 28;
const PAPER = '#FBFAF7';

// ---------- Ảnh trang (render pdf.js -> JPEG, có bộ nhớ đệm) ----------
function usePageImages(pdf, wantWidth) {
  const cache = useRef(new Map());   // page -> { w, url }
  const queue = useRef([]);
  const running = useRef(false);
  const [, bump] = useState(0);
  const want = Math.max(300, Math.min(2400, Math.ceil(wantWidth / 100) * 100));

  useEffect(() => () => { cache.current.forEach(c => URL.revokeObjectURL(c.url)); cache.current.clear(); }, [pdf]);

  const pump = useCallback(async () => {
    if (running.current || !pdf) return;
    running.current = true;
    while (queue.current.length) {
      const { n, w } = queue.current.shift();
      const have = cache.current.get(n);
      if (have && have.w >= w) continue;
      try {
        const page = await pdf.getPage(n);
        const vp1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: w / vp1.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
        canvas.width = 0; canvas.height = 0;
        if (blob) {
          const old = cache.current.get(n);
          if (old) URL.revokeObjectURL(old.url);
          cache.current.delete(n);
          cache.current.set(n, { w, url: URL.createObjectURL(blob) });
          while (cache.current.size > CACHE_MAX) {
            const [k, v] = cache.current.entries().next().value;
            URL.revokeObjectURL(v.url); cache.current.delete(k);
          }
          bump(x => x + 1);
        }
      } catch { /* trang lỗi -> bỏ qua, hiện giấy trắng */ }
    }
    running.current = false;
  }, [pdf]);

  // Ưu tiên các trang truyền vào theo thứ tự
  const request = useCallback((pages) => {
    if (!pdf) return;
    const list = pages.filter(n => n >= 1 && n <= pdf.numPages);
    queue.current = [...list.map(n => ({ n, w: want })), ...queue.current.filter(q => !list.includes(q.n))].slice(0, 16);
    pump();
  }, [pdf, want, pump]);

  const urlOf = (n) => {
    const c = cache.current.get(n);
    if (c) { cache.current.delete(n); cache.current.set(n, c); }   // LRU: vừa dùng -> cuối hàng
    return c?.url || null;
  };
  return { request, urlOf };
}

// ---------- Ghi nhận đọc ----------
function useReadingTracker(docId, visiblePages, active) {
  const seen = useRef(new Set());
  const secs = useRef(0);
  const lastPage = useRef(visiblePages[0] || null);
  const lastAct = useRef(Date.now());
  const opened = useRef(false);
  const key = visiblePages.join(',');

  const flush = useCallback(async (force = false) => {
    const pages = [...seen.current];
    const s = secs.current;
    const open = !opened.current;
    if (!force && !pages.length && s < 1 && !open) return;
    seen.current = new Set(); secs.current = 0; opened.current = true;
    const { error } = await supabase.rpc('log_library_reading', { p_doc: docId, p_pages: pages, p_seconds: Math.round(s), p_last_page: lastPage.current, p_open: open });
    if (error) { pages.forEach(p => seen.current.add(p)); secs.current += s; if (open) opened.current = false; }
  }, [docId]);
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  // Trang hiển thị đủ 3 giây -> tính là đã đọc
  useEffect(() => {
    if (!active || !visiblePages.length) return undefined;
    lastPage.current = visiblePages[0];
    const t = setTimeout(() => visiblePages.forEach(p => seen.current.add(p)), SEEN_AFTER_MS);
    return () => clearTimeout(t);
  }, [key, active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const poke = () => { lastAct.current = Date.now(); };
    const evs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    evs.forEach(e => window.addEventListener(e, poke, { passive: true }));
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastAct.current < IDLE_AFTER_MS) secs.current += 1;
    }, 1000);
    const timer = setInterval(() => flushRef.current(), FLUSH_EVERY_MS);
    const onVis = () => { if (document.visibilityState === 'hidden') flushRef.current(); else lastAct.current = Date.now(); };
    const onHide = () => flushRef.current();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    flushRef.current(true);   // lượt mở
    return () => {
      evs.forEach(e => window.removeEventListener(e, poke));
      clearInterval(tick); clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      flushRef.current();
    };
  }, []);
}

// ---------- Bố cục trang ----------
const spreadOf = (p) => (p <= 1 ? 0 : Math.floor(p / 2));
const spreadPages = (s, n) => {
  const left = s === 0 ? null : 2 * s;
  const right = s === 0 ? 1 : (2 * s + 1 <= n ? 2 * s + 1 : null);
  return [left, right];
};

function PageFace({ url, n, shade = 0, side }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: PAPER }}>
      {n && url && <img src={url} alt={`Trang ${n}`} draggable={false} className="absolute inset-0 w-full h-full object-contain select-none" />}
      {n && !url && <div className="absolute inset-0 grid place-items-center"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>}
      {/* bóng gáy sách */}
      {side && (
        <div className="absolute inset-y-0 w-10 pointer-events-none" style={{
          [side === 'left' ? 'right' : 'left']: 0,
          background: `linear-gradient(${side === 'left' ? 'to left' : 'to right'}, rgba(0,0,0,.16), rgba(0,0,0,0))`,
        }} />
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.22), rgba(0,0,0,.04))', opacity: shade, transition: `opacity ${FLIP_MS}ms ease` }} />
    </div>
  );
}

export default function BookReader({ doc, startPage = 1, onClose }) {
  const N = doc.page_count || 0;
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [loadPct, setLoadPct] = useState(0);
  const [loadErr, setLoadErr] = useState('');
  const [numPages, setNumPages] = useState(N);
  const [ratio, setRatio] = useState(595 / 420);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [cur, setCur] = useState(Math.max(1, startPage));
  const [flip, setFlip] = useState(null);   // { dir, to, angle, anim, drag }
  const [panel, setPanel] = useState(null); // 'toc' | 'search' | null
  const [zoom, setZoom] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [slider, setSlider] = useState(null);

  // Nạp PDF (đọc dần theo từng đoạn nếu máy chủ hỗ trợ)
  useEffect(() => {
    let alive = true;
    let task = null;
    (async () => {
      try {
        const lib = await loadPdfjs();
        task = lib.getDocument({ url: doc.file_url, rangeChunkSize: 262144, disableAutoFetch: true });
        task.onProgress = ({ loaded, total }) => { if (alive && total) setLoadPct(Math.round(loaded / total * 100)); };
        const p = await task.promise;
        if (!alive) { p.destroy(); return; }
        const first = await p.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width);
        setNumPages(p.numPages);
        setPdf(p);
      } catch (e) {
        if (alive) setLoadErr(e?.message || 'Không mở được tài liệu');
      }
    })();
    return () => { alive = false; task?.destroy?.(); };
  }, [doc.file_url]);
  useEffect(() => () => { pdf?.destroy?.(); }, [pdf]);

  // Khoá cuộn trang nền
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = numPages || N;
  const spread = !zoom && stage.w >= 820 && stage.w / stage.h > 1.05;
  const pageH = Math.max(0, Math.min(stage.h, (spread ? stage.w / 2 : stage.w) * ratio));
  const pageW = pageH / ratio;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const zoomW = Math.min(stage.w * (stage.w < 820 ? 2 : 1.25), 1600);
  const { request, urlOf } = usePageImages(pdf, (zoom ? zoomW : pageW) * dpr);

  // Chuẩn hoá trang hiện tại theo bố cục
  const curSpread = spreadOf(cur);
  const visible = useMemo(() => {
    if (spread) return spreadPages(curSpread, total).filter(Boolean);
    return [Math.min(Math.max(1, cur), Math.max(1, total))];
  }, [spread, curSpread, cur, total]);

  useEffect(() => {
    if (!pdf) return;
    const a = visible[0];
    const b = visible[visible.length - 1];
    request([...visible, b + 1, b + 2, a - 1, a - 2, b + 3, b + 4]);
  }, [pdf, visible, request]);

  useReadingTracker(doc.id, pdf ? visible : [], !!pdf && !flip);

  const canNext = spread ? 2 * (curSpread + 1) <= total : cur < total;
  const canPrev = spread ? curSpread > 0 : cur > 1;

  // ----- Lật trang -----
  const startFlip = useCallback((dir, { drag = false } = {}) => {
    if (flip || zoom) return false;
    if (dir === 'next' && !canNext) return false;
    if (dir === 'prev' && !canPrev) return false;
    const to = spread ? (spreadPages(dir === 'next' ? curSpread + 1 : curSpread - 1, total).find(Boolean)) : cur + (dir === 'next' ? 1 : -1);
    const from = !spread && dir === 'prev' ? -180 : 0;
    setFlip({ dir, to, angle: from, from, end: dir === 'next' ? -180 : (spread ? 180 : 0), anim: false, drag });
    if (!drag) requestAnimationFrame(() => requestAnimationFrame(() => setFlip(f => (f ? { ...f, angle: f.end, anim: true } : f))));
    return true;
  }, [flip, zoom, canNext, canPrev, spread, curSpread, total, cur]);

  // Kết thúc lật: ghi trang mới (trừ khi kéo dở rồi thả về) — có hẹn giờ dự phòng nếu lỡ sự kiện transitionend
  const flipRef = useRef(null);
  useEffect(() => { flipRef.current = flip; }, [flip]);
  const finishFlip = useCallback(() => {
    const f = flipRef.current;
    if (!f) return;
    if (!f.cancel) setCur(f.to);
    flipRef.current = null;
    setFlip(null);
  }, []);
  useEffect(() => {
    if (!flip?.anim) return undefined;
    const t = setTimeout(finishFlip, FLIP_MS + 250);
    return () => clearTimeout(t);
  }, [flip?.anim, flip?.angle, finishFlip]);

  const goTo = useCallback((p) => {
    const t = Math.min(Math.max(1, p), total);
    setFlip(null);
    setCur(t);
  }, [total]);
  const next = useCallback(() => { if (zoom) { if (cur < total) setCur(cur + 1); return; } startFlip('next'); }, [zoom, cur, total, startFlip]);
  const prev = useCallback(() => { if (zoom) { if (cur > 1) setCur(cur - 1); return; } startFlip('prev'); }, [zoom, cur, startFlip]);

  // Phím tắt
  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea/i.test(e.target?.tagName || '')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') { if (panel) setPanel(null); else if (!document.fullscreenElement) onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, panel, onClose]);

  // Kéo / vuốt để lật
  const ptr = useRef(null);
  const onPointerDown = (e) => {
    if (zoom || flip || e.button > 0) return;
    ptr.current = { x: e.clientX, y: e.clientY, t: Date.now(), dir: null, id: e.pointerId };
  };
  const onPointerMove = (e) => {
    const p = ptr.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    if (!p.dir) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(e.clientY - p.y)) return;
      const dir = dx < 0 ? 'next' : 'prev';
      if (!startFlip(dir, { drag: true })) { ptr.current = null; return; }
      p.dir = dir;
      try { stageRef.current?.setPointerCapture(p.id); } catch { /* bỏ qua */ }
    }
    const prog = Math.min(1, Math.max(0, (p.dir === 'next' ? -dx : dx) / (pageW || 300)));
    setFlip(f => (f ? { ...f, angle: f.from + (f.end - f.from) * prog, anim: false } : f));
  };
  const onPointerUp = (e) => {
    const p = ptr.current;
    ptr.current = null;
    if (!p) return;
    if (p.dir) {
      const dx = e.clientX - p.x;
      const prog = Math.min(1, Math.max(0, (p.dir === 'next' ? -dx : dx) / (pageW || 300)));
      const fast = Date.now() - p.t < 300 && Math.abs(dx) > 40;
      const done = prog > 0.3 || fast;
      const f = flipRef.current;
      if (!f) return;
      const target = done ? f.end : f.from;
      if (Math.abs(target - f.angle) < 0.5) { flipRef.current = { ...f, cancel: !done }; finishFlip(); return; }
      setFlip({ ...f, angle: target, anim: true, cancel: !done });
      return;
    }
    // Chạm: mép phải -> trang sau, mép trái -> trang trước
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || Date.now() - p.t > 500) return;
    const x = (e.clientX - r.left) / r.width;
    if (x > 0.62) next(); else if (x < 0.38) prev();
  };
  const onFlipTransitionEnd = (e) => {
    if (e.propertyName === 'transform' && e.target === e.currentTarget) finishFlip();
  };

  // Toàn màn hình
  const fsSupported = typeof document !== 'undefined' && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  useEffect(() => {
    const on = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); };
  }, []);
  const toggleFs = async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      else await (rootRef.current?.requestFullscreen?.() || rootRef.current?.webkitRequestFullscreen?.());
    } catch { /* bỏ qua */ }
  };

  const { chap, item } = chapterOf(doc.toc, visible[0] || 1);
  const pageLabel = visible.length > 1 ? `${visible[0]}–${visible[1]}` : `${visible[0] || 1}`;
  const shownSlider = slider ?? (visible[0] || 1);

  // ----- Vẽ sách -----
  const renderBook = () => {
    if (spread) {
      const [L, R] = spreadPages(curSpread, total);
      let staticL = L;
      let staticR = R;
      let leaf = null;
      if (flip) {
        const ts = spreadOf(flip.to);
        const [TL, TR] = spreadPages(ts, total);
        if (flip.dir === 'next') {
          staticR = TR;
          leaf = { side: 'right', front: R, back: TL };
        } else {
          staticL = TL;
          leaf = { side: 'left', front: L, back: TR };
        }
      }
      const a = flip?.angle || 0;
      return (
        <div className="relative" style={{ width: pageW * 2, height: pageH, perspective: pageW * 7 }}>
          <div className="absolute inset-0 rounded-[3px]" style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,.6)' }} />
          {staticL && <div className="absolute top-0 left-0 h-full" style={{ width: pageW }}><PageFace n={staticL} url={urlOf(staticL)} side="left" /></div>}
          {staticR && <div className="absolute top-0 right-0 h-full" style={{ width: pageW }}><PageFace n={staticR} url={urlOf(staticR)} side="right" /></div>}
          {leaf && (
            <div
              onTransitionEnd={onFlipTransitionEnd}
              className="absolute top-0 h-full"
              style={{
                width: pageW, left: leaf.side === 'right' ? pageW : 0,
                transformStyle: 'preserve-3d',
                transformOrigin: leaf.side === 'right' ? 'left center' : 'right center',
                transform: `rotateY(${a}deg)`,
                transition: flip.anim ? `transform ${FLIP_MS}ms cubic-bezier(.35,.65,.25,1)` : 'none',
                zIndex: 5,
              }}
            >
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 0 30px rgba(0,0,0,.25)' }}>
                <PageFace n={leaf.front} url={urlOf(leaf.front)} side={leaf.side} shade={Math.abs(a) / 180 * 0.9} />
              </div>
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                {leaf.back
                  ? <PageFace n={leaf.back} url={urlOf(leaf.back)} side={leaf.side === 'right' ? 'left' : 'right'} shade={(1 - Math.abs(a) / 180) * 0.9} />
                  : <div className="absolute inset-0" style={{ background: PAPER }} />}
              </div>
            </div>
          )}
        </div>
      );
    }
    // 1 trang
    const p = visible[0] || 1;
    let under = p;
    let leaf = null;
    if (flip) {
      if (flip.dir === 'next') { under = flip.to; leaf = { front: p }; } else { under = p; leaf = { front: flip.to }; }
    }
    const a = flip?.angle || 0;
    return (
      <div className="relative" style={{ width: pageW, height: pageH, perspective: pageW * 5 }}>
        <div className="absolute inset-0" style={{ boxShadow: '0 24px 50px -18px rgba(0,0,0,.6)' }} />
        <div className="absolute inset-0"><PageFace n={under} url={urlOf(under)} /></div>
        {leaf && (
          <div
            onTransitionEnd={onFlipTransitionEnd}
            className="absolute inset-0"
            style={{
              transformStyle: 'preserve-3d', transformOrigin: 'left center',
              transform: `rotateY(${a}deg)`,
              transition: flip.anim ? `transform ${FLIP_MS}ms cubic-bezier(.35,.65,.25,1)` : 'none',
              zIndex: 5,
            }}
          >
            <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 0 24px rgba(0,0,0,.3)' }}>
              <PageFace n={leaf.front} url={urlOf(leaf.front)} shade={Math.abs(a) / 180 * 0.9} />
            </div>
            <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'linear-gradient(90deg,#efede6,#fbfaf7)' }} />
          </div>
        )}
      </div>
    );
  };

  const renderZoom = () => {
    const p = visible[0] || 1;
    const w = zoomW;
    return (
      <div className="absolute inset-0 overflow-auto overscroll-contain" style={{ touchAction: 'auto' }}>
        <div className="mx-auto my-3 shadow-2xl" style={{ width: w, height: w * ratio, background: PAPER, position: 'relative' }}>
          <PageFace n={p} url={urlOf(p)} />
        </div>
      </div>
    );
  };

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[70] flex flex-col text-white select-none" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #1A3F3A 0%, #0D2522 55%, #081815 100%)' }}>
      {/* Thanh trên */}
      <div className="shrink-0 flex items-center gap-2 px-2 sm:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button type="button" onClick={onClose} aria-label="Đóng" className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] sm:text-[15px] font-semibold truncate">{doc.title}</div>
          <div className="text-[11.5px] sm:text-[12px] truncate" style={{ color: '#D9B77A' }}>{chapterLabel(chap)}{item ? ` · ${item.title}` : ''}</div>
        </div>
        <button type="button" onClick={() => setPanel(p => (p === 'toc' ? null : 'toc'))} aria-label="Mục lục" className={`w-10 h-10 grid place-items-center rounded-full ${panel === 'toc' ? 'bg-white/15' : 'hover:bg-white/10'}`}><List className="w-5 h-5" /></button>
        <button type="button" onClick={() => setPanel(p => (p === 'search' ? null : 'search'))} aria-label="Tìm trong tài liệu" className={`w-10 h-10 grid place-items-center rounded-full ${panel === 'search' ? 'bg-white/15' : 'hover:bg-white/10'}`}><Search className="w-5 h-5" /></button>
        <button type="button" onClick={() => { setFlip(null); setZoom(z => !z); }} aria-label={zoom ? 'Thu nhỏ' : 'Phóng to'} className={`w-10 h-10 grid place-items-center rounded-full ${zoom ? 'bg-white/15' : 'hover:bg-white/10'}`}>{zoom ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}</button>
        {fsSupported && <button type="button" onClick={toggleFs} aria-label="Toàn màn hình" className="hidden sm:grid w-10 h-10 place-items-center rounded-full hover:bg-white/10">{isFs ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>}
      </div>

      {/* Sân khấu */}
      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0 px-3 sm:px-10 py-2 sm:py-4">
          <div
            ref={stageRef}
            className="relative w-full h-full grid place-items-center"
            style={{ touchAction: zoom ? 'auto' : 'pan-y' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { ptr.current = null; setFlip(f => (f?.drag ? { ...f, angle: f.from, anim: true, cancel: true } : f)); }}
          >
            {loadErr ? (
              <div className="text-center px-6"><div className="font-semibold">Không mở được tài liệu</div><div className="text-[13px] text-white/60 mt-1">{loadErr}</div></div>
            ) : !pdf ? (
              <div className="text-center">
                <BookOpen className="w-9 h-9 mx-auto mb-3" style={{ color: '#D9B77A' }} />
                <div className="text-[14px] font-medium">Đang mở tài liệu…</div>
                <div className="mt-3 w-48 h-1.5 rounded-full bg-white/15 overflow-hidden mx-auto"><div className="h-full transition-all" style={{ width: `${Math.max(6, loadPct)}%`, background: '#D9B77A' }} /></div>
              </div>
            ) : stage.w > 0 && (zoom ? renderZoom() : renderBook())}
          </div>
          {pdf && !zoom && (
            <>
              <button type="button" onClick={prev} disabled={!canPrev || !!flip} aria-label="Trang trước"
                className="hidden sm:grid absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 transition"><ChevronLeft className="w-6 h-6" /></button>
              <button type="button" onClick={next} disabled={!canNext || !!flip} aria-label="Trang sau"
                className="hidden sm:grid absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 transition"><ChevronRight className="w-6 h-6" /></button>
            </>
          )}
        </div>

        {panel && (
          <SidePanel kind={panel} doc={doc} currentPage={visible[0] || 1} onClose={() => setPanel(null)}
            onPick={(p) => { goTo(p); if (stage.w < 1100) setPanel(null); }} />
        )}
      </div>

      {/* Thanh dưới */}
      <div className="shrink-0 px-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
        <div className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={prev} disabled={!pdf || (zoom ? cur <= 1 : !canPrev)} aria-label="Trang trước" className="sm:hidden w-10 h-10 grid place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <input type="range" min={1} max={Math.max(1, total)} value={shownSlider} disabled={!pdf}
              onChange={(e) => setSlider(Number(e.target.value))}
              onPointerUp={(e) => { goTo(Number(e.currentTarget.value)); setSlider(null); }}
              onKeyUp={(e) => { goTo(Number(e.currentTarget.value)); setSlider(null); }}
              onTouchEnd={(e) => { goTo(Number(e.currentTarget.value)); setSlider(null); }}
              aria-label="Chọn trang" className="w-full accent-[#D9B77A] h-1.5 cursor-pointer" />
            <div className="mt-1 flex justify-between text-[11.5px] text-white/60 tabular-nums">
              <span>{slider != null ? `Tới trang ${slider}` : `Trang ${pageLabel} / ${total}`}</span>
              <span>{Math.round(((visible[visible.length - 1] || 1) / Math.max(1, total)) * 100)}%</span>
            </div>
          </div>
          <button type="button" onClick={next} disabled={!pdf || (zoom ? cur >= total : !canNext)} aria-label="Trang sau" className="sm:hidden w-10 h-10 grid place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- Ngăn Mục lục / Tìm kiếm ----------
function SidePanel({ kind, doc, currentPage, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const { chap: curChap } = chapterOf(doc.toc, currentPage);
  const [open, setOpen] = useState(() => new Set(curChap ? [curChap.page] : []));

  useEffect(() => { if (kind === 'search') setTimeout(() => inputRef.current?.focus(), 50); }, [kind]);
  useEffect(() => {
    if (kind !== 'search') return undefined;
    const qn = normQuery(q);
    if (qn.length < 2) { setRes(null); return undefined; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const esc = qn.replace(/[\\%_]/g, (m) => `\\${m}`);
      const { data } = await supabase.from('library_pages').select('page, text, text_norm').eq('doc_id', doc.id).ilike('text_norm', `%${esc}%`).order('page').limit(200);
      if (!alive) return;
      setRes((data || []).map(r => ({ page: r.page, snip: snippetOf(r.text, r.text_norm, qn), hits: r.text_norm.split(qn).length - 1 })));
      setBusy(false);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, kind, doc.id]);

  const toc = doc.toc || [];
  return (
    <aside className="absolute inset-y-0 right-0 z-20 w-full sm:w-[360px] lg:relative lg:z-auto shrink-0 flex flex-col bg-[#0B201D]/95 backdrop-blur border-l border-white/10" onPointerDown={(e) => e.stopPropagation()}>
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="text-[14px] font-semibold">{kind === 'toc' ? 'Mục lục' : 'Tìm trong tài liệu'}</div>
        <button type="button" onClick={onClose} aria-label="Đóng" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
      {kind === 'toc' ? (
        <div className="flex-1 overflow-y-auto overscroll-contain py-2">
          {!toc.length && <div className="px-4 py-6 text-[13px] text-white/60">Tài liệu này chưa có mục lục.</div>}
          {toc.map(c => {
            const isCur = curChap?.page === c.page;
            const isOpen = open.has(c.page);
            return (
              <div key={`${c.page}-${c.title}`} className="px-2">
                <div className={`flex items-center rounded-xl ${isCur ? 'bg-white/10' : ''}`}>
                  <button type="button" onClick={() => onPick(c.page)} className="flex-1 min-w-0 flex items-center gap-3 px-2.5 py-2.5 text-left">
                    <span className="w-8 shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: '#D9B77A' }}>{c.no || '•'}</span>
                    <span className="flex-1 min-w-0 text-[14px] font-medium leading-snug">{c.title}</span>
                    <span className="text-[12px] text-white/50 tabular-nums">{c.page}</span>
                  </button>
                  {c.items?.length > 0 && (
                    <button type="button" aria-label="Mở mục con" onClick={() => setOpen(s => { const n = new Set(s); if (n.has(c.page)) n.delete(c.page); else n.add(c.page); return n; })}
                      className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/10 text-white/60">
                      <ChevronRight className={`w-4 h-4 transition ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="ml-11 mb-1 border-l border-white/10">
                    {c.items.map(it => {
                      const active = currentPage >= it.page && chapterOf(doc.toc, currentPage).item?.page === it.page;
                      return (
                        <button key={`${it.page}-${it.title}`} type="button" onClick={() => onPick(it.page)}
                          className={`w-full flex items-center gap-2 pl-3 pr-2 py-1.5 text-left text-[13px] rounded-r-lg ${active ? 'text-white font-semibold bg-white/5' : 'text-white/75 hover:text-white hover:bg-white/5'}`}>
                          <span className="flex-1 min-w-0 leading-snug">{it.title}</span>
                          <span className="text-[11.5px] text-white/45 tabular-nums">{it.page}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ từ khoá, không cần dấu…"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/10 border border-white/10 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-[#D9B77A]/70" />
            </div>
            {!doc.indexed_at && <div className="mt-2 text-[12px] text-amber-300/90">Tài liệu chưa được lập chỉ mục tìm kiếm — nhờ Admin bấm "Lập chỉ mục".</div>}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
            {busy && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-white/60" /></div>}
            {!busy && res && !res.length && <div className="px-3 py-6 text-[13px] text-white/60">Không tìm thấy "{cleanText(q)}".</div>}
            {!busy && res?.length > 0 && <div className="px-3 pb-1 text-[12px] text-white/50">{res.length} trang có kết quả</div>}
            {!busy && res?.map(r => {
              const { chap, item } = chapterOf(doc.toc, r.page);
              return (
                <button key={r.page} type="button" onClick={() => onPick(r.page)} className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-white/5">
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate" style={{ color: '#D9B77A' }}>{chapterLabel(chap)}{item ? ` · ${item.title}` : ''}</span>
                    <span className="shrink-0 text-white/50 tabular-nums">Trang {r.page}{r.hits > 1 ? ` · ${r.hits} lần` : ''}</span>
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed text-white/80">
                    {r.snip.before}<mark className="bg-[#D9B77A]/30 text-white rounded px-0.5">{r.snip.match}</mark>{r.snip.after}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

