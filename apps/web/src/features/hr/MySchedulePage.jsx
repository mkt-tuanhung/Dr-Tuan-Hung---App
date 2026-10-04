// ============================================================
// LỊCH LÀM VIỆC CỦA TÔI — theo Ethics mobile "09 Lịch làm việc cá nhân".
// Nhân sự xem ca đã công bố theo tuần + ai cùng ca trong ngày.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ymd, parseYmd, addDays, mondayOf, DOW } from './SchedulePage.jsx';

const pad = (n) => String(n).padStart(2, '0');
const dm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const hours = (s) => {
  if (!s || s.is_off) return 0;
  const m = (t) => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi; };
  let e = m(s.end_time); const b = m(s.start_time); if (e <= b) e += 1440;
  return Math.round((e - b) / 60);
};

export default function MySchedulePage() {
  const { profile: me } = useAuth();
  const [week, setWeek] = useState(() => ymd(mondayOf(new Date())));
  const [shifts, setShifts] = useState([]);
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [openDay, setOpenDay] = useState(null);

  const weekStart = parseYmd(week);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => ymd(addDays(parseYmd(week), i))), [week]);
  const today = ymd(new Date());
  const shiftById = useMemo(() => Object.fromEntries(shifts.map(s => [s.id, s])), [shifts]);

  const load = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    const [sh, sc, pf] = await Promise.all([
      supabase.from('work_shifts').select('*').order('sort'),
      supabase.from('staff_schedules').select('staff_id, date, shift_id, status').eq('status', 'published').gte('date', dates[0]).lte('date', dates[6]),
      supabase.from('profiles').select('id, full_name').eq('is_active', true),
    ]);
    setMissing(!!sh.error || !!sc.error);
    setShifts(sh.data || []);
    setAll(sc.data || []);
    setMine((sc.data || []).filter(r => r.staff_id === me.id));
    setNames(Object.fromEntries((pf.data || []).map(p => [p.id, p.full_name])));
    setLoading(false);
  }, [dates, me?.id]);
  useEffect(() => { load(); }, [load]);

  const myOf = (d) => mine.find(r => r.date === d);
  const totalHours = dates.reduce((t, d) => t + hours(shiftById[myOf(d)?.shift_id]), 0);
  const workDays = dates.filter(d => { const s = shiftById[myOf(d)?.shift_id]; return s && !s.is_off; }).length;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Điều hướng tuần — điện thoại: thanh chọn kiểu Ethics (M09); máy tính: thanh công cụ như cũ */}
      <div className="flex items-center gap-2 lg:e-toolbar lg:justify-between">
        <div className="flex-1 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center h-12 rounded-[14px] border border-slate-200/80 bg-white shadow-soft lg:flex-none lg:inline-flex lg:h-10 lg:rounded-xl lg:border-slate-200 lg:shadow-none">
          <button onClick={() => setWeek(ymd(addDays(weekStart, -7)))} className="w-11 lg:w-9 h-full grid place-items-center text-slate-500 hover:text-teal-700" aria-label="Tuần trước"><ChevronLeft className="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <span className="inline-flex items-center justify-center gap-2 px-1 text-[15px] lg:text-[13.5px] font-semibold text-slate-900 lg:text-slate-700 whitespace-nowrap tabular-nums min-w-0"><CalendarDays className="w-4 h-4 text-teal-600 shrink-0" />{dm(weekStart)} - {dm(addDays(weekStart, 6))}/{addDays(weekStart, 6).getFullYear()}</span>
          <button onClick={() => setWeek(ymd(addDays(weekStart, 7)))} className="w-11 lg:w-9 h-full grid place-items-center text-slate-500 hover:text-teal-700" aria-label="Tuần sau"><ChevronRight className="w-5 h-5 lg:w-4 lg:h-4" /></button>
        </div>
        {week !== ymd(mondayOf(new Date())) && <button onClick={() => setWeek(ymd(mondayOf(new Date())))} className="e-btn e-btn-ghost e-btn-sm shrink-0 max-lg:h-12 max-lg:px-3.5 max-lg:rounded-[14px] max-lg:bg-white max-lg:border-slate-200/80 max-lg:shadow-soft">Tuần này</button>}
      </div>

      {missing && <div className="rounded-2xl border border-warning-100 bg-warning-50 text-warning-700 px-4 py-3 text-[13px] flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />Chức năng phân ca chưa được kích hoạt. Vui lòng báo Admin.</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="e-metric max-lg:gap-3 max-lg:p-3.5"><span className="e-metric-icon max-lg:w-10 max-lg:h-10"><CalendarDays className="max-lg:!w-5 max-lg:!h-5" /></span><div className="min-w-0"><div className="e-metric-label max-lg:text-[12.5px]">Ngày làm</div><div className="e-metric-value">{workDays} ngày</div></div></div>
        <div className="e-metric max-lg:gap-3 max-lg:p-3.5"><span className="e-metric-icon e-tone-sky max-lg:w-10 max-lg:h-10"><Clock className="max-lg:!w-5 max-lg:!h-5" /></span><div className="min-w-0"><div className="e-metric-label max-lg:text-[12.5px]">Giờ làm</div><div className="e-metric-value">{totalHours} giờ</div></div></div>
      </div>

      {/* Điện thoại: dải 7 ngày (hàng 1) + thẻ ca hôm nay (lên đầu) + thẻ từng ngày có thanh màu ca.
          Máy tính (lg): giữ nguyên thẻ danh sách chia dòng như cũ. */}
      <div className="grid grid-cols-7 gap-x-0.5 gap-y-3 lg:block lg:e-card lg:divide-y lg:divide-slate-100">
        {loading ? <div className="col-span-7 py-16 grid place-items-center rounded-2xl bg-white border border-slate-200/80 shadow-soft lg:rounded-none lg:bg-transparent lg:border-0 lg:shadow-none"><div className="w-7 h-7 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div> : dates.map((d, i) => {
          const it = myOf(d); const sh = it && shiftById[it.shift_id];
          const mates = sh && !sh.is_off ? all.filter(r => r.date === d && r.shift_id === sh.id && r.staff_id !== me?.id) : [];
          const isToday = d === today;
          return (
            <div key={d} className={`contents lg:block lg:px-5 lg:py-3.5 ${isToday ? 'lg:bg-teal-50/40' : ''}`}>
              {/* Ô ngày trên dải tuần (chỉ điện thoại) */}
              <div className={`lg:hidden row-start-1 relative flex flex-col items-center gap-1 pt-1.5 pb-3 min-h-[62px] rounded-[14px] ${isToday ? 'bg-gradient-to-br from-[#067B7F] to-[#3CA7A9] text-white shadow-nav' : 'text-slate-700'}`}>
                <span className={`text-[12px] leading-4 whitespace-nowrap tracking-[-0.02em] ${isToday ? 'text-white/85' : 'text-slate-400'}`}>{DOW[i].replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</span>
                <span className="text-[17px] font-semibold leading-5 tabular-nums">{pad(parseYmd(d).getDate())}</span>
                {sh ? <i className={`absolute bottom-1.5 w-[6px] h-[6px] rounded-full e-shift-${sh.tone} ${isToday ? '!bg-white' : '!bg-current'}`} aria-hidden="true" /> : <i className="hidden" />}
              </div>

              {/* Thẻ ngày — điện thoại: thẻ trắng có thanh màu ca; hôm nay = thẻ lớn ở đầu */}
              <div className={`group col-span-7 relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-soft pl-4 pr-3 py-3.5 lg:contents ${isToday ? 'is-today max-lg:order-first max-lg:py-5 max-lg:border-teal-200 max-lg:bg-gradient-to-br max-lg:from-teal-50 max-lg:to-white max-lg:shadow-card' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-14 text-center shrink-0 ${isToday ? 'text-teal-700' : 'text-slate-700'}`}>
                    <div className="text-[12px] font-medium whitespace-nowrap">{DOW[i]}</div>
                    <div className="text-[20px] max-lg:group-[.is-today]:text-[28px] font-bold leading-tight tabular-nums">{pad(parseYmd(d).getDate())}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="hidden max-lg:group-[.is-today]:block text-[11.5px] font-semibold uppercase tracking-wide text-teal-700 mb-1.5">Ca hôm nay</div>
                    {sh ? (
                      <>
                        <span className={`lg:hidden absolute left-0 inset-y-0 w-1 e-shift-${sh.tone} !bg-current`} aria-hidden="true" />
                        <span className={`e-badge e-shift-${sh.tone} max-lg:group-[.is-today]:h-8 max-lg:group-[.is-today]:px-3 max-lg:group-[.is-today]:text-[14px]`}>{sh.name}</span>
                        {!sh.is_off && <div className="text-[13px] text-slate-600 mt-1.5 lg:mt-1 flex lg:inline-flex items-center gap-1.5 lg:ml-2 tabular-nums max-lg:group-[.is-today]:text-[14px] max-lg:group-[.is-today]:font-semibold max-lg:group-[.is-today]:text-slate-800"><Clock className="w-3.5 h-3.5 text-slate-400" />{sh.start_time} – {sh.end_time}</div>}
                      </>
                    ) : <span className="text-[13px] text-slate-400">Chưa có lịch</span>}
                  </div>
                  {isToday && <span className="e-badge e-badge-sm e-tone-brand shrink-0 max-lg:hidden">Hôm nay</span>}
                  {mates.length > 0 && (
                    <button onClick={() => setOpenDay(openDay === d ? null : d)} className="e-btn e-btn-ghost e-btn-sm shrink-0 max-lg:h-9 max-lg:rounded-full max-lg:bg-teal-50 max-lg:px-3"><Users />{mates.length}</button>
                  )}
                </div>
                {openDay === d && mates.length > 0 && (
                  <div className="mt-2 ml-[68px] flex flex-wrap gap-1.5">
                    {mates.map(m => <span key={m.staff_id} className="e-badge e-badge-sm e-tone-neutral">{names[m.staff_id] || 'Nhân sự'}</span>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Tiêu đề mục (chỉ điện thoại) — đặt cuối DOM để không ảnh hưởng divide-y bản máy tính, hiển thị nhờ order */}
        <div className="lg:hidden col-span-7 order-[-1] text-[16px] font-bold text-slate-900 mt-2 -mb-0.5 px-0.5">Lịch trong tuần</div>
      </div>
      <p className="text-[12px] text-slate-400 px-1">Chỉ hiển thị lịch đã được công bố. Bấm biểu tượng người để xem ai cùng ca.</p>
    </div>
  );
}
