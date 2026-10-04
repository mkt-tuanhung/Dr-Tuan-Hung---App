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
      <div className="e-toolbar justify-between">
        <div className="inline-flex items-center h-10 rounded-xl border border-slate-200 bg-white">
          <button onClick={() => setWeek(ymd(addDays(weekStart, -7)))} className="w-9 h-full grid place-items-center text-slate-500 hover:text-teal-700" aria-label="Tuần trước"><ChevronLeft className="w-4 h-4" /></button>
          <span className="inline-flex items-center gap-2 px-1 text-[13.5px] font-semibold text-slate-700 whitespace-nowrap"><CalendarDays className="w-4 h-4 text-teal-600" />{dm(weekStart)} - {dm(addDays(weekStart, 6))}/{addDays(weekStart, 6).getFullYear()}</span>
          <button onClick={() => setWeek(ymd(addDays(weekStart, 7)))} className="w-9 h-full grid place-items-center text-slate-500 hover:text-teal-700" aria-label="Tuần sau"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {week !== ymd(mondayOf(new Date())) && <button onClick={() => setWeek(ymd(mondayOf(new Date())))} className="e-btn e-btn-ghost e-btn-sm">Tuần này</button>}
      </div>

      {missing && <div className="rounded-2xl border border-warning-100 bg-warning-50 text-warning-700 px-4 py-3 text-[13px] flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />Chức năng phân ca chưa được kích hoạt. Vui lòng báo Admin.</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="e-metric"><span className="e-metric-icon"><CalendarDays /></span><div className="min-w-0"><div className="e-metric-label">Ngày làm</div><div className="e-metric-value">{workDays} ngày</div></div></div>
        <div className="e-metric"><span className="e-metric-icon e-tone-sky"><Clock /></span><div className="min-w-0"><div className="e-metric-label">Giờ làm</div><div className="e-metric-value">{totalHours} giờ</div></div></div>
      </div>

      <div className="e-card divide-y divide-slate-100">
        {loading ? <div className="py-16 grid place-items-center"><div className="w-7 h-7 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div> : dates.map((d, i) => {
          const it = myOf(d); const sh = it && shiftById[it.shift_id];
          const mates = sh && !sh.is_off ? all.filter(r => r.date === d && r.shift_id === sh.id && r.staff_id !== me?.id) : [];
          const isToday = d === today;
          return (
            <div key={d} className={`px-4 lg:px-5 py-3.5 ${isToday ? 'bg-teal-50/40' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-14 text-center shrink-0 ${isToday ? 'text-teal-700' : 'text-slate-700'}`}>
                  <div className="text-[12px] font-medium">{DOW[i]}</div>
                  <div className="text-[20px] font-bold leading-tight tabular-nums">{pad(parseYmd(d).getDate())}</div>
                </div>
                <div className="min-w-0 flex-1">
                  {sh ? (
                    <>
                      <span className={`e-badge e-shift-${sh.tone}`}>{sh.name}</span>
                      {!sh.is_off && <div className="text-[13px] text-slate-600 mt-1 inline-flex items-center gap-1.5 ml-2"><Clock className="w-3.5 h-3.5 text-slate-400" />{sh.start_time} – {sh.end_time}</div>}
                    </>
                  ) : <span className="text-[13px] text-slate-400">Chưa có lịch</span>}
                </div>
                {isToday && <span className="e-badge e-badge-sm e-tone-brand shrink-0">Hôm nay</span>}
                {mates.length > 0 && (
                  <button onClick={() => setOpenDay(openDay === d ? null : d)} className="e-btn e-btn-ghost e-btn-sm shrink-0"><Users />{mates.length}</button>
                )}
              </div>
              {openDay === d && mates.length > 0 && (
                <div className="mt-2 ml-[68px] flex flex-wrap gap-1.5">
                  {mates.map(m => <span key={m.staff_id} className="e-badge e-badge-sm e-tone-neutral">{names[m.staff_id] || 'Nhân sự'}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[12px] text-slate-400 px-1">Chỉ hiển thị lịch đã được công bố. Bấm biểu tượng người để xem ai cùng ca.</p>
    </div>
  );
}
