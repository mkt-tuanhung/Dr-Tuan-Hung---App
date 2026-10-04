// ============================================================
// PIPELINE KHÁCH HÀNG — chế độ xem dạng cột thẻ (theo Ethics BOS
// features/crm/PipelinePage). Chỉ là CÁCH XEM khác của cùng dữ liệu
// marketing_data; đổi giai đoạn dùng lại đúng hàm quickStatus của trang.
// ============================================================
import React, { useState } from 'react';
import { UserRound, MessagesSquare, CircleCheckBig, HeartHandshake, Clock3, ArrowRightLeft, X, XCircle } from 'lucide-react';

export const PIPELINE_COLUMNS = [
  { id: 'potential', label: 'Tiềm năng', stages: ['tiep_can', 'nong', 'tiem_nang', 'sai_gon'], icon: UserRound,
    head: 'bg-rose-50 border-rose-100', ink: 'text-rose-600', iconBg: 'bg-white text-rose-500' },
  { id: 'consulting', label: 'Đang tư vấn', stages: ['da_hen_lich'], icon: MessagesSquare,
    head: 'bg-blue-50 border-blue-100', ink: 'text-blue-600', iconBg: 'bg-white text-blue-500' },
  { id: 'closed', label: 'Đã chốt', stages: ['coc'], icon: CircleCheckBig,
    head: 'bg-emerald-50 border-emerald-100', ink: 'text-emerald-600', iconBg: 'bg-white text-emerald-500' },
  { id: 'care', label: 'Chăm sóc sau DV', stages: ['da_lam_dv'], icon: HeartHandshake,
    head: 'bg-sky-50 border-sky-100', ink: 'text-sky-600', iconBg: 'bg-white text-sky-500' },
];
export const LOST_STAGES = ['chot_fail', 'mat'];
const PAGE = 8;

const columnOf = (status) => PIPELINE_COLUMNS.find(c => c.stages.includes(status || 'tiep_can'))?.id || (LOST_STAGES.includes(status) ? 'lost' : 'potential');
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const AVA = ['bg-teal-600', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-emerald-600'];
const avaColor = (s) => AVA[[...String(s || '')].reduce((t, c) => t + c.charCodeAt(0), 0) % AVA.length];
const timeAgo = (iso) => {
  if (!iso) return 'Chưa liên hệ';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${Math.max(1, m)} phút trước`;
  const h = Math.round(m / 60); if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24); return d < 30 ? `${d} ngày trước` : `${Math.round(d / 30)} tháng trước`;
};

function LeadCard({ r, STATUS, isDue, phoneView, me, canWrite, onOpen, onAskMove, dragging, setDragging }) {
  const due = isDue(r.next_call_at);
  const st = STATUS[r.status] || STATUS.tiep_can;
  return (
    <article
      draggable={canWrite}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(r.id)); e.dataTransfer.effectAllowed = 'move'; setDragging(r.id); }}
      onDragEnd={() => setDragging(null)}
      onClick={() => onOpen(r)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(r)}
      tabIndex={0}
      className={`group rounded-2xl bg-white border border-slate-200/80 shadow-soft p-3.5 cursor-pointer hover:shadow-card hover:border-teal-200 transition ${dragging === r.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className={`w-11 h-11 rounded-full ${avaColor(r.customer_name)} text-white grid place-items-center text-[13px] font-bold shrink-0`}>{initials(r.customer_name)}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-900 truncate">{r.customer_name || '(Chưa có tên)'}</div>
          <div className="text-[12px] text-slate-500 truncate tabular-nums">{phoneView(r.phone, me)}{r.source ? ` · ${r.source}` : ''}</div>
        </div>
        {canWrite && (
          <button onClick={(e) => { e.stopPropagation(); onAskMove(r); }} title="Chuyển giai đoạn"
            className="w-7 h-7 rounded-lg grid place-items-center text-slate-300 hover:text-teal-700 hover:bg-teal-50 shrink-0">
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        )}
      </div>
      {(r.description || r.last_exchange) && <p className="text-[12.5px] text-slate-600 mt-2 line-clamp-2">{r.description || r.last_exchange}</p>}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        {r.customer_group && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 truncate max-w-[110px]">{r.customer_group}</span>}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px]">
        <span className="text-slate-500 truncate" title="Telesale phụ trách">{r.telesale?.full_name || 'Chưa phân công'}</span>
        <span className={`inline-flex items-center gap-1 shrink-0 ${due ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
          <Clock3 className="w-3.5 h-3.5" />{due ? 'Tới hạn gọi lại' : timeAgo(r.last_contact_at)}
        </span>
      </div>
    </article>
  );
}

function MoveDialog({ r, toCol, STATUS, onClose, onConfirm }) {
  const [col, setCol] = useState(toCol || columnOf(r.status));
  const stagesOf = (c) => (c === 'lost' ? LOST_STAGES : PIPELINE_COLUMNS.find(x => x.id === c)?.stages || []);
  const [stage, setStage] = useState(() => {
    const s = stagesOf(toCol || columnOf(r.status));
    return s.includes(r.status) ? r.status : s[0];
  });
  const pickCol = (c) => { setCol(c); const s = stagesOf(c); setStage(s.includes(r.status) ? r.status : s[0]); };
  const lost = col === 'lost';
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-float p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[17px] font-bold text-slate-900">{lost ? 'Đánh dấu khách thất bại' : 'Chuyển giai đoạn'}</div>
            <div className="text-[13px] text-slate-500 mt-0.5"><b className="text-slate-800">{r.customer_name}</b> · hiện tại: {STATUS[r.status]?.label || 'Tiếp cận'}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[...PIPELINE_COLUMNS, { id: 'lost', label: 'Thất bại', icon: XCircle }].map(c => (
            <button key={c.id} onClick={() => pickCol(c.id)}
              className={`h-10 rounded-xl border text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition ${col === c.id ? (c.id === 'lost' ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-teal-500 bg-teal-50 text-teal-800') : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <c.icon className="w-4 h-4" />{c.label}
            </button>
          ))}
        </div>
        {stagesOf(col).length > 1 && (
          <>
            <div className="text-[12.5px] font-semibold text-slate-600 mt-4 mb-1.5">Giai đoạn cụ thể</div>
            <div className="flex flex-wrap gap-1.5">
              {stagesOf(col).map(s => (
                <button key={s} onClick={() => setStage(s)}
                  className={`px-3 h-8 rounded-lg text-[12.5px] font-semibold border transition ${stage === s ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{STATUS[s]?.label || s}</button>
              ))}
            </div>
          </>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button onClick={() => onConfirm(r, stage)} disabled={!stage || stage === r.status}
            className={`h-10 px-4 rounded-xl text-white text-[13.5px] font-semibold disabled:opacity-40 ${lost ? 'bg-rose-500 hover:bg-rose-600' : 'bg-teal-600 hover:bg-teal-700'}`}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

export default function PipelineBoard({ rows, STATUS, isDue, phoneView, me, canWrite, onOpen, onMove }) {
  const [limit, setLimit] = useState({});
  const [showLost, setShowLost] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [move, setMove] = useState(null); // { r, toCol }

  const byCol = Object.fromEntries(PIPELINE_COLUMNS.map(c => [c.id, rows.filter(r => c.stages.includes(r.status || 'tiep_can'))]));
  const lostRows = rows.filter(r => LOST_STAGES.includes(r.status));
  const cardProps = { STATUS, isDue, phoneView, me, canWrite, onOpen, dragging, setDragging, onAskMove: (r) => setMove({ r }) };

  const drop = (e, colId) => {
    e.preventDefault(); setOverCol(null);
    const id = e.dataTransfer.getData('text/plain');
    const r = rows.find(x => String(x.id) === id);
    if (r && columnOf(r.status) !== colId) setMove({ r, toCol: colId });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="hidden sm:block text-[12.5px] text-slate-500">{canWrite ? 'Kéo thả thẻ sang cột khác (hoặc bấm ⇄ trên thẻ) để chuyển giai đoạn · bấm thẻ để mở hồ sơ 360°' : 'Bấm thẻ để mở hồ sơ khách hàng 360°'}</div>
        <label className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={showLost} onChange={e => setShowLost(e.target.checked)} className="accent-teal-600 w-4 h-4" />
          Hiện khách thất bại <span className="text-slate-400">({lostRows.length})</span>
        </label>
      </div>

      <div className="flex lg:grid lg:grid-cols-4 gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0 pb-2 items-start">
        {PIPELINE_COLUMNS.map(c => {
          const list = byCol[c.id];
          const shown = limit[c.id] ?? PAGE;
          const due = list.filter(r => isDue(r.next_call_at)).length;
          return (
            <section key={c.id}
              onDragOver={(e) => { if (canWrite) { e.preventDefault(); setOverCol(c.id); } }}
              onDragLeave={() => setOverCol(o => (o === c.id ? null : o))}
              onDrop={(e) => canWrite && drop(e, c.id)}
              className={`snap-start shrink-0 w-[82vw] sm:w-[300px] lg:w-auto rounded-2xl p-2 space-y-2.5 transition ${overCol === c.id ? 'bg-teal-50 ring-2 ring-teal-300' : 'bg-slate-100/60'}`}>
              <div className={`rounded-xl border ${c.head} px-3.5 py-3 flex items-center gap-3`}>
                <span className={`w-10 h-10 rounded-xl grid place-items-center shadow-soft ${c.iconBg}`}><c.icon className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] font-semibold truncate ${c.ink}`}>{c.label}</div>
                  <div className="text-[24px] font-bold text-slate-900 leading-tight tabular-nums">{list.length.toLocaleString('vi-VN')}</div>
                </div>
                {due > 0 && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-white text-rose-600 shrink-0" title="Khách tới hạn gọi lại">{due} cần gọi</span>}
              </div>
              {list.length === 0
                ? <div className="rounded-xl border-2 border-dashed border-slate-200 text-center text-[12.5px] text-slate-400 py-8">{canWrite ? 'Kéo khách hàng vào đây' : 'Chưa có khách'}</div>
                : list.slice(0, shown).map(r => <LeadCard key={r.id} r={r} {...cardProps} />)}
              {list.length > shown && (
                <button onClick={() => setLimit(l => ({ ...l, [c.id]: shown + PAGE * 2 }))}
                  className="w-full h-9 rounded-xl bg-white border border-slate-200 text-[12.5px] font-semibold text-slate-600 hover:text-teal-700 hover:border-teal-300">
                  Xem thêm ({(list.length - shown).toLocaleString('vi-VN')})
                </button>
              )}
            </section>
          );
        })}
      </div>

      {showLost && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-soft p-4">
          <div className="text-[14.5px] font-bold text-slate-900 mb-3">Khách thất bại ({lostRows.length})</div>
          {lostRows.length === 0 ? <div className="text-[13px] text-slate-400">Không có khách thất bại</div> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {lostRows.slice(0, limit.lost ?? 12).map(r => <LeadCard key={r.id} r={r} {...cardProps} />)}
            </div>
          )}
          {lostRows.length > (limit.lost ?? 12) && (
            <button onClick={() => setLimit(l => ({ ...l, lost: (l.lost ?? 12) + 24 }))} className="mt-3 h-9 px-4 rounded-xl border border-slate-200 text-[12.5px] font-semibold text-slate-600">Xem thêm</button>
          )}
        </div>
      )}

      {move && <MoveDialog r={move.r} toCol={move.toCol} STATUS={STATUS} onClose={() => setMove(null)} onConfirm={(r, s) => { onMove(r, s); setMove(null); }} />}
    </div>
  );
}
