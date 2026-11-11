// Hộp chọn LÝ DO dùng chung toàn app: askReason({...}) -> Promise<{ code, note, text } | null>
// (Mất / Chốt Fail / Bong / Không đến / Dời lịch). Gắn <ReasonPromptHost /> 1 lần ở gốc app.
import React, { useEffect, useState } from 'react';

export const LOST_REASONS = ['Giá / chi phí', 'Chưa đến thời điểm', 'Không liên lạc được', 'Chọn nơi khác', 'Không phù hợp / không đủ điều kiện', 'Trùng / sai số', 'Khác'];
export const BONG_REASONS = ['Giá / chi phí', 'Chưa sắp xếp được thời gian', 'Sợ đau / sợ rủi ro', 'Gia đình không đồng ý', 'Chọn nơi khác', 'Không phù hợp chỉ định', 'Khác'];
export const NO_SHOW_REASONS = ['Bận đột xuất', 'Quên lịch', 'Đổi ý / chưa muốn làm', 'Không liên lạc được', 'Thời tiết / đi lại', 'Khác'];
export const RESCHEDULE_REASONS = ['Khách xin đổi giờ', 'Khách bận đột xuất', 'Lịch bác sĩ / phòng khám', 'Chờ xét nghiệm / chuẩn bị', 'Khác'];

const EV = 'ASK_REASON';
export function askReason({ title = 'Chọn lý do', subtitle = '', options = LOST_REASONS, required = true } = {}) {
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent(EV, { detail: { title, subtitle, options, required, resolve } })));
}

export default function ReasonPromptHost() {
  const [req, setReq] = useState(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    const on = (e) => { setReq(e.detail); setCode(''); setNote(''); };
    window.addEventListener(EV, on);
    return () => window.removeEventListener(EV, on);
  }, []);
  if (!req) return null;
  const close = (val) => { req.resolve(val); setReq(null); };
  const ok = () => {
    if (req.required && !code) return;
    const text = [code, note.trim()].filter(Boolean).join(' — ');
    close({ code, note: note.trim(), text });
  };
  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4" onClick={() => close(null)}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-2">
          <div className="font-bold text-slate-900 text-[16px]">{req.title}</div>
          {req.subtitle && <div className="text-[13px] text-slate-500 mt-0.5">{req.subtitle}</div>}
        </div>
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {req.options.map(o => (
            <button key={o} onClick={() => setCode(o)}
              className={`px-3 h-10 rounded-xl text-[13.5px] font-semibold border transition ${code === o ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-700 border-slate-200'}`}>{o}</button>
          ))}
        </div>
        <div className="px-5 pb-3">
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ghi thêm (không bắt buộc)…"
            className="w-full px-3 py-2 text-[14px] rounded-xl border border-slate-200 focus:border-teal-400 outline-none resize-none" />
        </div>
        <div className="px-5 pb-5 flex gap-2" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <button onClick={() => close(null)} className="h-11 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold">Huỷ</button>
          <button onClick={ok} disabled={req.required && !code} className="flex-1 h-11 rounded-xl bg-teal-600 text-white font-bold disabled:opacity-40">Xác nhận</button>
        </div>
      </div>
    </div>
  );
}
