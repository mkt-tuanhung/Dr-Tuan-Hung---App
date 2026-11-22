// ============================================================
// EVENT: THI VĂN NGHỆ MỪNG SINH NHẬT DR TUẤN HÙNG
// Banner sự kiện + module chấm điểm Gala (features/event/gala).
// ============================================================
import React from 'react';
import { Music2, ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@/components/ds';
import { EVENTS } from './eventConfig';
import GalaScoring from './gala/GalaScoring.jsx';

const EVENT = EVENTS.find((e) => e.id === 'event_van_nghe');

export default function VanNgheSinhNhatPage({ onNavigate }) {
  usePageTitle(EVENT.title);

  return (
    <div className="space-y-4">
      {onNavigate && (
        <button type="button" onClick={() => onNavigate('event_hub')} className="e-btn e-btn-ghost e-btn-sm">
          <ArrowLeft /> Tất cả Event
        </button>
      )}

      <div className="e-card overflow-hidden">
        <div className="relative bg-gradient-to-br from-teal-600 to-teal-800 text-white px-5 py-6 sm:px-8 sm:py-7">
          <div className="flex items-center gap-2 text-teal-100 text-[12px] font-semibold tracking-[0.12em] uppercase">
            <Music2 className="w-4 h-4" /> Together we shine
          </div>
          <h1 className="mt-2 text-xl sm:text-2xl font-bold leading-snug text-white">{EVENT.title}</h1>
          <p className="mt-1.5 text-sm text-teal-50/90 max-w-2xl">{EVENT.description}</p>
        </div>
      </div>

      <GalaScoring />
    </div>
  );
}
