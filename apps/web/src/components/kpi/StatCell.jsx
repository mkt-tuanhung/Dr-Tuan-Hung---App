import React from 'react';

// Ô thống kê nhỏ cho thẻ KPI trên mobile: nhãn nhỏ + giá trị đậm.
export default function StatCell({ label, value, className = 'text-slate-700' }) {
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
      <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
      <div className={`font-semibold text-sm ${className}`}>{value}</div>
    </div>
  );
}
