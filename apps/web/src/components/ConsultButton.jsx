import React, { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

// Nút + modal xem Hồ sơ tư vấn (consult_note + consult_image_urls) của 1 khách
export default function ConsultButton({ app, className }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(null);
  const imgs = app?.consult_image_urls || [];
  if (!imgs.length && !app?.consult_note) return null;

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
                    <img key={i} src={u} alt="" onClick={() => setZoom(u)} className="w-full h-28 rounded-xl object-cover border border-slate-200 cursor-zoom-in hover:opacity-90" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-w-full max-h-[88vh] rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
