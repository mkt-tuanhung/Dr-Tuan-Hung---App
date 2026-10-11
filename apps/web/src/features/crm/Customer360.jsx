// ============================================================
// HỒ SƠ KHÁCH HÀNG 360 (Ethics BOS D03) — mở được từ MỌI màn
//   const { openCustomer } = useCustomer360();
//   openCustomer(phone, { name })   // VD: từ Lịch hẹn, Khách cọc, Phẫu thuật, Hậu phẫu…
// Dữ liệu: RPC get_customer_360 (supabase/customer_360.sql) — quyền xem + che SĐT
// kiểm tra trên máy chủ. Hồ sơ chỉ để XEM; sửa vẫn làm ở màn nghiệp vụ.
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Phone, CalendarDays, Wallet, Stethoscope, Image as ImageIcon, Mic, Smile, History, PhoneCall,
  MessageSquare, HandCoins, Activity, UserX, Check, ExternalLink, Sparkles, StickyNote,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Drawer, EmptyState, ErrorState, PermissionDenied } from '@/components/ds';
import ImageLightbox from '@/components/ImageLightbox.jsx';
import { APPT_TONE, isRecheck } from '@/features/appointments/calendarUtils';

const LEAD_STATUS = {
  tiep_can: 'Tiếp cận', nong: 'Nóng', tiem_nang: 'Tiềm năng', da_hen_lich: 'Đã hẹn lịch', coc: 'Cọc',
  da_lam_dv: 'Đã làm dịch vụ', sai_gon: 'Sài Gòn', chot_fail: 'Chốt Fail', mat: 'Mất',
};
const OUTCOME = {
  nghe_may: 'Nghe máy', khong_nghe: 'Không nghe máy', may_ban: 'Máy bận', hen_goi_lai: 'Hẹn gọi lại',
  can_nhac: 'Đang cân nhắc', tu_choi: 'Từ chối', sai_so: 'Sai số / không liên lạc',
};
const JOURNEY = ['Tiếp cận', 'Hẹn tư vấn', 'Đặt cọc', 'Phẫu thuật', 'Hậu phẫu'];
const TABS = [
  { id: 'timeline', label: 'Dòng thời gian', icon: History },
  { id: 'treatments', label: 'Lịch hẹn & liệu trình', icon: Stethoscope },
  { id: 'payments', label: 'Thanh toán', icon: Wallet },
  { id: 'images', label: 'Hình ảnh', icon: ImageIcon },
  { id: 'recordings', label: 'Ghi âm & AI', icon: Mic },
  { id: 'reviews', label: 'Đánh giá', icon: Smile },
];

const money = (n) => `${Math.round(Number(n || 0)).toLocaleString('vi-VN')}đ`;
const day = (s) => (s ? new Date(String(s).length <= 10 ? `${s}T00:00:00` : s).toLocaleDateString('vi-VN') : '—');
const dt = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const apptTone = (a) => (isRecheck(a) ? APPT_TONE.recheck : (APPT_TONE[a?.status] || APPT_TONE.scheduled));
const urlsOf = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(x => (typeof x === 'string' ? x : x?.url)).filter(u => typeof u === 'string' && /^https?:\/\//.test(u));
const hasMoney = (a) => Number(a.deposit_amount) || Number(a.revenue) || Number(a.upsale_revenue) || Number(a.hospital_fee);

const Ctx = createContext({ openCustomer: () => {} });
export const useCustomer360 = () => useContext(Ctx);

export function Customer360Provider({ children }) {
  const [target, setTarget] = useState(null); // { phone, name }
  const openCustomer = useCallback((phone, opts = {}) => { if (phone) setTarget({ phone, name: opts.name || '' }); }, []);
  const value = useMemo(() => ({ openCustomer }), [openCustomer]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Customer360Drawer target={target} onClose={() => setTarget(null)} />
    </Ctx.Provider>
  );
}

// Nút nhỏ "Hồ sơ 360" để gắn vào bảng / thẻ ở các màn
export function Customer360Button({ phone, name, className = '', label = 'Hồ sơ 360' }) {
  const { openCustomer } = useCustomer360();
  if (!phone) return null;
  return (
    <button type="button" title="Mở hồ sơ khách hàng 360"
      onClick={(e) => { e.stopPropagation(); openCustomer(phone, { name }); }}
      className={`e-btn e-btn-ghost e-btn-sm h-8 px-2.5 ${className}`}>
      <Sparkles /> {label}
    </button>
  );
}

function journeyIndex(lead, appts) {
  if (appts.some(a => a.status === 'phau_thuat' && (a.journey_status || a.post_op_status || a.cskh_status))) return 4;
  if (appts.some(a => a.status === 'phau_thuat')) return 3;
  if (appts.some(a => a.status === 'coc' || Number(a.deposit_amount) > 0)) return 2;
  if (appts.length) return 1;
  return lead ? 0 : -1;
}

function buildTimeline(d, lead, appts, who) {
  const ev = [];
  if (lead?.created_at) ev.push({ at: lead.getfly_created_at || lead.created_at, icon: Sparkles, tone: 'e-tone-neutral', title: 'Khách vào Data KH', sub: [lead.source, lead.telesale_id ? `Telesale ${who(lead.telesale_id)}` : null].filter(Boolean).join(' · ') });
  (d.activities || []).forEach(a => ev.push({
    at: a.created_at, icon: a.type === 'call' ? PhoneCall : MessageSquare, tone: 'e-tone-info',
    title: a.type === 'call' ? `Cuộc gọi${a.outcome ? ` · ${OUTCOME[a.outcome] || a.outcome}` : ''}` : (a.type === 'care' ? 'Chăm sóc' : 'Ghi chú'),
    sub: [a.content, a.created_by ? who(a.created_by) : null].filter(Boolean).join(' · '),
  }));
  appts.forEach(a => {
    ev.push({ at: a.appointment_date || a.created_at, icon: CalendarDays, tone: 'e-tone-brand', title: `${isRecheck(a) ? 'Tái khám' : 'Lịch hẹn tư vấn'} · ${a.service || 'chưa rõ dịch vụ'}`, sub: [apptTone(a).label, a.sale_id ? `Sale ${who(a.sale_id)}` : null].filter(Boolean).join(' · ') });
    if (a.deposit_date || Number(a.deposit_amount) > 0) ev.push({ at: a.deposit_date || a.appointment_date, icon: HandCoins, tone: 'e-tone-lavender', title: `Đặt cọc ${money(a.deposit_amount)}`, sub: a.service });
    if (a.bong_date) ev.push({ at: a.bong_date, icon: UserX, tone: 'e-tone-danger', title: 'Khách bong', sub: a.service });
    if (a.status === 'phau_thuat') ev.push({ at: a.surgery_date || a.appointment_date, icon: Activity, tone: 'e-tone-success', title: `Phẫu thuật · ${a.surgery_type || a.service || ''}`, sub: [a.bac_si_id ? `BS ${who(a.bac_si_id)}` : null, Number(a.revenue) ? money(Number(a.revenue) + Number(a.upsale_revenue || 0)) : null].filter(Boolean).join(' · ') });
  });
  (d.recordings || []).forEach(r => ev.push({ at: r.created_at, icon: Mic, tone: 'e-tone-sky', title: `Ghi âm tư vấn${r.ai_score != null ? ` · AI chấm ${r.ai_score}` : ''}`, sub: r.summary }));
  (d.reviews || []).forEach(r => ev.push({ at: r.submitted_at, icon: Smile, tone: 'e-tone-peach', title: `Đánh giá ${r.milestone || ''}${r.csat_score != null ? ` · CSAT ${r.csat_score}` : ''}${r.nps_score != null ? ` · NPS ${r.nps_score}` : ''}`, sub: r.comment }));
  (d.getfly_notes || []).forEach(n => ev.push({ at: n.created_at, icon: StickyNote, tone: 'e-tone-peach', title: n.is_feedback ? 'Phản hồi (GetFly)' : 'Ghi chú GetFly', sub: [n.title, n.content, n.creator_name].filter(Boolean).join(' · ') }));
  (d.messages || []).forEach(m => m.last_time && ev.push({ at: m.last_time, icon: MessageSquare, tone: 'e-tone-info', title: 'Tin nhắn Messenger', sub: m.last_message }));
  return ev.filter(e => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

const Kv = ({ label, children }) => (
  <div className="min-w-0"><div className="e-kv-label">{label}</div><div className="e-kv-value truncate">{children}</div></div>
);

function Customer360Drawer({ target, onClose }) {
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const [tab, setTab] = useState('timeline');
  const [lightbox, setLightbox] = useState(null); // { images, index }

  const load = useCallback(async () => {
    if (!target) return;
    setState({ loading: true, error: null, data: null });
    const { data, error } = await supabase.rpc('get_customer_360', { p_phone: target.phone });
    setState({ loading: false, error, data });
  }, [target]);

  useEffect(() => { if (target) { setTab('timeline'); load(); } }, [target, load]);

  const d = state.data;
  const appts = useMemo(() => d?.appointments || [], [d]);
  const names = d?.names;
  const who = useCallback((id) => (id ? names?.[id] || '—' : '—'), [names]);
  const lead = d?.lead;
  const name = lead?.customer_name || appts[0]?.customer_name || target?.name || 'Khách hàng';

  const surgeries = appts.filter(a => a.status === 'phau_thuat');
  const spend = surgeries.reduce((s, a) => s + Number(a.revenue || 0) + Number(a.upsale_revenue || 0), 0);
  const deposits = appts.reduce((s, a) => s + Number(a.deposit_amount || 0), 0);
  const since = [lead?.getfly_created_at, lead?.created_at, ...appts.map(a => a.created_at)].filter(Boolean).sort()[0];
  const csat = (d?.reviews || []).map(r => Number(r.csat_score)).filter(n => n > 0);
  const avgCsat = csat.length ? (csat.reduce((s, n) => s + n, 0) / csat.length) : null;
  const jIdx = journeyIndex(lead, appts);
  const missingRpc = !!state.error && (state.error.code === 'PGRST202' || /get_customer_360/.test(state.error.message || ''));

  const timeline = useMemo(() => (d?.found ? buildTimeline(d, lead, appts, who) : []), [d, lead, appts, who]);
  const images = useMemo(() => appts.flatMap(a => [['consult_image_urls', 'Ảnh tư vấn'], ['note_image_urls', 'Ảnh ghi chú'], ['deposit_bill_url', 'Bill cọc'], ['hospital_fee_proof', 'Chứng từ viện phí']]
    .flatMap(([k, label]) => urlsOf(a[k]).map(url => ({ url, label, service: a.service })))), [appts]);
  const mediaLinks = useMemo(() => (d?.media || []).flatMap(m => urlsOf(m.source_links).map(url => ({ url, m }))), [d]);
  const counts = { treatments: appts.length, images: images.length + mediaLinks.length, recordings: d?.recordings?.length || 0, reviews: d?.reviews?.length || 0 };

  let body;
  if (state.loading) {
    body = <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>;
  } else if (missingRpc) {
    body = <EmptyState title="Chưa bật Hồ sơ khách hàng 360" description="Chạy file supabase/customer_360.sql trong Supabase SQL Editor." />;
  } else if (state.error) {
    body = <ErrorState description={state.error.message} onRetry={load} />;
  } else if (d?.denied) {
    body = <PermissionDenied title="Bạn không có quyền xem hồ sơ khách này" description="Chỉ người phụ trách khách và các bộ phận liên quan mới xem được." />;
  } else if (d && !d.found) {
    body = <EmptyState title="Không tìm thấy khách hàng" description="Chưa có dữ liệu nào khớp số điện thoại này." />;
  } else if (d) {
    body = (
      <div className="space-y-4">
        {/* Đầu hồ sơ */}
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 grid place-items-center text-[20px] font-bold shrink-0">{initials(name)}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {lead?.status && <span className="e-badge e-badge-sm e-tone-brand">{LEAD_STATUS[lead.status] || lead.status}</span>}
              {appts[0] && <span className="e-badge e-badge-sm" style={{ background: apptTone(appts[0]).bg, color: apptTone(appts[0]).text }}>{apptTone(appts[0]).label}</span>}
            </div>
            <div className="text-[13.5px] text-slate-600 flex items-center gap-x-3 gap-y-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 tabular-nums"><Phone className="w-4 h-4 text-slate-400" />{d.phone}</span>
              {lead?.source && <span>Nguồn: {lead.source}</span>}
              {lead?.telesale_id && <span>Telesale: {who(lead.telesale_id)}</span>}
            </div>
          </div>
          {!d.phone_masked && d.phone && <a href={`tel:${d.phone}`} className="e-btn e-btn-secondary e-btn-sm shrink-0"><PhoneCall /> Gọi</a>}
        </div>

        {/* Chỉ số */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Tổng chi tiêu', value: money(spend), hint: `${surgeries.length} ca phẫu thuật` },
            { label: 'Tiền cọc', value: money(deposits), hint: `${appts.filter(a => Number(a.deposit_amount) > 0).length} lần cọc` },
            { label: 'Khách từ', value: day(since), hint: `${appts.length} lịch hẹn` },
            { label: 'Hài lòng (CSAT)', value: avgCsat != null ? avgCsat.toFixed(1) : '—', hint: `${csat.length} đánh giá` },
          ].map(m => (
            <div key={m.label} className="e-subtle px-3.5 py-3 min-w-0">
              <div className="e-kv-label">{m.label}</div>
              <div className="text-[17px] font-bold text-slate-900 tabular-nums truncate">{m.value}</div>
              <div className="text-[11.5px] text-slate-400 truncate">{m.hint}</div>
            </div>
          ))}
        </div>

        {/* Hành trình */}
        <ol className="e-steps" style={{ gridTemplateColumns: `repeat(${JOURNEY.length}, minmax(0, 1fr))` }} aria-label="Hành trình khách hàng">
          {JOURNEY.map((s, i) => {
            const st = i < jIdx ? 'done' : i === jIdx ? 'current' : 'todo';
            return <li key={s} className={`e-step e-step-${st}`}><span className="e-step-dot">{st === 'done' ? <Check /> : i + 1}</span><span>{s}</span></li>;
          })}
        </ol>

        <div className="e-tabs">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`e-tab ${tab === t.id ? 'e-tab-active' : ''}`}>
              <t.icon /> {t.label}{counts[t.id] ? <span className="e-tab-count">{counts[t.id]}</span> : null}
            </button>
          ))}
        </div>

        {tab === 'timeline' && (timeline.length === 0 ? <EmptyState title="Chưa có hoạt động" icon={History} /> : (
          <ol className="relative ml-4 border-l-[1.5px] border-slate-200 space-y-3.5 py-1">
            {timeline.map((e, i) => (
              <li key={i} className="relative pl-6">
                <span className={`absolute -left-[15px] top-0.5 w-7 h-7 rounded-full grid place-items-center ring-4 ring-white ${e.tone}`}><e.icon className="w-3.5 h-3.5" /></span>
                <div className="text-[13.5px] font-semibold text-slate-800">{e.title}</div>
                {e.sub && <div className="text-[12.5px] text-slate-500 line-clamp-2">{e.sub}</div>}
                <div className="text-[11.5px] text-slate-400 mt-0.5">{String(e.at).length <= 10 ? day(e.at) : dt(e.at)}</div>
              </li>
            ))}
          </ol>
        ))}

        {tab === 'treatments' && (appts.length === 0 ? <EmptyState title="Chưa có lịch hẹn" icon={CalendarDays} /> : (
          <div className="space-y-2.5">
            {appts.map(a => {
              const t = apptTone(a);
              return (
                <div key={a.id} className="e-card-flat px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900 min-w-0 truncate">{a.service || 'Chưa rõ dịch vụ'}</div>
                    <span className="e-badge e-badge-sm shrink-0" style={{ background: t.bg, color: t.text }}>{t.label}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                    <Kv label="Ngày hẹn">{day(a.appointment_date)}{a.appointment_time ? ` ${String(a.appointment_time).slice(0, 5)}` : ''}</Kv>
                    <Kv label="Sale">{who(a.sale_id)}</Kv>
                    <Kv label="Telesale">{who(a.telesale_id)}</Kv>
                    <Kv label={a.status === 'phau_thuat' ? 'Ngày mổ' : 'Ngày cọc'}>{day(a.status === 'phau_thuat' ? a.surgery_date : a.deposit_date)}</Kv>
                    {a.status === 'phau_thuat' && <>
                      <Kv label="Bác sĩ">{who(a.bac_si_id)}</Kv>
                      <Kv label="Loại mổ">{a.surgery_type || '—'}</Kv>
                      <Kv label="Tái khám tới">{day(a.next_recheck_at)}</Kv>
                      <Kv label="Hậu phẫu">{a.cskh_status || a.journey_status || '—'}</Kv>
                    </>}
                  </div>
                  {a.notes && <div className="mt-2 text-[12.5px] text-slate-500 line-clamp-2">{a.notes}</div>}
                </div>
              );
            })}
          </div>
        ))}

        {tab === 'payments' && (
          <div className="e-card overflow-hidden">
            <div className="e-table-wrap">
              <table className="e-table min-w-[560px]">
                <thead><tr><th>Dịch vụ</th><th className="num">Cọc</th><th className="num">Doanh thu</th><th className="num">Upsale</th><th className="num">Viện phí</th></tr></thead>
                <tbody>
                  {appts.filter(hasMoney).map(a => (
                    <tr key={a.id}>
                      <td><div className="font-medium text-slate-800">{a.service || '—'}</div><div className="text-[12px] text-slate-400">{day(a.surgery_date || a.deposit_date || a.appointment_date)}</div></td>
                      <td className="num">{Number(a.deposit_amount) ? money(a.deposit_amount) : '—'}</td>
                      <td className="num">{Number(a.revenue) ? money(a.revenue) : '—'}</td>
                      <td className="num">{Number(a.upsale_revenue) ? money(a.upsale_revenue) : '—'}</td>
                      <td className="num">{Number(a.hospital_fee) ? money(a.hospital_fee) : '—'}</td>
                    </tr>
                  ))}
                  {!appts.some(hasMoney) && <tr><td colSpan={5} className="!h-auto"><EmptyState title="Chưa có giao dịch" icon={Wallet} /></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'images' && (images.length + mediaLinks.length === 0 ? <EmptyState title="Chưa có hình ảnh" icon={ImageIcon} /> : (
          <div className="space-y-4">
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {images.map((img, i) => (
                  <button key={img.url + i} onClick={() => setLightbox({ images: images.map(x => x.url), index: i })}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80" title={`${img.label}${img.service ? ` · ${img.service}` : ''}`}>
                    <img src={img.url} alt={img.label} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10.5px] font-semibold text-white bg-gradient-to-t from-black/60 to-transparent truncate">{img.label}</span>
                  </button>
                ))}
              </div>
            )}
            {mediaLinks.length > 0 && (
              <div>
                <div className="e-caption mb-2">Tư liệu media</div>
                <div className="space-y-1.5">
                  {mediaLinks.map(({ url, m }, i) => (
                    <a key={url + i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] text-teal-700 hover:underline truncate">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />{[m.service, m.source_type, m.shoot_date ? day(m.shoot_date) : null].filter(Boolean).join(' · ') || url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {tab === 'recordings' && ((d.recordings || []).length === 0 ? <EmptyState title="Chưa có ghi âm tư vấn" icon={Mic} /> : (
          <div className="space-y-2.5">
            {d.recordings.map(r => (
              <div key={r.id} className="e-card-flat px-4 py-3 flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 grid place-items-center shrink-0"><Mic className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{dt(r.created_at)}</span>
                    {r.duration_sec ? <span className="text-[12px] text-slate-500">{Math.max(1, Math.round(r.duration_sec / 60))} phút</span> : null}
                    {r.ai_score != null && <span className="e-badge e-badge-sm e-tone-brand">AI chấm {r.ai_score}</span>}
                  </div>
                  {r.summary && <div className="text-[13px] text-slate-600 mt-1">{r.summary}</div>}
                  {r.created_by && <div className="text-[12px] text-slate-400 mt-0.5">Ghi bởi {who(r.created_by)}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}

        {tab === 'reviews' && ((d.reviews || []).length === 0 ? <EmptyState title="Chưa có đánh giá dịch vụ" icon={Smile} /> : (
          <div className="space-y-2.5">
            {d.reviews.map(r => (
              <div key={r.id} className="e-card-flat px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{r.milestone || 'Đánh giá'}{r.service ? ` · ${r.service}` : ''}</span>
                  {r.csat_score != null && <span className="e-badge e-badge-sm e-tone-success">CSAT {r.csat_score}</span>}
                  {r.nps_score != null && <span className="e-badge e-badge-sm e-tone-info">NPS {r.nps_score}</span>}
                  <span className="text-[12px] text-slate-400 ml-auto">{dt(r.submitted_at)}</span>
                </div>
                {r.comment && <div className="text-[13px] text-slate-600 mt-1">“{r.comment}”</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <Drawer open={!!target} onClose={onClose} size="lg" title={d?.found ? name : (target?.name || 'Hồ sơ khách hàng')}
        description="Hồ sơ khách hàng 360 · chỉ xem, chỉnh sửa ở màn nghiệp vụ">
        {body}
      </Drawer>
      {lightbox && <ImageLightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </>
  );
}
