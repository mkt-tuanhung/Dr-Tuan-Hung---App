// ============================================================
// BỘ KHỐI TRANG TỔNG QUAN (Ethics BOS): thẻ chào + vòng điểm,
// dải chấm công nhanh, lưới thao tác nhanh, thẻ chỉ số.
// Dùng chung cho Tổng quan Admin và Nhân sự.
// ============================================================
import React, { useEffect, useState } from 'react';
import { ScanFace, LogIn, LogOut, CheckCircle2, ChevronRight, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { vnToday } from '@/lib/vnTime';

const pad2 = (n) => String(n).padStart(2, '0');

export const greetingOf = (d = new Date()) => {
  const h = d.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

export const fmtToday = (d = new Date()) => {
  const wd = d.getDay() === 0 ? 'Chủ nhật' : `Thứ ${d.getDay() + 1}`;
  return `${wd}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Vòng điểm (0–100)
export const ScoreRing = ({ value = 0, size = 112, stroke = 10, color = '#468A86', track = '#E4EFEE', children }) => {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
};

const ringColor = (v) => (v >= 80 ? '#468A86' : v >= 50 ? '#E5A13C' : '#D9635C');

// Thẻ chào + điểm
// ring: { value, label, sub, unit } ; stats: [{ label, value, sub, onClick, icon }]
export const HeroCard = ({ profile, roleLabel, ring, stats = [], extra, actions }) => {
  const now = new Date();
  const initials = (profile?.full_name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="rounded-3xl bg-white shadow-card border border-slate-200/70 p-5 lg:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        {/* Chào */}
        <div className="flex items-center gap-4 min-w-0 lg:flex-1">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl object-cover shrink-0" />
            : <span className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-teal-600 text-white grid place-items-center text-lg font-bold shrink-0">{initials}</span>}
          <div className="min-w-0">
            <div className="text-[13px] text-slate-500">{greetingOf(now)} 👋</div>
            <div className="text-[20px] lg:text-[24px] font-bold text-slate-900 leading-tight truncate">{profile?.full_name || 'Bạn'}</div>
            <div className="text-[12.5px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {roleLabel && <span className="font-semibold text-teal-700 bg-teal-50 rounded-full px-2 py-0.5">{roleLabel}</span>}
              <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{fmtToday(now)}</span>
            </div>
            {extra && <div className="mt-2">{extra}</div>}
          </div>
        </div>

        {/* Vòng điểm */}
        {ring && (
          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3 lg:w-[280px] shrink-0">
            <ScoreRing value={ring.value} size={92} stroke={9} color={ringColor(ring.value)}>
              <div>
                <div className="text-[22px] font-extrabold text-slate-900 leading-none tabular-nums">{ring.display ?? Math.round(ring.value)}</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">{ring.unit ?? '%'}</div>
              </div>
            </ScoreRing>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-slate-800 leading-snug">{ring.label}</div>
              {ring.sub && <div className="text-[12px] text-slate-500 mt-0.5">{ring.sub}</div>}
              {ring.onClick && <button onClick={ring.onClick} className="mt-1.5 text-[12px] font-semibold text-teal-700 inline-flex items-center gap-0.5 hover:underline">Chi tiết <ChevronRight className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        )}
      </div>

      {/* Số nhanh */}
      {stats.length > 0 && (
        <div className={`grid gap-2 mt-5 pt-5 border-t border-slate-100 ${stats.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`}>
          {stats.map(s => (
            <button key={s.label} onClick={s.onClick} disabled={!s.onClick}
              className="text-left rounded-xl px-3 py-2 hover:bg-slate-50 transition disabled:hover:bg-transparent disabled:cursor-default min-w-0">
              <div className="text-[11.5px] lg:text-[12.5px] text-slate-500 truncate">{s.label}</div>
              <div className="text-[18px] lg:text-[22px] font-bold text-slate-900 tabular-nums leading-tight mt-0.5 truncate">{s.value}</div>
              {s.sub && <div className={`text-[11px] mt-0.5 truncate ${s.subTone || 'text-slate-400'}`}>{s.sub}</div>}
            </button>
          ))}
        </div>
      )}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
};

// Dải chấm công nhanh — đọc bản ghi chấm công hôm nay của chính mình
export const CheckinStrip = ({ profile, onOpen }) => {
  const [rec, setRec] = useState(undefined);
  const [clock, setClock] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!profile?.id) return;
    // Cùng quy ước ngày với trang Chấm công
    const todayStr = vnToday();
    supabase.from('attendance').select('check_in, check_out, status').eq('staff_id', profile.id).eq('date', todayStr).maybeSingle()
      .then(({ data }) => setRec(data || null));
  }, [profile?.id]);

  const t5 = (s) => (s ? String(s).slice(0, 5) : '--:--');
  const state = rec === undefined ? 'loading' : !rec?.check_in ? 'none' : !rec.check_out ? 'in' : 'done';
  const meta = {
    loading: { title: 'Đang tải chấm công…', cta: null, tone: 'bg-white' },
    none: { title: 'Bạn chưa chấm công vào hôm nay', cta: 'Chấm công vào', icon: LogIn, tone: 'bg-gradient-to-r from-teal-600 to-teal-500 text-white' },
    in: { title: 'Đang trong ca', cta: 'Chấm công ra', icon: LogOut, tone: 'bg-white' },
    done: { title: 'Đã hoàn thành ca hôm nay', cta: null, tone: 'bg-white' },
  }[state];
  const dark = state === 'none';
  return (
    <div className={`rounded-2xl shadow-soft border ${dark ? 'border-transparent' : 'border-slate-200/70'} ${meta.tone} p-4 flex items-center gap-3`}>
      <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${dark ? 'bg-white/15' : state === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-teal-50 text-teal-700'}`}>
        {state === 'done' ? <CheckCircle2 className="w-5 h-5" /> : <ScanFace className="w-5 h-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[13.5px] sm:text-[14px] font-bold leading-snug ${dark ? 'text-white' : 'text-slate-800'}`}>{meta.title}</div>
        <div className={`text-[12px] mt-0.5 tabular-nums ${dark ? 'text-white/80' : 'text-slate-500'}`}>
          {state === 'none' ? `Bây giờ ${pad2(clock.getHours())}:${pad2(clock.getMinutes())}` : `Vào ${t5(rec?.check_in)} · Ra ${t5(rec?.check_out)}`}
        </div>
      </div>
      {meta.cta ? (
        <button onClick={onOpen} className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-xl text-[13px] font-bold transition ${dark ? 'bg-white text-teal-700 hover:bg-teal-50' : 'bg-teal-600 text-white hover:bg-teal-700'}`}>
          <meta.icon className="w-4 h-4" />{meta.cta}
        </button>
      ) : state === 'done' ? (
        <button onClick={onOpen} className="shrink-0 text-[12.5px] font-semibold text-teal-700 inline-flex items-center gap-0.5 hover:underline">Lịch sử <ChevronRight className="w-4 h-4" /></button>
      ) : null}
    </div>
  );
};

// Lưới thao tác nhanh
// items: [{ id, label, icon, color }]
export const QuickActions = ({ items = [], onSelect, title = 'Thao tác nhanh' }) => {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl bg-white shadow-soft border border-slate-200/70 p-4 lg:p-5">
      <div className="text-[15px] font-bold text-slate-800 mb-3">{title}</div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5 lg:gap-2">
        {items.map(q => (
          <button key={q.id + q.label} onClick={() => onSelect(q.id)} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-slate-50 transition group">
            <span className="w-12 h-12 rounded-2xl grid place-items-center transition group-hover:scale-105" style={{ backgroundColor: q.color + '1a' }}>
              <q.icon className="w-[22px] h-[22px]" style={{ color: q.color }} />
            </span>
            <span className="text-[11.5px] text-slate-600 font-medium text-center leading-tight line-clamp-2">{q.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Thẻ chỉ số kiểu Ethics: nhãn trái, icon phải, số lớn, xu hướng
export const StatCard = ({ icon: Icon, label, value, sub, trend, color = '#468A86', onClick, bar }) => (
  <button onClick={onClick} disabled={!onClick}
    className="text-left rounded-2xl bg-white p-4 shadow-card border border-transparent hover:border-slate-200 transition disabled:cursor-default min-w-0">
    <div className="flex items-start justify-between gap-2">
      <span className="text-[12.5px] lg:text-[13px] text-slate-500 font-medium leading-snug truncate pt-1" title={typeof label === 'string' ? label : undefined}>{label}</span>
      {Icon && <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ backgroundColor: color + '1a' }}><Icon className="w-[18px] h-[18px]" style={{ color }} /></span>}
    </div>
    <div className="text-[22px] lg:text-[24px] font-bold text-slate-900 tabular-nums leading-tight mt-1 truncate">{value}</div>
    {bar != null && <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, bar)}%`, backgroundColor: color }} /></div>}
    <div className="text-[11.5px] mt-1 flex items-center gap-1.5 min-w-0">
      {trend && <span className={`font-bold shrink-0 ${trend.up ? 'text-emerald-600' : 'text-rose-500'}`}>{trend.txt}</span>}
      {sub && <span className="text-slate-400 truncate">{sub}</span>}
    </div>
  </button>
);

// Khung thẻ nội dung
export const Panel = ({ title, action, children, className = '' }) => (
  <div className={`rounded-2xl bg-white shadow-soft border border-slate-200/70 p-4 lg:p-5 min-w-0 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
        {action}
      </div>
    )}
    {children}
  </div>
);
