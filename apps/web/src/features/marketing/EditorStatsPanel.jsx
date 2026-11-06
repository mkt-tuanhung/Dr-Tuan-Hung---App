// ============================================================
// VIDEO ADS — THỐNG KÊ THEO THÁNG, THEO TỪNG EDITOR
//   Đã duyệt   : clip được duyệt chạy Ads (approved_to_run / stage done|approved)
//   Chờ duyệt  : editor đã gửi, Ads chưa xử lý (stage submitted, chưa duyệt)
//   Bị từ chối : Ads trả về "Cần sửa" (stage revision) — editor sửa & gửi lại thì về Chờ duyệt
// Clip tính vào THÁNG EDITOR GỬI DUYỆT (submitted_at, chưa có thì ngày tạo).
// ============================================================
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, RotateCcw, Film, Users } from 'lucide-react';

const statusOf = (c) => {
  if (c.approved_to_run || c.stage === 'done' || c.stage === 'approved') return 'approved';
  if (c.stage === 'revision') return 'rejected';
  if (c.stage === 'submitted') return 'pending';
  return null;   // đang dựng / nháp: chưa gửi duyệt
};
const monthOf = (c) => {
  const iso = c.submitted_at || c.created_at;
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3);   // giờ Việt Nam
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const thisMonth = () => { const d = new Date(Date.now() + 7 * 3600e3); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const monthLabel = (key) => { const [y, m] = key.split('-'); return `Tháng ${Number(m)}/${y}`; };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const TILES = [
  { k: 'total', label: 'Clip gửi duyệt', Icon: Film, cls: 'bg-teal-50 text-teal-700' },
  { k: 'approved', label: 'Đã duyệt', Icon: CheckCircle2, cls: 'bg-success-50 text-success-600' },
  { k: 'pending', label: 'Chờ duyệt', Icon: Clock, cls: 'bg-lavender-50 text-lavender-600' },
  { k: 'rejected', label: 'Bị từ chối', Icon: RotateCcw, cls: 'bg-danger-50 text-danger-600' },
];

export default function EditorStatsPanel({ clips, onOpenEditor }) {
  const [month, setMonth] = useState(thisMonth);

  const { rows, sum } = useMemo(() => {
    const by = {};
    clips.forEach(c => {
      const st = statusOf(c);
      if (!st || monthOf(c) !== month) return;
      const id = c.editor_id || 'none';
      if (!by[id]) by[id] = { id, name: c.editor?.full_name || (id === 'none' ? 'Chưa rõ editor' : 'Editor'), approved: 0, pending: 0, rejected: 0 };
      by[id][st] += 1;
    });
    const list = Object.values(by).map(r => ({ ...r, total: r.approved + r.pending + r.rejected }))
      .sort((a, b) => b.approved - a.approved || b.total - a.total || a.name.localeCompare(b.name, 'vi'));
    const s = list.reduce((t, r) => ({ total: t.total + r.total, approved: t.approved + r.approved, pending: t.pending + r.pending, rejected: t.rejected + r.rejected }), { total: 0, approved: 0, pending: 0, rejected: 0 });
    return { rows: list, sum: s };
  }, [clips, month]);

  const isCurrent = month === thisMonth();

  return (
    <div className="space-y-4">
      <div className="e-card-flat px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(m => shiftMonth(m, -1))} className="e-icon-btn w-9 h-9" aria-label="Tháng trước"><ChevronLeft className="w-4 h-4" /></button>
          <span className="min-w-[124px] text-center text-[14.5px] font-semibold text-slate-900 tabular-nums">{monthLabel(month)}</span>
          <button type="button" onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={isCurrent} className="e-icon-btn w-9 h-9 disabled:opacity-40" aria-label="Tháng sau"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {!isCurrent && <button type="button" onClick={() => setMonth(thisMonth())} className="e-btn e-btn-ghost e-btn-sm">Tháng này</button>}
        <span className="ml-auto text-[12px] text-slate-500">Tính theo tháng editor gửi clip duyệt</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TILES.map(({ k, label, Icon, cls }) => (
          <div key={k} className="e-card p-4 flex items-center gap-3 min-w-0">
            <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${cls}`}><Icon className="w-5 h-5" /></span>
            <div className="min-w-0">
              <div className="text-[12.5px] text-slate-500 truncate">{label}</div>
              <div className="text-[22px] font-bold text-slate-900 tabular-nums leading-tight">{sum[k]}</div>
              {k === 'approved' && sum.total > 0 && <div className="text-[11.5px] text-success-600 font-semibold">{pct(sum.approved, sum.total)}% clip đã gửi</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="e-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Users className="w-4 h-4 text-teal-600" />
          <div className="text-[15px] font-semibold text-slate-900">Theo từng editor · {monthLabel(month)}</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 pb-8 pt-4 text-center text-[13.5px] text-slate-400">Chưa có clip nào gửi duyệt trong {monthLabel(month).toLowerCase()}.</div>
        ) : (
          <>
            {/* Máy tính: bảng */}
            <div className="hidden sm:block e-table-wrap">
              <table className="e-table">
                <thead>
                  <tr>
                    <th>Editor</th><th className="num">Gửi duyệt</th><th className="num">Đã duyệt</th><th className="num">Chờ duyệt</th><th className="num">Bị từ chối</th><th className="w-[200px]">Tỷ lệ duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className={onOpenEditor ? 'cursor-pointer' : ''} onClick={() => onOpenEditor?.(r.id)}>
                      <td className="font-medium text-slate-800">{r.name}</td>
                      <td className="num tabular-nums">{r.total}</td>
                      <td className="num tabular-nums font-semibold text-success-600">{r.approved}</td>
                      <td className="num tabular-nums text-lavender-600">{r.pending}</td>
                      <td className="num tabular-nums text-danger-600">{r.rejected}</td>
                      <td><RateBar r={r} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/70 font-semibold">
                    <td>Tổng {rows.length} editor</td>
                    <td className="num tabular-nums">{sum.total}</td>
                    <td className="num tabular-nums text-success-600">{sum.approved}</td>
                    <td className="num tabular-nums text-lavender-600">{sum.pending}</td>
                    <td className="num tabular-nums text-danger-600">{sum.rejected}</td>
                    <td><RateBar r={sum} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Điện thoại: thẻ */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {rows.map(r => (
                <li key={r.id} className="px-4 py-3" onClick={() => onOpenEditor?.(r.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[14px] text-slate-800 truncate">{r.name}</span>
                    <span className="text-[12.5px] text-slate-500 shrink-0">{r.total} clip</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                    <span className="rounded-lg bg-success-50 py-1.5"><b className="block text-[16px] text-success-600 tabular-nums">{r.approved}</b><span className="text-[11px] text-slate-500">Đã duyệt</span></span>
                    <span className="rounded-lg bg-lavender-50 py-1.5"><b className="block text-[16px] text-lavender-600 tabular-nums">{r.pending}</b><span className="text-[11px] text-slate-500">Chờ duyệt</span></span>
                    <span className="rounded-lg bg-danger-50 py-1.5"><b className="block text-[16px] text-danger-600 tabular-nums">{r.rejected}</b><span className="text-[11px] text-slate-500">Bị từ chối</span></span>
                  </div>
                  <div className="mt-2"><RateBar r={r} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// Thanh tỷ lệ: xanh = đã duyệt, tím = chờ, đỏ = bị từ chối
function RateBar({ r }) {
  const t = r.total || 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden flex">
        {t > 0 && <>
          <span className="h-full bg-success-500" style={{ width: `${(r.approved / t) * 100}%` }} />
          <span className="h-full bg-lavender-400" style={{ width: `${(r.pending / t) * 100}%` }} />
          <span className="h-full bg-danger-400" style={{ width: `${(r.rejected / t) * 100}%` }} />
        </>}
      </div>
      <span className="w-10 text-right text-[12.5px] font-semibold tabular-nums text-slate-700">{pct(r.approved, t)}%</span>
    </div>
  );
}
