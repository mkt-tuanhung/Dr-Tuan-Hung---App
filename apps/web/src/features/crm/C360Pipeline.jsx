// ============================================================
// PIPELINE 360 — toàn bộ thông tin 1 khách xếp theo GIAI ĐOẠN HÀNH TRÌNH:
//   1 Tiếp cận (Data KH, cuộc gọi, GetFly, Messenger)
//   2 Tư vấn (lịch hẹn, hồ sơ tư vấn, ghi âm, lịch sử chăm sóc · khách bong)
//   3 Đặt cọc · 4 Phẫu thuật (ê kíp, doanh thu, viện phí)
//   5 Hậu phẫu & CSKH (nhật ký hậu phẫu, mốc hồi phục, nhật ký CSKH, tái khám, đánh giá)
// Dữ liệu lấy sẵn từ RPC get_customer_360 (mọi cột của lịch hẹn) — không gọi thêm.
// Admin: nút "Sửa" ở từng khối (onEditAppt / onEditLead).
// ============================================================
import React, { useState } from 'react';
import {
  Sparkles, PhoneCall, MessageSquare, StickyNote, CalendarDays, FileText, Mic, UserX, HandCoins,
  Activity, HeartPulse, Smile, Pencil, ChevronDown, Stethoscope, AlertTriangle, Link as LinkIcon, Check,
} from 'lucide-react';
import { APPT_TONE, isRecheck } from '@/features/appointments/calendarUtils';
import { JOURNEY as SURGERY_JOURNEY } from '@/features/appointments/journey.jsx';

const money = (n) => `${Math.round(Number(n || 0)).toLocaleString('vi-VN')}đ`;
const day = (s) => (s ? new Date(String(s).length <= 10 ? `${s}T00:00:00` : s).toLocaleDateString('vi-VN') : '—');
const dt = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const hm = (t) => (t ? String(t).slice(0, 5) : '');
const urlsOf = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(x => (typeof x === 'string' ? x : x?.url)).filter(u => typeof u === 'string' && /^https?:\/\//.test(u));
const apptTone = (a) => (isRecheck(a) ? APPT_TONE.recheck : (APPT_TONE[a?.status] || APPT_TONE.scheduled));
const MILESTONE_KEYS = ['d0', 'd1', 'd2', 'd7', 'd14', 'd30'];

const LEAD_STATUS = {
  tiep_can: 'Tiếp cận', nong: 'Nóng', tiem_nang: 'Tiềm năng', da_hen_lich: 'Đã hẹn lịch', coc: 'Cọc',
  da_lam_dv: 'Đã làm dịch vụ', sai_gon: 'Sài Gòn', chot_fail: 'Chốt Fail', mat: 'Mất',
};
const OUTCOME = {
  nghe_may: 'Nghe máy', khong_nghe: 'Không nghe máy', may_ban: 'Máy bận', hen_goi_lai: 'Hẹn gọi lại',
  can_nhac: 'Đang cân nhắc', tu_choi: 'Từ chối', sai_so: 'Sai số / không liên lạc',
};

// Nhật ký dạng text "[dd/mm/yyyy hh:mm] nội dung" (+ dòng "[Ảnh đính kèm: url]") -> các mốc, mới nhất trước
export function parseNotes(text) {
  const IMG = /\[Ảnh đính kèm:\s*(https?:\/\/[^\s\]]+)\]/g;
  const out = [];
  let cur = null;
  String(text || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    if (/^CẬP NHẬT\s+\d{1,2}\/\d{1,2}\/\d{4}\s*:?\s*$/i.test(line)) return; // tiêu đề nhóm cũ của Khách bong
    const m = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{2})(?::\d{2})?)?\]\s*(.*)$/);
    let rest = line;
    if (m) { cur = { date: m[1], time: m[2] || '', texts: [], imgs: [] }; out.push(cur); rest = m[3] || ''; }
    else if (!cur) { cur = { date: null, time: '', texts: [], imgs: [] }; out.push(cur); }
    let im; IMG.lastIndex = 0;
    while ((im = IMG.exec(rest))) cur.imgs.push(im[1]);
    const t = rest.replace(IMG, '').trim();
    if (t) cur.texts.push(t);
  });
  return out.reverse();
}

const Kv = ({ label, children, wide }) => (
  <div className={`min-w-0 ${wide ? 'col-span-2 sm:col-span-3' : ''}`}>
    <div className="e-kv-label">{label}</div>
    <div className={`e-kv-value ${wide ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>{children ?? '—'}</div>
  </div>
);

function Thumbs({ urls, onOpen, size = 'w-16 h-16' }) {
  if (!urls?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {urls.map((u, i) => (
        <button key={u + i} type="button" onClick={() => onOpen?.(urls, i)} className={`${size} rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80`}>
          <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
        </button>
      ))}
    </div>
  );
}

// Nhật ký (hậu phẫu / CSKH / chăm sóc): dòng thời gian gọn, mặc định 4 mốc mới nhất
function NoteLog({ title, icon: Icon, tone, text, onOpenImages }) {
  const [all, setAll] = useState(false);
  const entries = parseNotes(text);
  if (!entries.length) return null;
  const shown = all ? entries : entries.slice(0, 4);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-600 mb-1.5">
        <span className={`w-6 h-6 rounded-full grid place-items-center ${tone}`}><Icon className="w-3.5 h-3.5" /></span>
        {title} <span className="text-slate-400 font-normal">· {entries.length} mốc</span>
      </div>
      <ol className="ml-3 border-l-[1.5px] border-slate-200 space-y-2 pl-4">
        {shown.map((e, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[21.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-teal-400 ring-4 ring-white" />
            <div className="text-[11.5px] text-slate-400 tabular-nums">{[e.date, e.time].filter(Boolean).join(' ') || 'Không rõ ngày'}</div>
            {e.texts.map((t, k) => <div key={k} className="text-[13px] text-slate-700 whitespace-pre-wrap break-words">{t}</div>)}
            <Thumbs urls={e.imgs} onOpen={onOpenImages} size="w-14 h-14" />
          </li>
        ))}
      </ol>
      {entries.length > 4 && (
        <button type="button" onClick={() => setAll(v => !v)} className="mt-1.5 ml-7 text-[12.5px] font-semibold text-teal-700 hover:underline">
          {all ? 'Thu gọn' : `Xem thêm ${entries.length - 4} mốc`}
        </button>
      )}
    </div>
  );
}

function ApptCard({ a, who, canEdit, onEdit, children, extraBadge }) {
  const t = apptTone(a);
  return (
    <div className="e-card-flat px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 break-words">{String(a.service || '').replace(/^\[Tái khám\]\s*/i, '') || 'Chưa rõ dịch vụ'}</div>
          <div className="text-[12px] text-slate-400 mt-0.5">
            {[a.service_group, a.surgery_type].filter(Boolean).join(' · ') || 'Chưa có nhóm dịch vụ'}
            {a.sale_id || a.telesale_id ? ` · ${[a.sale_id ? `Sale ${who(a.sale_id)}` : null, a.telesale_id ? `Tele ${who(a.telesale_id)}` : null].filter(Boolean).join(' · ')}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {extraBadge}
          <span className="e-badge e-badge-sm" style={{ background: t.bg, color: t.text }}>{t.label}</span>
          {canEdit && (
            <button type="button" onClick={() => onEdit(a)} title="Sửa thông tin" className="e-icon-btn w-8 h-8"><Pencil className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Stage({ no, title, icon: Icon, state, count, defaultOpen, children, empty }) {
  const [open, setOpen] = useState(defaultOpen);
  const dot = state === 'done' ? 'bg-teal-600 text-white' : state === 'current' ? 'bg-white text-teal-700 ring-2 ring-teal-500' : 'bg-slate-100 text-slate-400';
  return (
    <li className="relative pl-12 pb-4 last:pb-0">
      <span className="absolute left-[17px] top-9 bottom-0 w-px bg-slate-200 [li:last-child>&]:hidden" />
      <span className={`absolute left-0 top-0 w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold ${dot}`}>
        {state === 'done' ? <Check className="w-4 h-4" /> : no}
      </span>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full min-h-9 flex items-center gap-2 text-left">
        <Icon className={`w-4 h-4 shrink-0 ${state === 'todo' ? 'text-slate-400' : 'text-teal-600'}`} />
        <span className={`text-[15px] font-bold ${state === 'todo' ? 'text-slate-400' : 'text-slate-900'}`}>{title}</span>
        {count ? <span className="e-badge e-badge-sm e-tone-neutral">{count}</span> : null}
        {state === 'current' && <span className="e-badge e-badge-sm e-tone-brand">Hiện tại</span>}
        <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-2 space-y-2.5">{children || <div className="text-[13px] text-slate-400">{empty || 'Chưa có thông tin'}</div>}</div>}
    </li>
  );
}

export default function C360Pipeline({ d, appts, lead, who, jIdx, canEdit, canSeeConsult, onEditAppt, onEditLead, onOpenImages }) {
  const consults = appts.filter(a => !isRecheck(a));
  const deposits = appts.filter(a => a.status === 'coc' || Number(a.deposit_amount) > 0 || a.deposit_date);
  const surgeries = appts.filter(a => a.status === 'phau_thuat');
  const rechecks = appts.filter(isRecheck);
  const activities = d.activities || [];
  const getfly = d.getfly_notes || [];
  const messages = d.messages || [];
  const recordings = d.recordings || [];
  const reviews = d.reviews || [];
  const stateOf = (i) => (i < jIdx ? 'done' : i === jIdx ? 'current' : 'todo');
  const [moreAct, setMoreAct] = useState(false);

  return (
    <ol className="pt-1">
      {/* 1. TIẾP CẬN */}
      <Stage no={1} title="Tiếp cận" icon={Sparkles} state={stateOf(0)} count={activities.length + getfly.length || null}
        defaultOpen={jIdx <= 1} empty="Khách chưa có trong Data KH">
        {(lead || activities.length || getfly.length || messages.length) ? <>
          {lead && (
            <div className="e-card-flat px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-900">Data khách hàng</div>
                <div className="flex items-center gap-1.5">
                  {lead.status && <span className="e-badge e-badge-sm e-tone-brand">{LEAD_STATUS[lead.status] || lead.status}</span>}
                  {canEdit && <button type="button" onClick={onEditLead} title="Sửa Data KH" className="e-icon-btn w-8 h-8"><Pencil className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                <Kv label="Nguồn">{lead.source || '—'}</Kv>
                <Kv label="Telesale">{who(lead.telesale_id)}</Kv>
                <Kv label="Trực page">{who(lead.truc_page_id)}</Kv>
                <Kv label="Vào Data">{day(lead.getfly_created_at || lead.created_at)}</Kv>
                {lead.customer_group && <Kv label="Tệp khách">{lead.customer_group}</Kv>}
                {lead.next_call_at && <Kv label="Hẹn gọi lại">{dt(lead.next_call_at)}</Kv>}
                {lead.description && <Kv label="Nhu cầu" wide>{lead.description}</Kv>}
                {lead.last_exchange && <Kv label="Trao đổi gần nhất" wide>{lead.last_exchange}</Kv>}
              </div>
            </div>
          )}
          {activities.length > 0 && (
            <div className="e-card-flat px-4 py-3">
              <div className="text-[12.5px] font-semibold text-slate-600 mb-1.5">Cuộc gọi & chăm sóc · {activities.length}</div>
              <ul className="space-y-1.5">
                {(moreAct ? activities : activities.slice(0, 5)).map(a => (
                  <li key={a.id} className="flex items-start gap-2 text-[13px]">
                    {a.type === 'call' ? <PhoneCall className="w-3.5 h-3.5 mt-0.5 text-sky-600 shrink-0" /> : <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-teal-600 shrink-0" />}
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">{a.type === 'call' ? `Gọi${a.outcome ? ` · ${OUTCOME[a.outcome] || a.outcome}` : ''}` : a.type === 'care' ? 'Chăm sóc' : 'Ghi chú'}</span>
                      {a.content && <span className="text-slate-600"> — {a.content}</span>}
                      <div className="text-[11.5px] text-slate-400">{dt(a.created_at)}{a.created_by ? ` · ${who(a.created_by)}` : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
              {activities.length > 5 && <button type="button" onClick={() => setMoreAct(v => !v)} className="mt-1.5 text-[12.5px] font-semibold text-teal-700 hover:underline">{moreAct ? 'Thu gọn' : `Xem thêm ${activities.length - 5}`}</button>}
            </div>
          )}
          {getfly.length > 0 && (
            <div className="e-card-flat px-4 py-3">
              <div className="text-[12.5px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5 text-peach-600" /> Ghi chú GetFly · {getfly.length}</div>
              <ul className="space-y-1.5">
                {getfly.slice(0, 5).map(n => (
                  <li key={n.id} className="text-[13px] text-slate-700">
                    {[n.title, n.content].filter(Boolean).join(' — ')}
                    <div className="text-[11.5px] text-slate-400">{dt(n.created_at)}{n.creator_name ? ` · ${n.creator_name}` : ''}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {messages.length > 0 && (
            <div className="e-card-flat px-4 py-3 flex items-start gap-2 text-[13px]">
              <MessageSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="min-w-0"><span className="font-medium text-slate-800">Messenger</span> · {messages[0].last_message || '—'}<div className="text-[11.5px] text-slate-400">{dt(messages[0].last_time)}</div></div>
            </div>
          )}
        </> : null}
      </Stage>

      {/* 2. TƯ VẤN */}
      <Stage no={2} title="Tư vấn" icon={CalendarDays} state={stateOf(1)} count={consults.length || null} defaultOpen={jIdx === 1} empty="Chưa có lịch hẹn tư vấn">
        {consults.length ? consults.map(a => (
          <ApptCard key={a.id} a={a} who={who} canEdit={canEdit} onEdit={onEditAppt}>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              <Kv label="Ngày hẹn">{day(a.appointment_date)}{a.appointment_time ? ` ${hm(a.appointment_time)}` : ''}</Kv>
              <Kv label="Bill dự kiến">{Number(a.expected_bill) ? money(a.expected_bill) : '—'}</Kv>
              <Kv label="Nguồn · Loại">{[a.customer_source, a.customer_type].filter(Boolean).join(' · ') || '—'}</Kv>
              {a.test_status && <Kv label="Xét nghiệm">{a.test_status}</Kv>}
              {a.notes && <Kv label={a.status === 'bong' ? 'Lý do rớt / ghi chú' : 'Ghi chú'} wide>{a.notes}</Kv>}
            </div>
            {a.social_link && <a href={a.social_link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-teal-700 hover:underline"><LinkIcon className="w-3 h-3" /> Link tham khảo</a>}
            {canSeeConsult && (a.consult_note || a.extra_consult || urlsOf(a.consult_image_urls).length > 0) && (
              <div className="mt-3 e-subtle px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600"><FileText className="w-3.5 h-3.5 text-teal-600" /> Hồ sơ tư vấn</div>
                {a.consult_note && <div className="text-[13px] text-slate-700 whitespace-pre-wrap mt-1">{a.consult_note}</div>}
                {a.extra_consult && <div className="text-[13px] text-slate-700 whitespace-pre-wrap mt-1"><b className="font-semibold">Tư vấn thêm:</b> {a.extra_consult}</div>}
                <Thumbs urls={urlsOf(a.consult_image_urls)} onOpen={onOpenImages} />
              </div>
            )}
            <Thumbs urls={urlsOf(a.note_image_urls)} onOpen={onOpenImages} size="w-14 h-14" />
            {recordings.filter(r => r.appointment_id === a.id).map(r => (
              <div key={r.id} className="mt-2 flex items-start gap-2 text-[13px]">
                <Mic className="w-3.5 h-3.5 text-sky-600 mt-0.5 shrink-0" />
                <div className="min-w-0"><span className="font-medium text-slate-800">Ghi âm tư vấn{r.ai_score != null ? ` · AI chấm ${r.ai_score}` : ''}</span>{r.summary && <div className="text-slate-600">{r.summary}</div>}<div className="text-[11.5px] text-slate-400">{dt(r.created_at)}</div></div>
              </div>
            ))}
            {a.status === 'bong' && (
              <div className="mt-3 rounded-xl border border-danger-100 bg-danger-50/40 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger-700"><UserX className="w-3.5 h-3.5" /> Khách bong{a.bong_date ? ` · ${day(a.bong_date)}` : ''}{a.care_status ? ` · ${a.care_status}` : ''}</div>
              </div>
            )}
            <NoteLog title={a.status === 'bong' ? 'Nhật ký chăm sóc khách bong' : 'Lịch sử tư vấn / chăm sóc'} icon={MessageSquare} tone="e-tone-info" text={a.care_notes} onOpenImages={onOpenImages} />
          </ApptCard>
        )) : null}
      </Stage>

      {/* 3. ĐẶT CỌC */}
      <Stage no={3} title="Đặt cọc" icon={HandCoins} state={stateOf(2)} count={deposits.length || null} defaultOpen={jIdx === 2} empty="Chưa đặt cọc">
        {deposits.length ? deposits.map(a => (
          <ApptCard key={a.id} a={a} who={who} canEdit={canEdit} onEdit={onEditAppt}>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              <Kv label="Tiền cọc"><b className="text-slate-900">{Number(a.deposit_amount) ? money(a.deposit_amount) : '—'}</b></Kv>
              <Kv label="Ngày cọc">{day(a.deposit_date)}</Kv>
              <Kv label="Dự kiến mổ">{day(a.expected_surgery_date)}</Kv>
              {a.expected_surgery_plan && <Kv label="Kế hoạch mổ" wide>{a.expected_surgery_plan}</Kv>}
            </div>
            <Thumbs urls={urlsOf(a.deposit_bill_url)} onOpen={onOpenImages} />
          </ApptCard>
        )) : null}
      </Stage>

      {/* 4. PHẪU THUẬT */}
      <Stage no={4} title="Phẫu thuật" icon={Activity} state={stateOf(3)} count={surgeries.length || null} defaultOpen={jIdx === 3} empty="Chưa phẫu thuật">
        {surgeries.length ? surgeries.map(a => {
          const team = [['Bác sĩ', a.bac_si_id], ['Phụ mổ 1', a.phu_mo_1_id], ['Phụ mổ 2', a.phu_mo_2_id], ['Phụ mổ 3', a.phu_mo_3_id], ['Trực đêm', a.truc_dem_id], ['Trực đêm 2', a.truc_dem_id_2]].filter(([, id]) => id);
          const j = SURGERY_JOURNEY[a.journey_status];
          return (
            <ApptCard key={a.id} a={a} who={who} canEdit={canEdit} onEdit={onEditAppt}
              extraBadge={j ? <span className={`e-badge e-badge-sm ${j.cls}`}>{j.label}</span> : null}>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                <Kv label="Ngày mổ">{day(a.surgery_date)}{a.surgery_time ? ` ${hm(a.surgery_time)}` : ''}</Kv>
                <Kv label="Doanh thu"><b className="text-slate-900">{Number(a.revenue) ? money(a.revenue) : '—'}</b></Kv>
                <Kv label="Upsale">{Number(a.upsale_revenue) ? money(a.upsale_revenue) : '—'}</Kv>
                {'hospital_fee' in a && <Kv label="Viện phí">{Number(a.hospital_fee) ? `${money(a.hospital_fee)}${a.hospital_fee_method ? ` · ${a.hospital_fee_method}` : ''}` : '—'}</Kv>}
                {team.map(([l, id]) => <Kv key={l} label={l}>{who(id)}</Kv>)}
                {a.journey_updated_at && <Kv label="Cập nhật hành trình">{dt(a.journey_updated_at)}{a.journey_updated_by ? ` · ${a.journey_updated_by}` : ''}</Kv>}
                {a.surgery_notes && <Kv label="Ghi chú ca mổ" wide>{a.surgery_notes}</Kv>}
                {a.truc_dem_notes && <Kv label="Ghi chú trực đêm" wide>{a.truc_dem_notes}</Kv>}
              </div>
              <Thumbs urls={urlsOf(a.hospital_fee_proof)} onOpen={onOpenImages} size="w-14 h-14" />
            </ApptCard>
          );
        }) : null}
      </Stage>

      {/* 5. HẬU PHẪU & CSKH */}
      <Stage no={5} title="Hậu phẫu & CSKH" icon={HeartPulse} state={stateOf(4)} count={(surgeries.length + rechecks.length + reviews.length) || null}
        defaultOpen={jIdx >= 3} empty="Chưa có thông tin hậu phẫu">
        {(surgeries.length || rechecks.length || reviews.length) ? <>
          {surgeries.map(a => {
            const ms = Array.isArray(a.care_milestones) ? a.care_milestones : [];
            const done = MILESTONE_KEYS.filter(k => ms.find(m => m?.key === k)?.done).length;
            const signs = Array.isArray(a.warning_signs) ? a.warning_signs : [];
            const nurses = [a.hau_phau_id, ...(a.additional_hau_phau_ids || [])].filter(Boolean);
            return (
              <ApptCard key={a.id} a={a} who={who} canEdit={canEdit} onEdit={onEditAppt}>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                  <Kv label="Hậu phẫu">{a.post_op_status || '—'}</Kv>
                  <Kv label="Phân loại CSKH">{a.cskh_status || 'Chưa phân loại'}</Kv>
                  <Kv label="Mốc hồi phục">{done}/{MILESTONE_KEYS.length} hoàn thành</Kv>
                  <Kv label="Điều dưỡng">{nurses.length ? nurses.map(who).join(', ') : 'Chưa phân công'}</Kv>
                  <Kv label="Tái khám tới">{a.next_recheck_at ? dt(a.next_recheck_at) : '—'}</Kv>
                </div>
                {signs.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-danger-600" />
                    {signs.map(s => <span key={s} className="e-badge e-badge-sm e-tone-danger">{s}</span>)}
                  </div>
                )}
                <NoteLog title="Nhật ký hậu phẫu" icon={Stethoscope} tone="e-tone-success" text={a.post_op_notes} onOpenImages={onOpenImages} />
                <NoteLog title="Nhật ký CSKH" icon={HeartPulse} tone="e-tone-lavender" text={a.cskh_notes} onOpenImages={onOpenImages} />
              </ApptCard>
            );
          })}
          {rechecks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[12.5px] font-semibold text-slate-600">Lịch tái khám · {rechecks.length}</div>
              {rechecks.map(a => (
                <ApptCard key={a.id} a={a} who={who} canEdit={canEdit} onEdit={onEditAppt}>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                    <Kv label="Ngày hẹn">{day(a.appointment_date)}{a.appointment_time ? ` ${hm(a.appointment_time)}` : ''}</Kv>
                    <Kv label="Dịch vụ đã làm">{a.used_service || '—'}</Kv>
                    <Kv label="Ngày mổ">{day(a.surgery_date)}</Kv>
                    {a.notes && <Kv label="Ghi chú" wide>{a.notes}</Kv>}
                  </div>
                  <NoteLog title="Lịch sử chăm sóc" icon={MessageSquare} tone="e-tone-info" text={a.care_notes} onOpenImages={onOpenImages} />
                </ApptCard>
              ))}
            </div>
          )}
          {reviews.length > 0 && (
            <div className="e-card-flat px-4 py-3">
              <div className="text-[12.5px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5"><Smile className="w-3.5 h-3.5 text-peach-600" /> Đánh giá dịch vụ · {reviews.length}</div>
              <ul className="space-y-2">
                {reviews.map(r => (
                  <li key={r.id} className="text-[13px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-800">{r.milestone || 'Đánh giá'}{r.service ? ` · ${r.service}` : ''}</span>
                      {r.overall_score != null && <span className="e-badge e-badge-sm e-tone-brand">{r.overall_score}/5</span>}
                      {r.nps_score != null && <span className="e-badge e-badge-sm e-tone-info">NPS {r.nps_score}</span>}
                    </div>
                    {r.comment && <div className="text-slate-600">“{r.comment}”</div>}
                    <div className="text-[11.5px] text-slate-400">{dt(r.submitted_at)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </> : null}
      </Stage>
    </ol>
  );
}
