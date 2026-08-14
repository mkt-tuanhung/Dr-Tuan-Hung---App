import React from 'react';

// Màu theo trạng thái khách (tệp khách) & kết quả gọi — dùng chung modal + trang công khai.
export const STATUS_COLORS = {
  tiep_can: '#64748b', nong: '#f43f5e', tiem_nang: '#f59e0b', da_hen_lich: '#3b82f6',
  coc: '#8b5cf6', da_lam_dv: '#14b8a6', sai_gon: '#06b6d4', chot_fail: '#fb923c', mat: '#94a3b8',
};
export const OUTCOME_COLORS = {
  nghe_may: '#10b981', khong_nghe: '#94a3b8', may_ban: '#f59e0b', hen_goi_lai: '#3b82f6',
  can_nhac: '#8b5cf6', tu_choi: '#f43f5e', sai_so: '#64748b',
};

// Biểu đồ THANH NGANG thuần CSS
export const Bars = ({ data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <span className="w-24 shrink-0 text-slate-500 truncate">{d.label}</span>
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: d.color || '#14b8a6' }} />
          </div>
          <b className="w-9 text-right text-slate-700 tabular-nums">{d.value}</b>
        </div>
      ))}
    </div>
  );
};

// Biểu đồ TRÒN (donut) bằng conic-gradient
export const Donut = ({ data, size = 124, centerLabel }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const stops = total
    ? data.map(d => { const from = (acc / total) * 360; acc += d.value; const to = (acc / total) * 360; return `${d.color} ${from}deg ${to}deg`; }).join(', ')
    : '#e2e8f0 0deg 360deg';
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="rounded-full grid place-items-center shrink-0" style={{ width: size, height: size, background: `conic-gradient(${stops})` }}>
        <div className="rounded-full bg-white grid place-items-center text-center" style={{ width: size - 36, height: size - 36 }}>
          <div>
            <div className="text-xl font-bold text-slate-800 leading-none">{total}</div>
            {centerLabel && <div className="text-[9px] text-slate-400 mt-0.5">{centerLabel}</div>}
          </div>
        </div>
      </div>
      <div className="space-y-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="truncate">{d.label}</span>: <b className="tabular-nums">{d.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
};
