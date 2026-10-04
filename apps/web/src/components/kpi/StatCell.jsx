import React from 'react';

// Ô thống kê nhỏ cho thẻ KPI trên mobile: nhãn nhỏ + giá trị đậm (khối nền nhạt kiểu Ethics).
export default function StatCell({ label, value, className = 'text-slate-900' }) {
  return (
    <div className="e-subtle px-3 py-2 min-w-0">
      <div className="text-[11.5px] text-slate-500 mb-0.5 truncate">{label}</div>
      <div className={`font-semibold text-[14px] tabular-nums break-words ${className}`}>{value}</div>
    </div>
  );
}
