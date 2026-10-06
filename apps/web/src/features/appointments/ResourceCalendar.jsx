// ============================================================
// LỊCH HẸN DẠNG LỊCH — theo Ethics Business OS.
// Desktop: cột trái (lịch tháng mini có chấm ngày có hẹn + lọc nhân sự kèm
// số ca + chú thích màu) | lưới trục GIỜ x CỘT tài nguyên (Ngày), 7 ngày
// (Tuần) hoặc lưới tháng (Tháng). Khối hẹn tô màu theo trạng thái.
// Mobile: dải tuần / lịch tháng + danh sách theo giờ của ngày đang chọn.
// Component thuần hiển thị: dữ liệu + thao tác do trang cha truyền vào.
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, User } from 'lucide-react';
import {
  toYMD, parseYMD, addDays, sameYMD, weekDays, monthGrid, WD_SHORT, wdLabel,
  timeToMin, minToTime, durationOf, isRecheck, toneOf, APPT_TONE, STAFF_COLORS,
  layoutLanes, fmtMonthTitle, fmtDayTitle, pad2,
} from './calendarUtils';

const START_H = 7;
const END_H = 21;
const HOUR_PX = 64;
const GRID_H = (END_H - START_H) * HOUR_PX;
const NONE = '__none';

const VIEWS = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
];

const Seg = ({ items, value, onChange, small }) => (
  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1">
    {items.map(it => (
      <button key={it.id} onClick={() => onChange(it.id)}
        className={`${small ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-1.5 text-sm'} rounded-lg font-semibold transition-colors ${
          value === it.id ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-800'
        }`}>
        {it.label}
      </button>
    ))}
  </div>
);

// Khối lịch hẹn trên lưới giờ
const Block = ({ it, onOpen, selected, showResource }) => {
  const { app } = it;
  const tone = toneOf(app);
  const top = ((Math.max(it.start, START_H * 60) - START_H * 60) / 60) * HOUR_PX;
  const height = Math.max(((it.end - it.start) / 60) * HOUR_PX - 4, 30);
  const w = 100 / it.lanes;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(app); }}
      title={`${app.customer_name} · ${minToTime(it.start)} – ${minToTime(it.end)}`}
      className={`absolute rounded-lg text-left overflow-hidden px-2.5 py-1.5 transition-shadow hover:shadow-card ${selected ? 'ring-2 ring-teal-600 ring-offset-1 z-10' : ''}`}
      style={{
        top: top + 2, height,
        left: `calc(${it.lane * w}% + 3px)`, width: `calc(${w}% - 6px)`,
        background: tone.bg, borderLeft: `3px solid ${tone.bar}`, color: tone.text,
      }}
    >
      <div className="font-semibold text-[13px] leading-tight truncate text-slate-900">{app.customer_name || 'Khách'}</div>
      {height >= 44 && <div className="text-[12px] leading-tight mt-0.5 tabular-nums">{minToTime(it.start)} - {minToTime(it.end)}</div>}
      {height >= 60 && (
        <div className="text-[11px] leading-tight mt-1 truncate opacity-80">
          {showResource ? (app.sale || '') : (app.service || '').replace('[Tái khám] ', '') || tone.label}
        </div>
      )}
    </button>
  );
};

// Trục giờ bên trái lưới
const TimeAxis = () => (
  <div className="relative shrink-0 w-16 border-r border-slate-100" style={{ height: GRID_H }}>
    {Array.from({ length: END_H - START_H }, (_, i) => (
      <div key={i} className="absolute left-0 right-0 text-[11.5px] text-slate-400 tabular-nums pl-3" style={{ top: i * HOUR_PX + 4 }}>
        {pad2(START_H + i)}:00
      </div>
    ))}
  </div>
);

// Một cột lưới (tài nguyên hoặc ngày)
const COL_MIN = 140;
const GridColumn = ({ items, onOpen, selectedId, onEmptyClick, isToday, showResource, maxLanes, onMore }) => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    <div
      className={`relative flex-1 basis-0 min-w-0 border-r border-slate-100 last:border-r-0 ${onEmptyClick ? 'cursor-copy' : ''}`}
      style={{ height: GRID_H }}
      onClick={(e) => {
        if (!onEmptyClick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const min = START_H * 60 + Math.floor((y / HOUR_PX) * 2) * 30; // làm tròn 30'
        onEmptyClick(minToTime(Math.min(min, END_H * 60 - 30)));
      }}
    >
      {Array.from({ length: END_H - START_H }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: i * HOUR_PX }} />
      ))}
      {isToday && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
        <div className="absolute left-0 right-0 z-[5] pointer-events-none" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}>
          <div className="h-[2px] bg-rose-400" />
          <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-rose-400" />
        </div>
      )}
      {(() => {
        const laid = layoutLanes(items);
        if (!maxLanes) return laid.map(it => <Block key={it.app.id} it={it} onOpen={onOpen} selected={selectedId === it.app.id} showResource={showResource} />);
        // Cụm quá đông: giữ (maxLanes-1) làn, phần dư gom thành nút "+N"
        const out = [];
        const moreByCluster = {};
        laid.forEach(it => {
          if (it.lanes <= maxLanes) { out.push(<Block key={it.app.id} it={it} onOpen={onOpen} selected={selectedId === it.app.id} showResource={showResource} />); return; }
          if (it.lane < maxLanes) { out.push(<Block key={it.app.id} it={{ ...it, lanes: maxLanes }} onOpen={onOpen} selected={selectedId === it.app.id} showResource={showResource} />); return; }
          const m = moreByCluster[it.cluster] || (moreByCluster[it.cluster] = { n: 0, start: it.cStart, end: it.cEnd });
          m.n += 1;
        });
        Object.entries(moreByCluster).forEach(([k, m]) => {
          // Huy hiệu "+N" ở góc dưới-phải của cụm (không che tên khách)
          const bottom = ((Math.min(m.end, END_H * 60) - START_H * 60) / 60) * HOUR_PX;
          out.push(
            <button key={`more-${k}`} onClick={(e) => { e.stopPropagation(); onMore?.(); }}
              className="absolute right-1.5 z-[6] h-5 min-w-[26px] px-1.5 rounded-full bg-slate-800/85 hover:bg-slate-900 text-white text-[10.5px] font-bold grid place-items-center shadow-soft"
              style={{ top: bottom - 24 }}
              title="Còn lịch khác — xem đủ ở chế độ Ngày">+{m.n}</button>
          );
        });
        return out;
      })()}
    </div>
  );
};

// Lịch tháng mini (cột trái desktop / chọn ngày mobile)
const MiniMonth = ({ cursor, setCursor, counts, compact }) => {
  const [m, setM] = useState(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  useEffect(() => { setM(new Date(cursor.getFullYear(), cursor.getMonth(), 1)); }, [cursor]);
  const today = new Date();
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-slate-900 text-[16px]">{fmtMonthTitle(m)}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Tháng trước"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Tháng sau"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WD_SHORT.map(w => <div key={w} className="text-[11.5px] font-semibold text-slate-400 pb-2">{w}</div>)}
        {monthGrid(m).map(d => {
          const ymd = toYMD(d);
          const inMonth = d.getMonth() === m.getMonth();
          const sel = sameYMD(d, cursor);
          const isToday = sameYMD(d, today);
          const c = counts[ymd] || 0;
          return (
            <button key={ymd} onClick={() => setCursor(d)} className={`relative ${compact ? 'h-10' : 'h-9'} grid place-items-center`}>
              <span className={`w-8 h-8 grid place-items-center rounded-full text-[13.5px] tabular-nums transition-colors ${
                sel ? 'bg-teal-600 text-white font-bold shadow-sm'
                  : isToday ? 'ring-1 ring-teal-500 text-teal-700 font-bold'
                  : inMonth ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300'
              }`}>{d.getDate()}</span>
              {c > 0 && !sel && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-teal-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function ResourceCalendar({
  appointments = [],
  staffList = [],
  onOpen,
  onCreateAt,       // (ymd, 'HH:MM') => void — bấm ô trống để tạo lịch (tuỳ quyền)
  selectedId,
  toolbarRight,     // nút "Thêm lịch hẹn"... do trang cha truyền
  initialView = 'day',
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState(initialView);
  const [groupBy, setGroupBy] = useState('sale'); // 'sale' | 'type'
  const [hidden, setHidden] = useState(() => new Set());
  const scrollRef = useRef(null);

  // Lịch có ngày hợp lệ
  const apps = useMemo(() => appointments.filter(a => a.appointment_date), [appointments]);

  // Phạm vi đang xem
  const range = useMemo(() => {
    if (view === 'day') return [cursor, cursor];
    if (view === 'week') { const w = weekDays(cursor); return [w[0], w[6]]; }
    const g = monthGrid(cursor); return [g[0], g[41]];
  }, [cursor, view]);
  const inRange = (a) => a.appointment_date >= toYMD(range[0]) && a.appointment_date <= toYMD(range[1]);

  // Tài nguyên (cột) — theo Sale tư vấn hoặc theo Loại lịch
  const resKey = (a) => (groupBy === 'type' ? (isRecheck(a) ? 'recheck' : 'consult') : (a.sale_id || NONE));
  const resources = useMemo(() => {
    if (groupBy === 'type') {
      return [
        { id: 'consult', label: 'Tư vấn / Phẫu thuật', color: APPT_TONE.phau_thuat.bar },
        { id: 'recheck', label: 'Tái khám', color: APPT_TONE.recheck.bar },
      ];
    }
    const nameOf = Object.fromEntries(staffList.map(s => [s.id, s.full_name]));
    const sales = staffList.filter(s => s.role === 'sale_offline' || s.role_2 === 'sale_offline').map(s => s.id);
    const ids = new Set(sales);
    apps.filter(inRange).forEach(a => ids.add(a.sale_id || NONE));
    const list = [...ids].map(id => ({ id, label: id === NONE ? 'Chưa phân công' : (nameOf[id] || 'Nhân sự') }));
    list.sort((a, b) => (a.id === NONE) - (b.id === NONE) || a.label.localeCompare(b.label, 'vi'));
    return list.map((r, i) => ({ ...r, color: r.id === NONE ? '#97A4A5' : STAFF_COLORS[i % STAFF_COLORS.length] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, staffList, apps, range]);

  const visible = (a) => !hidden.has(resKey(a));
  const rangeApps = apps.filter(a => inRange(a) && visible(a));
  const countByRes = useMemo(() => {
    const c = {};
    apps.filter(inRange).forEach(a => { const k = resKey(a); c[k] = (c[k] || 0) + 1; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, range, groupBy]);
  const countByDay = useMemo(() => {
    const c = {};
    apps.filter(visible).forEach(a => { c[a.appointment_date] = (c[a.appointment_date] || 0) + 1; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, hidden, groupBy]);

  const dayApps = (d) => apps.filter(a => a.appointment_date === toYMD(d) && visible(a));
  const timed = (list) => list.filter(a => timeToMin(a.appointment_time) != null);
  const untimed = (list) => list.filter(a => timeToMin(a.appointment_time) == null);

  // Điều hướng
  const step = (dir) => {
    if (view === 'day') setCursor(d => addDays(d, dir));
    else if (view === 'week') setCursor(d => addDays(d, dir * 7));
    else setCursor(d => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };
  const rangeLabel = view === 'day' ? fmtDayTitle(cursor)
    : view === 'week' ? (() => { const w = weekDays(cursor); return `${pad2(w[0].getDate())}/${pad2(w[0].getMonth() + 1)} – ${pad2(w[6].getDate())}/${pad2(w[6].getMonth() + 1)}/${w[6].getFullYear()}`; })()
    : fmtMonthTitle(cursor);

  // Tự cuộn lưới: hôm nay -> quanh giờ hiện tại; ngày khác -> lịch sớm nhất (mặc định 08:00)
  const cursorKey = toYMD(cursor);
  useEffect(() => {
    if (!scrollRef.current || view === 'month') return;
    const days = view === 'week' ? weekDays(cursor) : [cursor];
    const mins = apps.filter(a => days.some(d => toYMD(d) === a.appointment_date) && visible(a))
      .map(a => timeToMin(a.appointment_time)).filter(m => m != null);
    const first = mins.length ? Math.floor(Math.min(...mins) / 60) : 8;
    const isTodayInView = days.some(d => sameYMD(d, new Date()));
    const target = isTodayInView ? Math.min(first, new Date().getHours() - 1) : first;
    const h = Math.max(START_H, Math.min(target, END_H - 4));
    scrollRef.current.scrollTop = (h - START_H) * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursorKey]);

  const toggleRes = (id) => setHidden(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const createAt = onCreateAt ? (d) => (time) => onCreateAt(toYMD(d), time) : null;

  const today = new Date();
  const dayCols = resources.filter(r => !hidden.has(r.id));
  const selDayApps = dayApps(cursor).sort((a, b) => (timeToMin(a.appointment_time) ?? 9999) - (timeToMin(b.appointment_time) ?? 9999));

  // ---------------- Toolbar ----------------
  const shortLabel = view === 'day' ? `${wdLabel(cursor)}, ${pad2(cursor.getDate())}/${pad2(cursor.getMonth() + 1)}`
    : view === 'week' ? (() => { const w = weekDays(cursor); return `${pad2(w[0].getDate())}/${pad2(w[0].getMonth() + 1)} – ${pad2(w[6].getDate())}/${pad2(w[6].getMonth() + 1)}`; })()
    : fmtMonthTitle(cursor);
  const toolbar = (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-soft px-3 lg:px-4 py-3 flex flex-wrap items-center gap-2 lg:gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1 lg:flex-none">
        <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 grid place-items-center shrink-0"><CalendarDays className="w-[18px] h-[18px]" /></span>
        <label className="relative">
          <span className="block font-bold text-slate-900 text-[15px] lg:text-[16px] cursor-pointer hover:text-teal-700 truncate"><span className="hidden lg:inline">{rangeLabel}</span><span className="lg:hidden">{shortLabel}</span></span>
          {/* Chọn ngày nhanh (bấm vào tiêu đề) */}
          <input type="date" value={toYMD(cursor)} onChange={e => e.target.value && setCursor(parseYMD(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Chọn ngày" />
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => step(-1)} className="w-9 h-9 grid place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Trước"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={() => setCursor(new Date())} className="px-3.5 h-9 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Hôm nay</button>
        <button onClick={() => step(1)} className="w-9 h-9 grid place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Sau"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="w-full lg:w-auto [&>div]:w-full lg:[&>div]:w-auto [&_button]:flex-1 lg:[&_button]:flex-none"><Seg items={VIEWS} value={view} onChange={setView} small /></div>
      <div className="hidden lg:block">
        <Seg items={[{ id: 'sale', label: 'Theo Sale' }, { id: 'type', label: 'Theo loại lịch' }]} value={groupBy} onChange={(v) => { setGroupBy(v); setHidden(new Set()); }} small />
      </div>
      {toolbarRight && <div className="hidden lg:flex ml-auto items-center gap-2">{toolbarRight}</div>}
    </div>
  );

  // ---------------- Lưới NGÀY (cột = tài nguyên) ----------------
  const dayGrid = (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-soft overflow-hidden">
      <div ref={scrollRef} className="overflow-auto max-h-[calc(100dvh-250px)] min-h-[420px]">
        <div className="w-full" style={{ minWidth: 64 + Math.max(dayCols.length, 1) * COL_MIN }}>
          {/* Tiêu đề cột */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
            <div className="w-16 shrink-0 border-r border-slate-100" />
            {dayCols.length === 0 && <div className="flex-1 py-4 text-center text-sm text-slate-400">Đã ẩn hết cột — bật lại ở bộ lọc bên trái</div>}
            {dayCols.map(r => {
              const n = dayApps(cursor).filter(a => resKey(a) === r.id).length;
              return (
                <div key={r.id} className="flex-1 basis-0 min-w-0 border-r border-slate-100 last:border-r-0 px-2 py-3.5 text-center">
                  <div className="font-bold text-slate-800 text-[14px] truncate">{r.label}</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">{n} lịch</div>
                </div>
              );
            })}
          </div>
          {/* Lịch chưa có giờ */}
          {untimed(dayApps(cursor)).length > 0 && (
            <div className="flex border-b border-slate-100 bg-slate-50/60">
              <div className="w-16 shrink-0 border-r border-slate-100 text-[10.5px] text-slate-400 px-2 py-2 leading-tight">Chưa có giờ</div>
              {dayCols.map(r => (
                <div key={r.id} className="flex-1 basis-0 min-w-0 border-r border-slate-100 last:border-r-0 p-1.5 space-y-1">
                  {untimed(dayApps(cursor)).filter(a => resKey(a) === r.id).map(a => {
                    const t = toneOf(a);
                    return (
                      <button key={a.id} onClick={() => onOpen(a)} className="w-full text-left rounded-md px-2 py-1 text-[12px] font-semibold truncate"
                        style={{ background: t.bg, borderLeft: `3px solid ${t.bar}`, color: t.text }}>{a.customer_name}</button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="flex">
            <TimeAxis />
            {dayCols.map(r => (
              <GridColumn key={r.id}
                items={timed(dayApps(cursor)).filter(a => resKey(a) === r.id)}
                onOpen={onOpen} selectedId={selectedId} isToday={sameYMD(cursor, today)}
                onEmptyClick={createAt ? createAt(cursor) : null} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ---------------- Lưới TUẦN (cột = ngày) ----------------
  const week = weekDays(cursor);
  const weekGrid = (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-soft overflow-hidden">
      <div ref={scrollRef} className="overflow-auto max-h-[calc(100dvh-250px)] min-h-[420px]">
        <div className="w-full" style={{ minWidth: 64 + 7 * 100 }}>
          <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
            <div className="w-16 shrink-0 border-r border-slate-100" />
            {week.map(d => {
              const isT = sameYMD(d, today);
              return (
                <button key={toYMD(d)} onClick={() => { setCursor(d); setView('day'); }}
                  className="flex-1 basis-0 min-w-0 border-r border-slate-100 last:border-r-0 py-3 text-center hover:bg-slate-50">
                  <div className={`text-[12px] font-semibold ${isT ? 'text-teal-700' : 'text-slate-400'}`}>{wdLabel(d)}</div>
                  <div className={`mx-auto mt-0.5 w-8 h-8 grid place-items-center rounded-full font-bold text-[15px] tabular-nums ${isT ? 'bg-teal-600 text-white' : 'text-slate-800'}`}>{d.getDate()}</div>
                </button>
              );
            })}
          </div>
          <div className="flex">
            <TimeAxis />
            {week.map(d => (
              <GridColumn key={toYMD(d)} items={timed(dayApps(d))} onOpen={onOpen} selectedId={selectedId}
                isToday={sameYMD(d, today)} onEmptyClick={createAt ? createAt(d) : null} showResource
                maxLanes={1} onMore={() => { setCursor(d); setView('day'); }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ---------------- Lưới THÁNG ----------------
  const monthCells = monthGrid(cursor);
  const monthView = (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-soft overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WD_SHORT.map(w => <div key={w} className="py-2.5 text-center text-[12px] font-semibold text-slate-400">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {monthCells.map(d => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const list = dayApps(d).sort((a, b) => (timeToMin(a.appointment_time) ?? 9999) - (timeToMin(b.appointment_time) ?? 9999));
          const isT = sameYMD(d, today);
          return (
            <button key={toYMD(d)} onClick={() => { setCursor(d); setView('day'); }}
              className={`min-h-[112px] flex flex-col justify-start items-stretch border-r border-b border-slate-100 p-1.5 text-left hover:bg-slate-50/70 transition-colors ${inMonth ? '' : 'bg-slate-50/60'}`}>
              <div className={`w-7 h-7 grid place-items-center rounded-full text-[13px] font-semibold tabular-nums ${isT ? 'bg-teal-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300'}`}>{d.getDate()}</div>
              <div className="mt-1 space-y-0.5">
                {list.slice(0, 3).map(a => {
                  const t = toneOf(a);
                  return (
                    <div key={a.id} className="rounded px-1.5 py-0.5 text-[11px] truncate font-medium" style={{ background: t.bg, color: t.text, borderLeft: `2px solid ${t.bar}` }}>
                      <span className="tabular-nums opacity-80">{(a.appointment_time || '').slice(0, 5)}</span> {a.customer_name}
                    </div>
                  );
                })}
                {list.length > 3 && <div className="text-[11px] font-semibold text-teal-700 px-1">+{list.length - 3} lịch khác</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ---------------- Danh sách theo giờ (mobile) ----------------
  const agenda = (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="font-bold text-slate-900 text-[15px]">{fmtDayTitle(cursor)}</div>
        <div className="text-[12.5px] text-slate-500">{selDayApps.length} lịch</div>
      </div>
      {selDayApps.length === 0 && (
        <div className="rounded-2xl bg-white border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">Không có lịch hẹn trong ngày</div>
      )}
      {selDayApps.map(a => {
        const t = toneOf(a);
        const start = timeToMin(a.appointment_time);
        return (
          <button key={a.id} onClick={() => onOpen(a)} className="w-full flex gap-3 text-left">
            <div className="w-12 shrink-0 pt-3 text-right">
              <div className="text-[13px] font-bold text-slate-800 tabular-nums">{start != null ? minToTime(start) : '--:--'}</div>
              {start != null && <div className="text-[11px] text-slate-400 tabular-nums">{minToTime(start + durationOf(a))}</div>}
            </div>
            <div className={`flex-1 min-w-0 rounded-2xl px-3.5 py-3 shadow-soft ${selectedId === a.id ? 'ring-2 ring-teal-600' : ''}`}
              style={{ background: t.bg, borderLeft: `4px solid ${t.bar}` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-slate-900 truncate">{a.customer_name || 'Khách'}</div>
                <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70" style={{ color: t.text }}>{t.label}</span>
              </div>
              <div className="text-[12.5px] mt-0.5 truncate" style={{ color: t.text }}>{(a.service || '').replace('[Tái khám] ', '') || 'Chưa chọn dịch vụ'}</div>
              {a.sale && a.sale !== 'Không có' && (
                <div className="flex items-center gap-1 text-[12px] text-slate-500 mt-1"><User className="w-3.5 h-3.5" />{a.sale}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  // Dải tuần (mobile)
  const weekStrip = (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-soft p-2 grid grid-cols-7 gap-1">
      {week.map(d => {
        const sel = sameYMD(d, cursor);
        const isT = sameYMD(d, today);
        const c = countByDay[toYMD(d)] || 0;
        return (
          <button key={toYMD(d)} onClick={() => setCursor(d)} className={`rounded-xl py-2 flex flex-col items-center gap-1 transition-colors ${sel ? 'bg-teal-600 text-white shadow-sm' : 'hover:bg-slate-50'}`}>
            <span className={`text-[11px] font-semibold ${sel ? 'text-white/80' : isT ? 'text-teal-700' : 'text-slate-400'}`}>{wdLabel(d)}</span>
            <span className={`text-[16px] font-bold tabular-nums ${sel ? 'text-white' : isT ? 'text-teal-700' : 'text-slate-800'}`}>{d.getDate()}</span>
            <span className={`w-1 h-1 rounded-full ${c > 0 ? (sel ? 'bg-white' : 'bg-teal-500') : 'bg-transparent'}`} />
          </button>
        );
      })}
    </div>
  );

  // Chú thích màu
  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {['scheduled', 'coc', 'phau_thuat', 'bong', 'recheck'].map(k => (
        <div key={k} className="flex items-center gap-1.5 text-[12px] text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: APPT_TONE[k].bar }} />{APPT_TONE[k].label}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {toolbar}

      {/* ===== DESKTOP ===== */}
      <div className="hidden lg:grid grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-soft p-5 space-y-5 sticky top-24">
          <MiniMonth cursor={cursor} setCursor={setCursor} counts={countByDay} />
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-bold text-slate-700">{groupBy === 'type' ? 'Loại lịch' : 'Sale tư vấn'}</div>
              {hidden.size > 0 && <button onClick={() => setHidden(new Set())} className="text-[12px] font-semibold text-teal-700 hover:underline">Hiện tất cả</button>}
            </div>
            <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-1">
              {resources.map(r => {
                const on = !hidden.has(r.id);
                return (
                  <button key={r.id} onClick={() => toggleRes(r.id)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 text-left">
                    <span className="w-[18px] h-[18px] rounded-[5px] border-2 grid place-items-center shrink-0" style={{ borderColor: r.color, background: on ? r.color : 'transparent' }}>
                      {on && <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className={`flex-1 text-[13.5px] truncate ${on ? 'text-slate-700' : 'text-slate-400'}`}>{r.label}</span>
                    <span className="text-[12px] text-slate-400 tabular-nums">{countByRes[r.id] || 0}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">{legend}</div>
        </div>
        <div className="min-w-0">
          {view === 'day' && dayGrid}
          {view === 'week' && weekGrid}
          {view === 'month' && monthView}
          <div className="mt-2 text-[12px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {rangeApps.length} lịch trong khoảng đang xem{onCreateAt && view !== 'month' ? ' · bấm vào ô trống để thêm lịch đúng khung giờ' : ''}
          </div>
        </div>
      </div>

      {/* ===== MOBILE ===== */}
      <div className="lg:hidden space-y-3">
        {view === 'month'
          ? <div className="rounded-2xl bg-white border border-slate-200 shadow-soft p-4"><MiniMonth cursor={cursor} setCursor={setCursor} counts={countByDay} compact /></div>
          : weekStrip}
        <div className="px-1">{legend}</div>
        {agenda}
      </div>
    </div>
  );
}
