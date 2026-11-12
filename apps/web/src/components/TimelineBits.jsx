// Mảnh giao diện dùng chung cho dòng thời gian: nhãn bộ phận (màu riêng) + ảnh / video đi kèm ghi chú
import React, { useState } from 'react';
import { Film, X } from 'lucide-react';
import { deptStyle } from '@/lib/departments';

export const DeptTag = ({ dept, name }) => {
  const d = deptStyle(dept);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: d.c, background: '#fff', border: `1px solid ${d.bd}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.c }} />{d.label}{name ? <span className="font-semibold opacity-80">· {name}</span> : null}
    </span>
  );
};
const isVid = (u) => /\.(mp4|mov|m4v|webm|3gp|avi|mkv)(\?|$)/i.test(String(u || ''));
// Ảnh / video NGAY TRONG thẻ ghi chú — bấm để xem lớn
export const MediaThumbs = ({ urls = [], size = 64 }) => {
  const [open, setOpen] = useState(null);
  if (!Array.isArray(urls) || !urls.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {urls.map(u => (
          <button key={u} type="button" onClick={(e) => { e.stopPropagation(); setOpen(u); }} className="relative rounded-lg overflow-hidden border border-white/70 shadow-sm bg-slate-100" style={{ width: size, height: size }}>
            {isVid(u) ? <><video src={u} muted playsInline preload="metadata" className="w-full h-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/25"><Film className="w-5 h-5 text-white" /></span></>
              : <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />}
          </button>
        ))}
      </div>
      {open && (
        <div data-back-close className="fixed inset-0 z-[130] bg-black/90 grid place-items-center p-3" onClick={() => setOpen(null)}>
          <button type="button" aria-label="Đóng" onClick={() => setOpen(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white grid place-items-center"><X className="w-5 h-5" /></button>
          {isVid(open) ? <video src={open} controls autoPlay playsInline className="max-w-full max-h-[90vh] rounded-lg" onClick={e => e.stopPropagation()} />
            : <img src={open} alt="" className="max-w-full max-h-[90vh] rounded-lg object-contain" onClick={e => e.stopPropagation()} />}
        </div>
      )}
    </>
  );
};
// Thẻ 1 mục dòng thời gian theo màu bộ phận
export const DeptCard = ({ dept, children, className = '' }) => {
  const d = deptStyle(dept);
  return <div className={`rounded-xl px-3 py-2.5 border ${className}`} style={{ background: d.bg, borderColor: d.bd, borderLeft: `4px solid ${d.c}` }}>{children}</div>;
};
