// ============================================================
// CHẤM CÔNG THEO NGÀY (Ethics D06 Attendance dashboard)
// - AttendanceDayMetrics: 5 chỉ số trong ngày (Tổng NS · Đang có mặt · Đi muộn · Về sớm · Nghỉ phép)
// - AttendanceDayView: bảng công ngày (ca, giờ vào/ra, xác thực, muộn/sớm, tăng ca)
//   + thẻ Phương thức chấm công + thẻ Cần xử lý (chưa chấm, muộn/sớm, vị trí bất thường)
// Dữ liệu chấm công lấy từ trang cha (đã tải theo tháng); ca làm đọc thêm staff_schedules.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Users, UserCheck, AlarmClock, LogOut, Plane, ScanFace, Wifi, MapPin, Hand, AlertTriangle, ChevronLeft, ChevronRight, Pencil, QrCode, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { DataTable, EmptyState } from '@/components/ds';

const PRESENT = ['present', 'late', 'early_leave', 'half_day'];
const STATUS = {
  present: ['Có mặt', 'e-tone-success'], late: ['Đi muộn', 'e-tone-warning'], early_leave: ['Về sớm', 'e-tone-peach'],
  half_day: ['Nửa ngày', 'e-tone-info'], leave: ['Nghỉ phép', 'e-tone-lavender'], absent: ['Vắng', 'e-tone-danger'],
};
const METHOD = (m) => {
  const s = String(m || '').toLowerCase();
  if (s.includes('face')) return { key: 'face', label: 'Face ID', icon: ScanFace };
  if (s.includes('wifi') || s.includes('ip')) return { key: 'wifi', label: 'Wi‑Fi', icon: Wifi };
  if (s.includes('gps') || s.includes('location')) return { key: 'gps', label: 'GPS', icon: MapPin };
  if (s.includes('qr')) return { key: 'qr', label: 'QR', icon: QrCode };
  return { key: 'manual', label: 'Thủ công', icon: Hand };
};
const t5 = (t) => (t ? String(t).slice(0, 5) : '—');
const dayStr = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const WD = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export function dayRecords(attendance, date) { return attendance.filter(a => a.date === date); }

export function AttendanceDayMetrics({ staff, records, label }) {
  const total = staff.length;
  const present = records.filter(r => PRESENT.includes(r.status)).length;
  const items = [
    { label: 'Tổng nhân sự', value: total, hint: 'đang hoạt động', icon: Users, tone: 'e-tone-brand' },
    { label: 'Đang có mặt', value: present, hint: total ? `${Math.round((present / total) * 100)}% · ${label}` : label, icon: UserCheck, tone: 'e-tone-success' },
    { label: 'Đi muộn', value: records.filter(r => r.status === 'late').length, hint: 'nhân sự', icon: AlarmClock, tone: 'e-tone-warning' },
    { label: 'Về sớm', value: records.filter(r => r.status === 'early_leave').length, hint: 'nhân sự', icon: LogOut, tone: 'e-tone-peach' },
    { label: 'Nghỉ phép', value: records.filter(r => r.status === 'leave' || r.status === 'half_day').length, hint: 'cả ngày / nửa ngày', icon: Plane, tone: 'e-tone-lavender' },
  ];
  return (
    <div className="hidden lg:grid grid-cols-5 gap-4 xl:col-span-2 xl:order-first">
      {items.map(m => (
        <div key={m.label} className="e-metric p-3.5 gap-3">
          <div className={`e-metric-icon w-11 h-11 lg:w-11 lg:h-11 ${m.tone}`}><m.icon className="!w-5 !h-5" /></div>
          <div className="min-w-0">
            <div className="e-metric-label">{m.label}</div>
            <div className="e-metric-value">{m.value}</div>
            <div className="e-metric-hint">{m.hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AttendanceDayView({ staff, attendance, year, month, day, daysInMonth, onDay, onEdit, isOddLocation }) {
  const date = dayStr(year, month, day);
  const records = useMemo(() => dayRecords(attendance, date), [attendance, date]);
  const byStaff = useMemo(() => Object.fromEntries(records.map(r => [r.staff_id, r])), [records]);
  const [shifts, setShifts] = useState({ map: {}, loaded: false });

  // Ca làm trong ngày (Lịch làm việc / Phân ca) — chưa có bảng thì bỏ qua
  useEffect(() => {
    let off = false;
    Promise.all([
      supabase.from('staff_schedules').select('staff_id, shift_id, status').eq('date', date),
      supabase.from('work_shifts').select('id, name, short, start_time, end_time, is_off'),
    ]).then(([sc, ws]) => {
      if (off) return;
      if (sc.error || ws.error) { setShifts({ map: {}, loaded: false }); return; }
      const W = Object.fromEntries((ws.data || []).map(w => [w.id, w]));
      setShifts({ map: Object.fromEntries((sc.data || []).map(x => [x.staff_id, W[x.shift_id]]).filter(([, w]) => w)), loaded: true });
    });
    return () => { off = true; };
  }, [date]);

  const rows = staff.map(s => ({ s, r: byStaff[s.id], shift: shifts.map[s.id] }));
  const hasSchedule = shifts.loaded && Object.keys(shifts.map).length > 0;
  const dObj = new Date(`${date}T00:00:00`);
  const isFuture = date > new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  // Cần xử lý
  const missing = isFuture ? [] : rows.filter(x => !x.r && (hasSchedule ? x.shift && !x.shift.is_off : dObj.getDay() !== 0));
  const lateEarly = rows.filter(x => x.r && (x.r.status === 'late' || x.r.status === 'early_leave' || Number(x.r.late_early_hours) > 0));
  const odd = rows.filter(x => x.r && isOddLocation(x.r));
  const todo = [
    ...missing.map(x => ({ ...x, kind: 'missing', text: x.shift ? `Chưa chấm công · ca ${x.shift.name}` : 'Chưa chấm công' })),
    ...lateEarly.map(x => ({ ...x, kind: 'late', text: `${STATUS[x.r.status]?.[0] || 'Muộn / sớm'}${Number(x.r.late_early_hours) > 0 ? ` ${x.r.late_early_hours}h` : ''} · vào ${t5(x.r.check_in)}` })),
    ...odd.map(x => ({ ...x, kind: 'odd', text: `Vị trí / mạng bất thường${x.r.ip_address ? ` · IP ${x.r.ip_address}` : ''}` })),
  ];

  // Phương thức chấm công
  const methods = {};
  records.filter(r => r.check_in).forEach(r => { const m = METHOD(r.check_in_method); methods[m.key] = methods[m.key] || { ...m, n: 0 }; methods[m.key].n += 1; });
  const checked = records.filter(r => r.check_in).length;

  const columns = [
    { key: 'name', header: 'Nhân viên', sortValue: x => x.s.full_name || '', cell: x => (
      <div className="flex items-center gap-3 min-w-[180px]">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-teal-50 grid place-items-center shrink-0">
          {x.s.avatar_url ? <img src={x.s.avatar_url} alt={x.s.full_name} className="w-full h-full object-cover" /> : <span className="text-[14px] font-bold text-teal-700">{x.s.full_name?.charAt(0)}</span>}
        </div>
        <div className="min-w-0"><div className="font-semibold text-slate-900 text-[14px] truncate">{x.s.full_name}</div><div className="text-[12px] text-slate-500">{x.s.employee_id}</div></div>
      </div>
    ) },
    { key: 'shift', header: 'Ca', sortValue: x => x.shift?.start_time || 'zz', cell: x => (x.shift
      ? <span className="text-[13px] text-slate-700 whitespace-nowrap">{x.shift.name}{x.shift.is_off ? '' : <span className="text-slate-400"> · {x.shift.start_time}–{x.shift.end_time}</span>}</span>
      : <span className="text-slate-300">—</span>) },
    { key: 'in', header: 'Check-in', sortValue: x => x.r?.check_in || 'zz', cell: x => <span className="tabular-nums font-medium text-slate-800">{t5(x.r?.check_in)}</span> },
    { key: 'out', header: 'Check-out', sortValue: x => x.r?.check_out || 'zz', cell: x => <span className="tabular-nums text-slate-700">{t5(x.r?.check_out)}</span> },
    { key: 'auth', header: 'Xác thực', cell: x => {
      if (!x.r?.check_in) return <span className="text-slate-300">—</span>;
      const m = METHOD(x.r.check_in_method);
      return (
        <div className="flex flex-wrap gap-1">
          <span className="e-badge e-badge-sm e-tone-info"><m.icon />{m.label}</span>
          {isOddLocation(x.r)
            ? <span className="e-badge e-badge-sm e-tone-danger"><AlertTriangle />Bất thường</span>
            : x.r.location_status === 'in_office' && <span className="e-badge e-badge-sm e-tone-success"><CheckCircle2 />Văn phòng</span>}
        </div>
      );
    } },
    { key: 'le', header: 'Muộn/sớm', align: 'right', sortValue: x => Number(x.r?.late_early_hours || 0), cell: x => (Number(x.r?.late_early_hours) > 0 ? <span className="text-warning-600 font-semibold">{x.r.late_early_hours}h</span> : <span className="text-slate-300">—</span>) },
    { key: 'ot', header: 'Tăng ca', align: 'right', sortValue: x => Number(x.r?.overtime_hours || 0), cell: x => (Number(x.r?.overtime_hours) > 0 ? <span className="text-teal-700 font-semibold">{x.r.overtime_hours}h</span> : <span className="text-slate-300">—</span>) },
    { key: 'status', header: 'Trạng thái', sortValue: x => x.r?.status || 'zz', cell: x => (x.r
      ? <span className={`e-badge e-badge-sm ${STATUS[x.r.status]?.[1] || 'e-tone-neutral'}`}>{STATUS[x.r.status]?.[0] || x.r.status}</span>
      : <span className="e-badge e-badge-sm e-tone-neutral">Chưa chấm</span>) },
    { key: 'edit', header: <span className="sr-only">Sửa</span>, align: 'right', cell: x => (
      <button onClick={(e) => { e.stopPropagation(); onEdit(x.s.id, day); }} className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-teal-50 hover:text-teal-700" title="Sửa công" aria-label="Sửa công"><Pencil className="w-4 h-4" /></button>
    ) },
  ];

  return (
    <div className="xl:col-span-2 xl:order-3 space-y-4">
      <div className="e-toolbar">
        <button onClick={() => onDay(day - 1)} disabled={day <= 1} className="e-icon-btn w-9 h-9" aria-label="Ngày trước"><ChevronLeft className="w-4 h-4" /></button>
        <span className="min-w-[170px] text-center text-[14px] font-semibold text-slate-800 tabular-nums">{WD[dObj.getDay()]}, {date.split('-').reverse().join('/')}</span>
        <button onClick={() => onDay(day + 1)} disabled={day >= daysInMonth} className="e-icon-btn w-9 h-9" aria-label="Ngày sau"><ChevronRight className="w-4 h-4" /></button>
        <span className="e-page-desc ml-2">{checked}/{staff.length} nhân sự đã chấm công{hasSchedule ? ' · ca lấy từ Lịch làm việc' : ''}</span>
      </div>

      <DataTable
          rows={rows}
          getRowId={x => x.s.id}
          columns={columns}
          minWidth={860}
          pageSize={15}
          initialSort={{ key: 'in', dir: 'asc' }}
          onRowClick={x => onEdit(x.s.id, day)}
          empty={{ title: 'Chưa có nhân sự', icon: Users }}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="e-card e-card-pad">
            <div className="e-card-header"><div><div className="e-card-title">Phương thức chấm công</div><div className="e-card-sub">Theo lượt check-in trong ngày</div></div></div>
            {checked === 0 ? <EmptyState title="Chưa có lượt chấm công" icon={ScanFace} /> : (
              <div className="grid grid-cols-2 gap-2.5">
                {Object.values(methods).sort((a, b) => b.n - a.n).map(m => (
                  <div key={m.key} className="e-subtle px-3.5 py-3 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><m.icon className="w-5 h-5" /></span>
                    <div className="min-w-0">
                      <div className="text-[13px] text-slate-500">{m.label}</div>
                      <div className="text-[17px] font-bold text-slate-900 tabular-nums">{Math.round((m.n / checked) * 100)}% <span className="text-[12px] font-medium text-slate-400">· {m.n}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="e-card e-card-pad">
            <div className="e-card-header">
              <div><div className="e-card-title">Cần xử lý</div><div className="e-card-sub">Chưa chấm công, muộn / sớm, vị trí bất thường</div></div>
              {todo.length > 0 && <span className="e-badge e-badge-sm e-tone-danger">{todo.length}</span>}
            </div>
            {todo.length === 0 ? <EmptyState title="Không có việc cần xử lý" icon={CheckCircle2} /> : (
              <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto -mx-1 px-1">
                {todo.map((x, i) => (
                  <li key={`${x.kind}-${x.s.id}-${i}`} className="flex items-center gap-3 py-2.5">
                    <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${x.kind === 'odd' ? 'bg-danger-50 text-danger-600' : x.kind === 'late' ? 'bg-warning-50 text-warning-600' : 'bg-slate-100 text-slate-500'}`}>
                      {x.kind === 'odd' ? <AlertTriangle className="w-4 h-4" /> : x.kind === 'late' ? <AlarmClock className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-slate-800 truncate">{x.s.full_name}</div>
                      <div className="text-[12px] text-slate-500 truncate">{x.text}</div>
                    </div>
                    <button onClick={() => onEdit(x.s.id, day)} className="e-btn e-btn-secondary e-btn-sm h-8 px-2.5 shrink-0">Sửa công</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
    </div>
  );
}
