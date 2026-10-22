// ============================================================
// HỒ SƠ 360 — khung "NHÂN SỰ PHỤ TRÁCH"
//  - Khách hàng: Trực page · Telesale · Sale · CSKH (gom từ Data KH + mọi lịch hẹn)
//  - Từng ca / lịch hẹn: Sale, Telesale; ca phẫu thuật thêm Bác sĩ, Phụ mổ, Trực đêm,
//    Điều dưỡng hậu phẫu + Hậu phẫu / CSKH phụ trách thêm
//  - Nút Sửa: Admin sửa tất cả; Trưởng bộ phận điều dưỡng sửa nhân sự ca mổ / hậu phẫu
// ============================================================
import React, { useMemo, useState } from 'react';
import { Users, Pencil, Stethoscope, Headphones, PhoneCall, Briefcase, HeartHandshake, ChevronDown } from 'lucide-react';
import { isRecheck } from '@/features/appointments/calendarUtils';

const STATUS_LABEL = { scheduled: 'Chờ tư vấn', coc: 'Đã cọc', phau_thuat: 'Phẫu thuật', bong: 'Khách bong', cancelled: 'Đã huỷ' };
const day = (s) => (s ? new Date(String(s).length <= 10 ? `${s}T00:00:00` : s).toLocaleDateString('vi-VN') : '');
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

function People({ ids, who, empty = 'Chưa phân công' }) {
  const list = uniq(ids);
  if (!list.length) return <span className="text-slate-400 font-normal">{empty}</span>;
  return list.map((id, i) => <span key={id}>{i > 0 && <span className="text-slate-300"> · </span>}{who(id)}</span>);
}

function Role({ icon: Icon, label, children }) {
  return (
    <div className="min-w-0 flex items-start gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Icon className="w-4 h-4" /></span>
      <div className="min-w-0">
        <div className="text-[11.5px] text-slate-500">{label}</div>
        <div className="text-[13.5px] font-semibold text-slate-800 leading-snug break-words">{children}</div>
      </div>
    </div>
  );
}

const Line = ({ label, children }) => (
  <div className="flex items-baseline gap-2 text-[13px] min-w-0">
    <span className="w-[118px] shrink-0 text-slate-500">{label}</span>
    <span className="min-w-0 font-medium text-slate-800 break-words">{children}</span>
  </div>
);

export default function C360Team({ lead, appts, who, staff, canEditLead, canEditCase, onEditLead, onEditAppt }) {
  const [showAll, setShowAll] = useState(false);
  const roleOf = useMemo(() => Object.fromEntries((staff || []).map(s => [s.id, [s.role, s.role_2]])), [staff]);
  const isCskh = (id) => (roleOf[id] || []).includes('cskh');

  const careIds = appts.flatMap(a => [a.hau_phau_id, ...(a.additional_hau_phau_ids || [])]);
  const telesales = [lead?.telesale_id, ...appts.flatMap(a => [a.telesale_id, a.telesale_id_2])];
  const sales = appts.map(a => a.sale_id);
  const cskh = careIds.filter(isCskh);

  // Ca phẫu thuật lên trước, rồi lịch hẹn gần nhất
  const cases = [...appts].sort((a, b) => (b.status === 'phau_thuat') - (a.status === 'phau_thuat')
    || String(b.surgery_date || b.appointment_date || '').localeCompare(String(a.surgery_date || a.appointment_date || '')));
  const shown = showAll ? cases : cases.slice(0, 3);

  return (
    <section className="e-card-flat overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-800"><Users className="w-4 h-4 text-teal-600" />Nhân sự phụ trách</div>
        {canEditLead && lead && <button type="button" onClick={onEditLead} className="e-btn e-btn-ghost e-btn-sm"><Pencil />Sửa</button>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pb-3.5">
        <Role icon={Headphones} label="Trực page"><People ids={[lead?.truc_page_id]} who={who} /></Role>
        <Role icon={PhoneCall} label="Telesale"><People ids={telesales} who={who} /></Role>
        <Role icon={Briefcase} label="Sale"><People ids={sales} who={who} /></Role>
        <Role icon={HeartHandshake} label="CSKH"><People ids={cskh} who={who} /></Role>
      </div>

      {cases.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {shown.map(a => {
            const surgery = a.status === 'phau_thuat';
            const nurses = [a.phu_mo_1_id, a.phu_mo_2_id, a.phu_mo_3_id];
            const night = [a.truc_dem_id, a.truc_dem_id_2];
            const extra = (a.additional_hau_phau_ids || []).filter(id => id !== a.hau_phau_id);
            const svc = String(a.service || '').replace(/^\[Tái khám\]\s*/i, '') || 'Chưa rõ dịch vụ';
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${surgery ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Stethoscope className="w-3.5 h-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-900 truncate">{isRecheck(a) ? 'Tái khám · ' : ''}{svc}</div>
                    <div className="text-[11.5px] text-slate-500">{STATUS_LABEL[a.status] || a.status}{(surgery ? a.surgery_date : a.appointment_date) ? ` · ${surgery ? 'mổ ' : ''}${day(surgery ? a.surgery_date : a.appointment_date)}` : ''}</div>
                  </div>
                  {canEditCase && <button type="button" onClick={() => onEditAppt(a)} className="e-btn e-btn-ghost e-btn-sm shrink-0"><Pencil />Sửa</button>}
                </div>
                <div className="mt-2 ml-9 space-y-1">
                  <Line label="Sale"><People ids={[a.sale_id]} who={who} /></Line>
                  <Line label="Telesale"><People ids={[a.telesale_id, a.telesale_id_2]} who={who} /></Line>
                  {surgery && <>
                    <Line label="Bác sĩ"><People ids={[a.bac_si_id]} who={who} /></Line>
                    <Line label="Phụ mổ"><People ids={nurses} who={who} /></Line>
                    <Line label="Trực đêm"><People ids={night} who={who} /></Line>
                    <Line label="ĐD hậu phẫu"><People ids={[a.hau_phau_id]} who={who} /></Line>
                    {extra.length > 0 && <Line label="Hậu phẫu / CSKH thêm"><People ids={extra} who={who} /></Line>}
                  </>}
                </div>
              </div>
            );
          })}
          {cases.length > 3 && (
            <button type="button" onClick={() => setShowAll(v => !v)} className="w-full py-2 text-[12.5px] font-medium text-teal-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1">
              {showAll ? 'Thu gọn' : `Xem thêm ${cases.length - 3} lịch hẹn`}<ChevronDown className={`w-3.5 h-3.5 transition ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
