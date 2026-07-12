import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw, Download } from 'lucide-react';

// Popup xem ảnh có zoom (cuộn / double-click / nút) + kéo di chuyển + prev/next.
export default function ImageLightbox({ images = [], index = 0, onClose }) {
  const [i, setI] = useState(index);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const pinch = useRef(null);

  const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }); }, []);
  useEffect(() => { setI(index); }, [index]);
  useEffect(() => { reset(); }, [i, reset]);

  const prev = useCallback((e) => { e?.stopPropagation(); setI(v => (v - 1 + images.length) % images.length); }, [images.length]);
  const next = useCallback((e) => { e?.stopPropagation(); setI(v => (v + 1) % images.length); }, [images.length]);
  const zoomIn = () => setScale(s => Math.min(6, Math.round((s + 0.5) * 10) / 10));
  const zoomOut = () => setScale(s => Math.max(1, Math.round((s - 0.5) * 10) / 10));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose, prev, next]);

  const onWheel = (e) => { e.preventDefault(); setScale(s => Math.min(6, Math.max(1, Math.round((s + (e.deltaY < 0 ? 0.3 : -0.3)) * 10) / 10))); };
  const onDown = (e) => { if (scale <= 1) return; e.preventDefault(); drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMove = (e) => { if (!drag.current) return; setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };

  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e) => {
    if (e.touches.length === 2) pinch.current = { d: dist(e.touches), s: scale };
    else if (e.touches.length === 1 && scale > 1) drag.current = { x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y };
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch.current) {
      const ratio = dist(e.touches) / pinch.current.d;
      setScale(Math.min(6, Math.max(1, Math.round(pinch.current.s * ratio * 10) / 10)));
    } else if (e.touches.length === 1 && drag.current) {
      setPos({ x: e.touches[0].clientX - drag.current.x, y: e.touches[0].clientY - drag.current.y });
    }
  };
  const onTouchEnd = () => { pinch.current = null; drag.current = null; };

  if (!images.length) return null;
  const src = images[i];

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center select-none animate-in fade-in duration-150"
      onClick={onClose} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>

      {/* Thanh trên */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-3 sm:p-4 z-10" onClick={e => e.stopPropagation()}>
        <span className="text-white/90 text-sm font-medium bg-white/10 px-3 py-1.5 rounded-full">{i + 1} / {images.length}</span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={zoomOut} title="Thu nhỏ" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"><ZoomOut className="w-5 h-5" /></button>
          <span className="text-white/80 text-xs font-semibold w-12 text-center hidden sm:block">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} title="Phóng to" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"><ZoomIn className="w-5 h-5" /></button>
          <button onClick={reset} title="Về mặc định" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"><RotateCcw className="w-5 h-5" /></button>
          <a href={src} target="_blank" rel="noreferrer" title="Mở/Tải ảnh" onClick={e => e.stopPropagation()} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"><Download className="w-5 h-5" /></a>
          <button onClick={onClose} title="Đóng" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
          <button onClick={next} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10 transition-colors"><ChevronRight className="w-6 h-6" /></button>
        </>
      )}

      {/* Ảnh */}
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
        onWheel={onWheel}
        onMouseDown={onDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        draggable={false}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'zoom-in', transition: drag.current || pinch.current ? 'none' : 'transform 0.12s ease-out' }}
        className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl touch-none"
      />

      <div className="absolute bottom-3 inset-x-0 text-center text-white/45 text-[11px] px-4" onClick={e => e.stopPropagation()}>
        Cuộn / chụm 2 ngón để zoom · kéo để di chuyển · double-click để phóng to
      </div>
    </div>
  );
}
