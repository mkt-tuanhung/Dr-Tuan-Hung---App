// ============================================================
// EVENT: THI VĂN NGHỆ MỪNG SINH NHẬT DR TUẤN HÙNG
// Khung trang của event. Phần chi tiết (đăng ký tiết mục, bình chọn,
// chấm điểm, bảng xếp hạng...) sẽ được ghép vào đây từ mã nguồn gửi sau.
// ============================================================
import React from 'react';
import { Music2, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@/components/ds';
import { EVENTS, EVENT_STATUS } from './eventConfig';

const EVENT = EVENTS.find((e) => e.id === 'event_van_nghe');

export default function VanNgheSinhNhatPage({ onNavigate }) {
  usePageTitle(EVENT.title);
  const st = EVENT_STATUS[EVENT.status] || EVENT_STATUS.preparing;

  return (
    <div className="space-y-4">
      {onNavigate && (
        <button type="button" onClick={() => onNavigate('event_hub')} className="e-btn e-btn-ghost e-btn-sm">
          <ArrowLeft className="w-4 h-4" /> Tất cả Event
        </button>
      )}

      <div className="e-card overflow-hidden">
        <div className="bg-gradient-to-br from-teal-600 to-teal-800 text-white px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center gap-2 text-teal-100 text-sm font-medium">
            <Music2 className="w-4 h-4" /> Event
          </div>
          <h1 className="mt-2 text-xl sm:text-2xl font-bold leading-snug">{EVENT.title}</h1>
          <p className="mt-2 text-sm text-teal-50/90 max-w-2xl">{EVENT.description}</p>
          <span className={`inline-block mt-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
        </div>
      </div>

      <div className="e-card e-card-pad flex flex-col items-center justify-center text-center py-12 space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center text-2xl">🎤</div>
        <div className="text-base font-semibold text-slate-700">Nội dung cuộc thi đang được hoàn thiện</div>
        <div className="text-sm text-slate-400">Đăng ký tiết mục, bình chọn và kết quả sẽ hiển thị tại đây.</div>
      </div>
    </div>
  );
}
