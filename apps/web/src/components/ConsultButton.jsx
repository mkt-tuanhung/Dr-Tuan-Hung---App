import React, { useState, useRef } from 'react';
import { ImagePlus, X, Plus, Minus, Download, ChevronLeft, ChevronRight } from 'lucide-react';

// Nút + modal xem Hồ sơ tư vấn (consult_note + consult_image_urls) + trình xem ảnh có zoom
export default function ConsultButton({ app, className }) {
  const [open, setOpen] = useState(false);
  const [viewIdx, setViewIdx] = useState(null); // ảnh đang xem (index)
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const imgs = app?.consult_image_urls || [];
  if (!imgs.length && !app?.consult_note) return null;

  const openViewer = (i) => { setViewIdx(i); setScale(1); setPos({ x: 0, y: 0 }); };
  const closeViewer = () => setViewIdx(null);
  const zoomIn = () => setScale(s => Math.min(5, +(s + 0.5).toFixed(1)));
  const zoomOut = () => setScale(s => { const n = Math.max(1, +(s - 0.5).toFixed(1)); if (n <= 1) setPos({ x: 0, y: 0 }); return n; });
  const onWheel = (e) => { setScale(s => { const n = Math.min(5, Math.max(1, +(s + (e.deltaY < 0 ? 0.3 : -0.3)).toFixed(2))); if (n <= 1) setPos({ x: 0, y: 0 }); return n; }); };
  const nav = (d) => { setViewIdx(i => (i + d + imgs.length) % imgs.length); setScale(1); setPos({ x: 0, y: 0 }); };
  const onMouseDown = (e) => { if (scale <= 1) return; dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMouseMove = (e) => { if (!dragRef.current) return; setPos({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y }); };
  const endDrag = () => { dragRef.current = null; };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={className || 'flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200'}>
        <ImagePlus className="w-4 h-4" /> Hồ sơ tư vấn
      </button>

      {open && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b bg-teal-50 shrink-0">
              <div>
                <h3 className="font-bold text-teal-800">Hồ sơ tư vấn</h3>
                <p className="text-xs text-teal-500 mt-0.5">{app.customer_name} · {app.phone}</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {app.consult_note && <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap">{app.consult_note}</div>}
              {imgs.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {imgs.map((u, i) => (
                    <img key={i} src={u} alt="" onClick={() => openViewer(i)} className="w-full h-28 rounded-xl object-cover border border-slate-200 cursor-zoom-in hover:opacity-90 transition-opacity" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewIdx !== null && imgs[viewIdx] && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col" onClick={closeViewer}>
          {/* Thanh công cụ */}
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-semibold">{viewIdx + 1} / {imgs.length}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={zoomOut} disabled={scale <= 1} title="Thu nhỏ" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
              <span className="text-sm w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
              <button onClick={zoomIn} disabled={scale >= 5} title="Phóng to" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              <a href={imgs[viewIdx]} download target="_blank" rel="noreferrer" title="Tải về" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center ml-1"><Download className="w-4 h-4" /></a>
              <button onClick={closeViewer} title="Đóng" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
          </div>
          {/* Khu vực ảnh */}
          <div className="flex-1 flex items-center justify-center overflow-hidden relative select-none"
            onClick={e => e.stopPropagation()} onWheel={onWheel} onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}>
            {imgs.length > 1 && <button onClick={() => nav(-1)} className="absolute left-3 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><ChevronLeft className="w-6 h-6" /></button>}
            <img src={imgs[viewIdx]} alt="" draggable={false} onMouseDown={onMouseDown} onDoubleClick={() => { if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }); } else setScale(2); }}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in' }}
              className="max-w-[92vw] max-h-[80vh] object-contain" />
            {imgs.length > 1 && <button onClick={() => nav(1)} className="absolute right-3 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><ChevronRight className="w-6 h-6" /></button>}
          </div>
          <div className="text-center text-white/50 text-xs pb-3 shrink-0" onClick={e => e.stopPropagation()}>Lăn chuột để zoom · kéo để di chuyển · nhấp đúp để phóng to</div>
        </div>
      )}
    </>
  );
}
