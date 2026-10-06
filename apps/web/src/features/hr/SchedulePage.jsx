// ============================================================
// LỊCH LÀM VIỆC / PHÂN CA — theo Ethics BOS (features/hr/SchedulePage)
// Admin xếp ca theo tuần (bấm ô để chọn ca, kéo thả để chép ca), lưu NHÁP,
// "Công bố lịch" để nhân sự nhận thông báo. Tự cảnh báo phân ca bất hợp lý.
// Bảng: work_shifts, staff_schedules (supabase/work_schedule.sql).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Download, Megaphone, TriangleAlert, Trash2, Users, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ROLE_LABELS } from '@/features/permissions/menuConfig';

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const DOW = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const dm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const toMin = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const missingTable = (e) => !!e && /does not exist|PGRST205|42P01|42883|schema cache|Could not find/i.test(`${e.code} ${e.message}`);

// Cảnh báo phân ca (theo Ethics packages/shared/src/rules.ts — scheduleWarnings)
export function scheduleWarnings(items, shiftById, weekDates) {
  const out = [];
  const byStaff = new Map();
  items.forEach(it => byStaff.set(it.staff_id, [...(byStaff.get(it.staff_id) || []), it]));
  for (const [sid, list] of byStaff) {
    const working = list.filter(i => shiftById[i.shift_id] && !shiftById[i.shift_id].is_off);
    const perDay = new Map(working.map(w => [w.date, w]));
    const days = weekDates.filter(d => perDay.has(d));
    if (days.length > 6) out.push({ staff_id: sid, date: days[days.length - 1], message: `${days.length} ngày làm việc liên tục trong tuần` });
    for (let i = 1; i < weekDates.length; i++) {
      const prev = perDay.get(weekDates[i - 1]); const cur = perDay.get(weekDates[i]);
      if (!prev || !cur) continue;
      const ps = shiftById[prev.shift_id]; const cs = shiftById[cur.shift_id];
      let prevEnd = toMin(ps.end_time); if (prevEnd <= toMin(ps.start_time)) prevEnd += 1440;
      const rest = 1440 + toMin(cs.start_time) - prevEnd;
      if (rest < 660) out.push({ staff_id: sid, date: weekDates[i], message: `Chỉ nghỉ ${Math.max(0, Math.round(rest / 60))}h giữa ${ps.name} và ${cs.name}` });
    }
  }
  return out;
}

function Confirm({ title, desc, label, danger, busy, onClose, onOk }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="e-modal-backdrop" onClick={onClose} />
      <div className="e-modal max-w-md">
        <div className="e-modal-header"><div className="e-modal-title">{title}</div><button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <div className="e-modal-body text-[13.5px] text-slate-600">{desc}</div>
        <div className="e-modal-footer">
          <button onClick={onClose} className="e-btn e-btn-secondary">Huỷ</button>
          <button onClick={onOk} disabled={busy} className={`e-btn ${danger ? 'e-btn-danger' : 'e-btn-primary'}`}>{busy ? 'Đang xử lý…' : label}</button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { profile: me } = useAuth();
  const [week, setWeek] = useState(() => ymd(mondayOf(new Date())));
  const [role, setRole] = useState('all');
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [items, setItems] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [pick, setPick] = useState(null);        // { staff, date, rect }
  const [drag, setDrag] = useState(null);        // { staff_id, date, shift_id }
  const [over, setOver] = useState(null);
  const [confirm, setConfirm] = useState(null);  // 'publish' | 'copy'
  const [busy, setBusy] = useState(false);
  const [mDay, setMDay] = useState(null);       // ngày đang xem trên mobile
  const pickRef = useRef(null);

  const weekStart = parseYmd(week);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => ymd(addDays(parseYmd(week), i))), [week]);
  const today = ymd(new Date());
  const day = mDay && dates.includes(mDay) ? mDay : (dates.includes(today) ? today : dates[0]);
  const shiftById = useMemo(() => Object.fromEntries(shifts.map(s => [s.id, s])), [shifts]);

  const load = useCallback(async () => {
    setLoading(true);
    const end = dates[6];
    const [sh, pf, sc, lv] = await Promise.all([
      supabase.from('work_shifts').select('*').eq('active', true).order('sort'),
      supabase.from('profiles').select('id, full_name, role, role_2, position, avatar_url').eq('is_active', true).order('full_name'),
      supabase.from('staff_schedules').select('staff_id, date, shift_id, status').gte('date', dates[0]).lte('date', end),
      supabase.from('leave_requests').select('staff_id, date, type, half_day_period, status').eq('status', 'approved').eq('type', 'leave').gte('date', dates[0]).lte('date', end),
    ]);
    setMissing(missingTable(sh.error) || missingTable(sc.error));
    setShifts(sh.data || []);
    setStaff((pf.data || []).filter(p => p.role !== 'admin'));
    setItems(sc.data || []);
    setLeaves(lv.data || []);
    setLoading(false);
  }, [dates]);
  useEffect(() => { load(); }, [load]);

  // Đóng bảng chọn ca khi bấm ra ngoài
  useEffect(() => {
    if (!pick) return undefined;
    const h = (e) => { if (pickRef.current && !pickRef.current.contains(e.target)) setPick(null); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [pick]);

  const rows = staff.filter(s => role === 'all' || s.role === role || s.role_2 === role);
  const rowIds = new Set(rows.map(r => r.id));
  const itemOf = (sid, date) => items.find(i => i.staff_id === sid && i.date === date);
  const leaveOf = (sid, date) => leaves.find(l => l.staff_id === sid && l.date === date);
  const visibleItems = items.filter(i => rowIds.has(i.staff_id));
  const warnings = useMemo(() => scheduleWarnings(visibleItems, shiftById, dates), [visibleItems, shiftById, dates]); // eslint-disable-line react-hooks/exhaustive-deps
  const warnOf = (sid, date) => warnings.filter(w => w.staff_id === sid && w.date === date);
  const draftCount = items.filter(i => i.status === 'draft').length;
  const roleOptions = [...new Set(staff.flatMap(s => [s.role, s.role_2]).filter(Boolean))];

  const setShift = async (sid, date, shiftId) => {
    const before = items;
    setItems(list => [...list.filter(i => !(i.staff_id === sid && i.date === date)), { staff_id: sid, date, shift_id: shiftId, status: 'draft' }]);
    const { error } = await supabase.from('staff_schedules').upsert({ staff_id: sid, date, shift_id: shiftId, status: 'draft', updated_by: me?.id, updated_at: new Date().toISOString() }, { onConflict: 'staff_id,date' });
    if (error) { setItems(before); toast.error('Lỗi xếp ca: ' + error.message); }
  };
  const clearShift = async (sid, date) => {
    const before = items;
    setItems(list => list.filter(i => !(i.staff_id === sid && i.date === date)));
    const { error } = await supabase.from('staff_schedules').delete().eq('staff_id', sid).eq('date', date);
    if (error) { setItems(before); toast.error('Lỗi: ' + error.message); }
  };

  const copyPrev = async () => {
    setBusy(true);
    const prevStart = ymd(addDays(weekStart, -7)); const prevEnd = ymd(addDays(weekStart, -1));
    const { data, error } = await supabase.from('staff_schedules').select('staff_id, date, shift_id').gte('date', prevStart).lte('date', prevEnd);
    if (error) { setBusy(false); return toast.error('Lỗi: ' + error.message); }
    const payload = (data || []).filter(r => rowIds.has(r.staff_id)).map(r => ({
      staff_id: r.staff_id, date: ymd(addDays(parseYmd(r.date), 7)), shift_id: r.shift_id, status: 'draft', updated_by: me?.id, updated_at: new Date().toISOString(),
    }));
    if (!payload.length) { setBusy(false); setConfirm(null); return toast.info('Tuần trước chưa có ca nào để chép'); }
    const { error: e2 } = await supabase.from('staff_schedules').upsert(payload, { onConflict: 'staff_id,date' });
    setBusy(false); setConfirm(null);
    if (e2) return toast.error('Lỗi: ' + e2.message);
    toast.success(`Đã chép ${payload.length} ca từ tuần trước (bản nháp)`); load();
  };
  const publish = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('publish_schedule_week', { week_start: week });
    setBusy(false); setConfirm(null);
    if (error) return toast.error('Lỗi công bố: ' + error.message);
    toast.success(`Đã công bố lịch tuần (${data || 0} ca) — nhân sự nhận thông báo trên app`); load();
  };
  const exportCsv = () => {
    const head = ['Nhân viên', 'Vị trí', ...dates.map((d, i) => `${DOW[i]} ${dm(parseYmd(d))}`)];
    const body = rows.map(s => [s.full_name, s.position || ROLE_LABELS[s.role] || '', ...dates.map(d => {
      if (leaveOf(s.id, d)) return 'Nghỉ phép';
      const it = itemOf(s.id, d); const sh = it && shiftById[it.shift_id];
      return sh ? `${sh.name}${sh.is_off ? '' : ` ${sh.start_time}-${sh.end_time}`}` : '';
    })]);
    const csv = '﻿' + [head, ...body].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `lich-lam-viec-${week}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast.success('Đã xuất file Excel (CSV)');
  };

  const weekLabel = `Tuần ${dm(weekStart)} - ${dm(addDays(weekStart, 6))}/${addDays(weekStart, 6).getFullYear()}`;

  return (
    <div className="space-y-3">
      {/* Thanh công cụ (Ethics sch-bar) */}
      <div className="e-toolbar pl-4 lg:pl-5">
        <h2 className="text-[20px] lg:text-[22px] font-bold text-slate-900 mr-2">Lịch làm việc</h2>
        <div className="inline-flex items-center h-10 rounded-xl border border-slate-200 bg-white">
          <button onClick={() => setWeek(ymd(addDays(weekStart, -7)))} className="w-9 h-full grid place-items-center text-slate-500 hover:text-teal-700" aria-label="Tuần trước"><ChevronLeft className="w-4 h-4" /></button>
          <span className="inline-flex items-center gap-2 px-1 text-[13.5px] font-semibold text-slate-700 whitespace-nowrap"><CalendarDays className="w-4 h-4 text-teal-600" />{weekLabel}</span>
          <button onClick={() => setWeek(ymd(addDays(weekStart, 7)))} className="w-9 h-full grid place-items-center text-slate-500 hover:text-teal-700" aria-label="Tuần sau"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {week !== ymd(mondayOf(new Date())) && <button onClick={() => setWeek(ymd(mondayOf(new Date())))} className="e-btn e-btn-ghost e-btn-sm">Tuần này</button>}
        <select value={role} onChange={e => setRole(e.target.value)} className="e-input max-lg:w-full lg:w-auto lg:min-w-[170px]">
          <option value="all">Tất cả vị trí</option>
          {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 max-lg:w-full lg:flex lg:flex-wrap lg:ml-auto">
          <button onClick={exportCsv} className="e-btn e-btn-secondary"><Download />Xuất Excel</button>
          <button onClick={() => setConfirm('copy')} disabled={missing} className="e-btn e-btn-secondary"><Copy />Chép tuần trước</button>
          <button onClick={() => setConfirm('publish')} disabled={!draftCount || missing} className="e-btn e-btn-primary max-lg:col-span-2"><Megaphone />Công bố lịch{draftCount ? ` (${draftCount})` : ''}</button>
        </div>
      </div>

      {missing && (
        <div className="rounded-2xl border border-warning-100 bg-warning-50 text-warning-700 px-4 py-3 text-[13px] flex gap-2 [overflow-wrap:anywhere]"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span className="min-w-0">Chưa tạo bảng phân ca trên máy chủ. Vui lòng chạy file <b>supabase/work_schedule.sql</b> trong Supabase › SQL Editor.</span></div>
      )}

      {/* Chú giải */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-slate-500 px-1">
        {shifts.map(s => <span key={s.id} className="inline-flex items-center gap-1.5"><i className={`w-3.5 h-3.5 rounded ${`e-shift-${s.tone}`}`} />{s.name}{s.is_off ? '' : ` ${s.start_time}–${s.end_time}`}</span>)}
        <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-warning-500" />Bản nháp chưa công bố</span>
        {warnings.length > 0 && <span className="inline-flex items-center gap-1 text-danger-600 font-medium"><TriangleAlert className="w-3.5 h-3.5" />{warnings.length} cảnh báo phân ca</span>}
      </div>

      {/* Bảng phân ca */}
      <div className="e-card overflow-hidden">
        {loading ? (
          <div className="py-24 grid place-items-center"><div className="w-7 h-7 border-[3px] border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="e-empty"><div className="e-empty-icon"><Users /></div><div className="e-empty-title">Không có nhân sự</div><div className="e-empty-desc">Đổi bộ lọc vị trí để xem nhân sự khác.</div></div>
        ) : (
          <>
          {/* MOBILE: dải 7 ngày + danh sách nhân sự của ngày đang chọn (không kéo ngang) */}
          <div className="lg:hidden">
            <div className="grid grid-cols-7 gap-1 p-2 border-b border-slate-100">
              {dates.map((d, i) => {
                const on = d === day; const n = rows.filter(s => itemOf(s.id, d)).length;
                return (
                  <button key={d} onClick={() => setMDay(d)} className={`flex flex-col items-center justify-center h-[58px] rounded-xl transition ${on ? 'bg-teal-700 text-white shadow-nav' : d === today ? 'bg-teal-50 text-teal-800' : 'text-slate-600'}`}>
                    <span className={`text-[11px] font-medium ${on ? 'text-white/80' : 'text-slate-400'}`}>{DOW[i].replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</span>
                    <span className="text-[15px] font-bold tabular-nums leading-tight">{parseYmd(d).getDate()}</span>
                    <span className={`text-[10px] tabular-nums ${on ? 'text-white/80' : 'text-slate-400'}`}>{n} ca</span>
                  </button>
                );
              })}
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map(s => {
                const it = itemOf(s.id, day); const sh = it && shiftById[it.shift_id];
                const lv = leaveOf(s.id, day); const warns = warnOf(s.id, day);
                const cls = lv ? 'e-shift-leave' : sh ? `e-shift-${sh.tone}` : 'e-shift-empty';
                return (
                  <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 min-h-[68px]">
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <span className="e-avatar w-10 h-10 text-[13px] shrink-0">{initials(s.full_name)}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-slate-900 truncate">{s.full_name}</div>
                      <div className="text-[12px] text-slate-500 truncate">{warns.length ? <span className="text-danger-600">{warns[0].message}</span> : (s.position || [s.role, s.role_2].filter(Boolean).map(r => ROLE_LABELS[r] || r).join(' · '))}</div>
                    </div>
                    <button type="button"
                      className={`e-shift !w-[112px] !mx-0 shrink-0 ${cls} ${it?.status === 'draft' ? 'e-shift-draft' : ''} ${warns.length ? 'e-shift-warn' : ''}`}
                      onClick={(e) => { if (lv || missing) return; setPick({ staff: s, date: day, rect: e.currentTarget.getBoundingClientRect() }); }}
                      disabled={missing && !sh}>
                      {lv ? (lv.half_day_period ? 'Nghỉ ½' : 'Nghỉ phép') : sh ? sh.short : '+ Xếp ca'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="overflow-x-auto hidden lg:block">
            <table className="w-full border-separate border-spacing-0 min-w-[980px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 h-16 text-left pl-5 lg:pl-6 w-[240px] text-[14px] font-semibold text-slate-700 border-b border-slate-200">Nhân viên</th>
                  {dates.map((d, i) => (
                    <th key={d} className={`bg-slate-50 h-16 text-center text-[14px] font-semibold border-b border-slate-200 ${d === today ? 'text-teal-700' : 'text-slate-700'}`}>
                      {DOW[i]}<small className="block text-[12px] font-normal text-slate-500">{dm(parseYmd(d))}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id}>
                    <td className="sticky left-0 z-10 bg-white h-[84px] pl-5 lg:pl-6 pr-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" /> : <span className="e-avatar w-11 h-11 text-[14px]">{initials(s.full_name)}</span>}
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-slate-900 truncate">{s.full_name}</div>
                          <div className="text-[12px] text-slate-500 truncate">{s.position || [s.role, s.role_2].filter(Boolean).map(r => ROLE_LABELS[r] || r).join(' · ')}</div>
                        </div>
                      </div>
                    </td>
                    {dates.map(d => {
                      const it = itemOf(s.id, d); const sh = it && shiftById[it.shift_id];
                      const lv = leaveOf(s.id, d); const warns = warnOf(s.id, d); const key = `${s.id}:${d}`;
                      const cls = lv ? 'e-shift-leave' : sh ? `e-shift-${sh.tone}` : 'e-shift-empty';
                      return (
                        <td key={d} className="h-[84px] px-2 border-b border-slate-100 text-center">
                          <button type="button"
                            className={`e-shift ${cls} ${it?.status === 'draft' ? 'e-shift-draft' : ''} ${warns.length ? 'e-shift-warn' : ''} ${over === key ? 'e-shift-drop' : ''}`}
                            title={lv ? 'Nghỉ phép (đơn đã duyệt)' : warns.length ? warns.map(w => w.message).join(' · ') : sh ? `${sh.name}${sh.is_off ? '' : ` ${sh.start_time}–${sh.end_time}`}${it.status === 'draft' ? ' · nháp' : ''}` : 'Bấm để xếp ca'}
                            draggable={!!sh && !lv && !missing}
                            onDragStart={() => sh && setDrag({ staff_id: s.id, date: d, shift_id: sh.id })}
                            onDragEnd={() => { setDrag(null); setOver(null); }}
                            onDragOver={(e) => { if (drag && !lv) { e.preventDefault(); setOver(key); } }}
                            onDragLeave={() => setOver(o => (o === key ? null : o))}
                            onDrop={(e) => { e.preventDefault(); setOver(null); if (drag && (drag.staff_id !== s.id || drag.date !== d)) setShift(s.id, d, drag.shift_id); setDrag(null); }}
                            onClick={(e) => { if (lv || missing) return; setPick({ staff: s, date: d, rect: e.currentTarget.getBoundingClientRect() }); }}
                            disabled={missing && !sh}
                          >
                            {lv ? (lv.half_day_period ? 'Nghỉ ½' : 'Nghỉ phép') : sh ? sh.short : '+ Xếp ca'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Bảng chọn ca (mobile: tấm trượt từ đáy) */}
      {pick && (() => {
        const cur = itemOf(pick.staff.id, pick.date);
        const top = Math.min(pick.rect.bottom + 6, window.innerHeight - 250);
        const left = Math.min(Math.max(8, pick.rect.left + pick.rect.width / 2 - 140), window.innerWidth - 288);
        return (
          <div ref={pickRef} className="fixed z-[60] w-[280px] e-card p-3 shadow-float max-lg:!inset-x-0 max-lg:!top-auto max-lg:!bottom-0 max-lg:!w-full max-lg:!rounded-b-none max-lg:p-4 max-lg:pb-[calc(16px+env(safe-area-inset-bottom))]" style={{ top, left }}>
            <div className="text-[12.5px] text-slate-500 mb-2 px-0.5"><b className="text-slate-800">{pick.staff.full_name}</b> · {DOW[dates.indexOf(pick.date)]} {dm(parseYmd(pick.date))}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {shifts.map(sh => (
                <button key={sh.id} onClick={() => { setShift(pick.staff.id, pick.date, sh.id); setPick(null); }}
                  className={`h-11 max-lg:h-12 rounded-[10px] text-[13px] font-semibold flex flex-col items-center justify-center leading-tight e-shift-${sh.tone} ${cur?.shift_id === sh.id ? 'ring-2 ring-teal-600' : ''}`}>
                  {sh.name}{!sh.is_off && <small className="text-[10.5px] font-normal opacity-80">{sh.start_time}–{sh.end_time}</small>}
                </button>
              ))}
            </div>
            {cur && <button onClick={() => { clearShift(pick.staff.id, pick.date); setPick(null); }} className="mt-2 w-full e-btn e-btn-ghost e-btn-sm text-danger-600 hover:bg-danger-50"><Trash2 />Bỏ xếp ca</button>}
          </div>
        );
      })()}

      {confirm === 'publish' && <Confirm title="Công bố lịch làm việc" label="Công bố" busy={busy} onClose={() => setConfirm(null)} onOk={publish}
        desc={<>Công bố <b>{draftCount}</b> ca nháp của tuần {weekLabel.replace('Tuần ', '')}. Nhân sự sẽ nhận thông báo trên app{warnings.length ? <>; còn <b className="text-danger-600">{warnings.length} cảnh báo phân ca</b> chưa xử lý</> : ''}.</>} />}
      {confirm === 'copy' && <Confirm title="Chép lịch tuần trước" label="Sao chép" busy={busy} onClose={() => setConfirm(null)} onOk={copyPrev}
        desc="Ghi đè lịch tuần này bằng lịch tuần trước cho các nhân sự đang lọc (lưu dạng nháp, cần công bố lại)." />}
    </div>
  );
}
