// ============================================================
// NGĂN KÉO CHI TIẾT LỊCH HẸN — mở khi bấm vào khối lịch.
// Desktop: panel trượt từ phải; Mobile: bottom sheet.
// Nút thao tác (Đánh giá, Sửa, Tiếp nhận...) do trang cha truyền qua
// `actions` để dùng CHUNG logic phân quyền với thẻ danh sách.
// ============================================================
import React, { useEffect } from 'react';
import { X, Phone, CalendarDays, Clock, Link as LinkIcon, User, Wallet, Receipt, Stethoscope, Tag } from 'lucide-react';
import { toneOf, parseYMD, fmtDayTitle, timeToMin, minToTime, durationOf, isRecheck, fmtVND } from './calendarUtils';
import { phoneFor, isSaleOffline } from '@/lib/phoneMask';

const JOURNEY = {
  ho_so: '📋 Hoàn thiện hồ sơ - XN', xn_xong: '🧪 Đã XN xong', dang_mo: '🔪 Đang phẫu thuật',
  mo_xong: '✅ Đã mổ xong', ra_vien: '🏠 Đã ra viện',
};

const Row = ({ icon: Icon, label, value, strong }) => (
  <div className="flex items-center gap-3 py-2">
    <span className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 grid place-items-center shrink-0"><Icon className="w-4 h-4" /></span>
    <span className="text-[13px] text-slate-500 w-28 shrink-0">{label}</span>
    <span className={`text-[14px] min-w-0 truncate ${strong ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{value || '—'}</span>
  </div>
);

export default function AppointmentDrawer({ app, onClose, actions, profile }) {
  useEffect(() => {
    if (!app) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app, onClose]);

  if (!app) return null;
  const tone = toneOf(app);
  const start = timeToMin(app.appointment_time);
  const recheck = isRecheck(app);

  return (
    <div className="fixed inset-0 z-[45]">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="absolute bg-white shadow-float flex flex-col
        inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl
        lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[440px] lg:max-h-none lg:rounded-none lg:rounded-l-3xl animate-page">
        {/* Thanh kéo (mobile) */}
        <div className="lg:hidden pt-2.5 pb-1 grid place-items-center"><span className="w-10 h-1.5 rounded-full bg-slate-200" /></div>

        {/* Header */}
        <div className="px-5 pt-3 lg:pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: tone.bg, color: tone.text }}>
                <span className="w-2 h-2 rounded-full" style={{ background: tone.bar }} />{tone.label}
              </span>
              <h3 className="mt-2 text-[20px] font-bold text-slate-900 leading-tight truncate">{app.customer_name || 'Khách'}</h3>
              {app.phone && (
                isSaleOffline(profile)
                  ? <div className="mt-1 text-[14px] text-slate-500 flex items-center gap-1.5"><Phone className="w-4 h-4" />{phoneFor(app.phone, profile)}</div>
                  : <a href={`tel:${app.phone}`} className="mt-1 text-[14px] text-teal-700 font-semibold flex items-center gap-1.5 w-fit"><Phone className="w-4 h-4" />{app.phone}</a>
              )}
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0" aria-label="Đóng">
              <X className="w-5 h-5" />
            </button>
          </div>
          {JOURNEY[app.journey_status] && (
            <div className="mt-3 text-[12.5px] font-semibold text-slate-700 bg-slate-50 rounded-xl px-3 py-2">{JOURNEY[app.journey_status]}</div>
          )}
        </div>

        {/* Nội dung */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="divide-y divide-slate-100">
            <Row icon={CalendarDays} label="Ngày hẹn" value={app.appointment_date ? fmtDayTitle(parseYMD(app.appointment_date)) : null} strong />
            <Row icon={Clock} label="Khung giờ" value={start != null ? `${minToTime(start)} – ${minToTime(start + durationOf(app))}` : 'Chưa có giờ'} />
            <Row icon={Stethoscope} label={recheck ? 'Lý do tái khám' : 'Dịch vụ'} value={(app.service || '').replace('[Tái khám] ', '')} strong />
            {recheck ? (
              <>
                <Row icon={Tag} label="DV đã dùng" value={app.used_service} />
                <Row icon={CalendarDays} label="Ngày phẫu thuật" value={app.surgery_date ? new Date(app.surgery_date).toLocaleDateString('vi-VN') : null} />
                <Row icon={User} label="Phụ trách" value={app.sale !== 'Không có' ? app.sale : null} />
              </>
            ) : (
              <>
                <Row icon={User} label="Telesale" value={app.telesale !== 'Không có' ? app.telesale : null} />
                <Row icon={User} label="Sale Offline" value={app.sale !== 'Không có' ? app.sale : null} />
                <Row icon={Receipt} label="Bill dự kiến" value={fmtVND(app.expected_bill)} strong />
                <Row icon={Wallet} label="Đã cọc" value={fmtVND(app.deposit_amount)} />
                <Row icon={Tag} label="Nguồn / loại" value={[app.customer_source, app.customer_type].filter(Boolean).join(' · ')} />
                <Row icon={Tag} label="Nhóm DV" value={[app.service_group, app.surgery_type].filter(Boolean).join(' · ')} />
              </>
            )}
          </div>
          {app.social_link && (
            <a href={app.social_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:underline">
              <LinkIcon className="w-4 h-4" /> Xem link tham khảo
            </a>
          )}
        </div>

        {/* Thao tác */}
        {actions && (
          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/60 pb-safe">
            {actions}
          </div>
        )}
      </aside>
    </div>
  );
}
