// ============================================================
// EVENT — trang tổng hợp các sự kiện nội bộ (bấm thẻ để mở event)
// ============================================================
import React from 'react';
import { PartyPopper, ChevronRight } from 'lucide-react';
import { usePageTitle } from '@/components/ds';
import { EVENTS, EVENT_STATUS } from './eventConfig';

export default function EventHubPage({ onNavigate }) {
  usePageTitle('Event - Sự kiện nội bộ');

  return (
    <div className="space-y-4">
      <div className="e-card e-card-pad flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <PartyPopper className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-800">Sự kiện nội bộ</div>
          <div className="text-sm text-slate-500">Các cuộc thi, hoạt động của hệ thống Dr Tuấn Hùng</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {EVENTS.map((ev) => {
          const Icon = ev.icon;
          const st = EVENT_STATUS[ev.status] || EVENT_STATUS.preparing;
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => onNavigate?.(ev.id)}
              className="e-card e-card-hover e-card-pad text-left flex items-start gap-3 w-full"
            >
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 leading-snug">{ev.title}</div>
                <div className="text-sm text-slate-500 mt-1">{ev.description}</div>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
