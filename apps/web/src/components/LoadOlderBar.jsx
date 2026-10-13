import React from 'react';

// Thanh "Tải thêm" dưới danh sách: màn chỉ tải dữ liệu gần đây để tiết kiệm băng thông,
// muốn xem cũ hơn thì bấm tải tiếp.
export const ymdShift = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export default function LoadOlderBar({ fromYmd, label = 'Đang hiển thị từ ngày', moreDays = 30, loading, onMore }) {
  if (!fromYmd) return null;
  return (
    <div className="flex flex-col items-center gap-2 pt-2 pb-4">
      <div className="text-[12.5px] text-slate-500 text-center px-4">{label} <b className="text-slate-700 tabular-nums">{new Date(fromYmd).toLocaleDateString('vi-VN')}</b></div>
      <button type="button" onClick={onMore} disabled={loading} className="e-btn e-btn-secondary max-lg:h-11 max-lg:w-full">
        {loading ? 'Đang tải…' : `Tải thêm ${moreDays} ngày trước`}
      </button>
    </div>
  );
}
