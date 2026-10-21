// ============================================================
// MARKETING WORKSPACE — VIEW BỔ SUNG CỦA BOARD: Gantt (kéo / co giãn ngày), Dashboard, Gallery, Map
// Cùng 1 nguồn thẻ với Kanban / Bảng / Lịch -> sửa ở đâu cũng đồng bộ (khoá phiên bản).
// ============================================================
import React, { useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChevronLeft, ChevronRight, MapPin, Images, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/ds';
import { vnToday } from '@/lib/vnTime';
import { PRIORITY, fmtDate, fmtDateTime, isLate, vnDateOf, bySort } from './mwMeta';
import { AvatarStack, Tone } from './mwUi';

const DAY = 86400000;
const ymdAdd = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- GANTT: kéo thanh = dời cả bắt đầu + hạn; kéo mép phải = đổi hạn ----------
export function GanttView({ lists, tasks, ctx, onPatch }) {
  const [from, setFrom] = useState(() => { const t = vnToday(); const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7; return ymdAdd(t, -dow - 7); });
  const DAYS = 42;
  const start = new Date(`${from}T00:00:00+07:00`).getTime();
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(null);   // { task, mode: 'move'|'end', x0, dx }
  const dayPx = () => (trackRef.current?.getBoundingClientRect().width || 800) / DAYS;
  const dated = tasks.filter(t => t.due_at);
  const undated = tasks.filter(t => !t.due_at);
  const today = vnToday();
  const pct = (ms) => ((ms - start) / (DAYS * DAY)) * 100;
  const onDown = (e, t, mode) => {
    if (!ctx.perm.edit) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ task: t, mode, x0: e.clientX, dx: 0 });
  };
  const onMove = (e) => { if (drag) setDrag(d => ({ ...d, dx: e.clientX - d.x0 })); };
  const onUp = () => {
    if (!drag) return;
    const days = Math.round(drag.dx / dayPx());
    const t = drag.task;
    setDrag(null);
    if (!days) { if (Math.abs(drag.dx) < 4) ctx.openTask(t.id); return; }
    const due = new Date(new Date(t.due_at).getTime() + days * DAY).toISOString();
    if (drag.mode === 'end') {
      if (t.start_at && new Date(due) <= new Date(t.start_at)) return;
      onPatch(t, { due_at: due });
    } else onPatch(t, { due_at: due, ...(t.start_at ? { start_at: new Date(new Date(t.start_at).getTime() + days * DAY).toISOString() } : {}) });
  };
  return (
    <div className="e-card overflow-hidden" onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button type="button" className="e-icon-btn w-9 h-9" aria-label="Lùi 1 tuần" onClick={() => setFrom(f => ymdAdd(f, -7))}><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-[14px] font-semibold text-slate-700">{fmtDate(`${from}T05:00:00Z`)} – {fmtDate(`${ymdAdd(from, DAYS - 1)}T05:00:00Z`)}</div>
        <button type="button" className="e-icon-btn w-9 h-9" aria-label="Tới 1 tuần" onClick={() => setFrom(f => ymdAdd(f, 7))}><ChevronRight className="w-4 h-4" /></button>
        <span className="ml-auto text-[12px] text-slate-400">{ctx.perm.edit ? 'Kéo thanh để dời ngày · kéo mép phải để đổi hạn' : 'Chỉ xem'}{undated.length ? ` · ${undated.length} thẻ chưa có hạn` : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[220px_1fr] border-b border-slate-100 text-[10.5px] text-slate-400">
            <div className="px-3 py-1.5">Cột / thẻ</div>
            <div ref={trackRef} className="relative h-7">
              {Array.from({ length: DAYS }, (_, i) => {
                const d = ymdAdd(from, i);
                const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
                return <div key={d} className={`absolute top-0 bottom-0 border-l ${dow === 0 ? 'border-slate-200' : 'border-slate-50'} ${d === today ? 'bg-amber-50' : ''}`} style={{ left: `${(i / DAYS) * 100}%`, width: `${100 / DAYS}%` }}>{dow === 0 && <span className="pl-0.5">{fmtDate(`${d}T05:00:00Z`)}</span>}</div>;
              })}
            </div>
          </div>
          {lists.map(l => {
            const items = dated.filter(t => t.list_id === l.id).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
            if (!items.length) return null;
            return (
              <div key={l.id}>
                <div className="px-3 py-1.5 text-[12px] font-bold text-slate-600 bg-slate-50/80 border-b border-slate-100">{l.name} · {items.length}</div>
                {items.map(t => {
                  const live = drag?.task.id === t.id ? Math.round(drag.dx / dayPx()) * DAY : 0;
                  const end = new Date(t.due_at).getTime() + live;
                  const s = (t.start_at ? new Date(t.start_at).getTime() : new Date(t.due_at).getTime() - DAY) + (drag?.task.id === t.id && drag.mode === 'move' ? live : 0);
                  const left = Math.max(0, pct(s)); const right = Math.min(100, pct(end));
                  const visible = right > 0 && left < 100;
                  const late = isLate(t, ctx.doneIds);
                  return (
                    <div key={t.id} className="grid grid-cols-[220px_1fr] border-b border-slate-50 items-center">
                      <button type="button" onClick={() => ctx.openTask(t.id)} className="px-3 py-2 text-left text-[12.5px] text-slate-700 truncate hover:text-teal-700">{t.title}</button>
                      <div className="relative h-9">
                        {visible && (
                          <div role="button" tabIndex={0} aria-label={`${t.title}: hạn ${fmtDateTime(t.due_at)}`} onPointerDown={(e) => onDown(e, t, 'move')} onKeyDown={(e) => { if (e.key === 'Enter') ctx.openTask(t.id); }}
                            className={`absolute top-2 h-5 rounded-md text-[10.5px] text-white pl-1.5 pr-3 truncate select-none ${ctx.perm.edit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${t.completed_at ? 'bg-success-500' : late ? 'bg-danger-500' : 'bg-teal-600'} ${drag?.task.id === t.id ? 'ring-2 ring-amber-400' : ''}`}
                            style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%`, touchAction: 'none' }}>
                            {right - left >= 8 && t.title}
                            {ctx.perm.edit && <span onPointerDown={(e) => onDown(e, t, 'end')} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-black/20 rounded-r-md" aria-hidden="true" />}
                          </div>
                        )}
                        {visible && right - left < 8 && right < 80 && <span className="absolute top-2 text-[11px] text-slate-500 truncate max-w-[30%] pointer-events-none pl-1.5" style={{ left: `${right}%` }} aria-hidden="true">{t.title}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!dated.length && <EmptyState title="Chưa có thẻ nào có hạn" description="Đặt hạn cho thẻ để thấy trên Gantt." />}
        </div>
      </div>
    </div>
  );
}

// ---------- DASHBOARD CỦA BOARD (số liệu thật) ----------
export function BoardDashboard({ lists, tasks, ctx }) {
  const d = useMemo(() => {
    const now = Date.now();
    const week = now + 7 * DAY;
    const open = tasks.filter(t => !t.completed_at && !ctx.doneIds.has(t.list_id));
    const perList = lists.map(l => ({ name: l.name, n: tasks.filter(t => t.list_id === l.id).length }));
    const per = new Map();
    tasks.forEach(t => (ctx.asgBy.get(t.id) || ['_none']).forEach(id => { const o = per.get(id) || { open: 0, late: 0 }; if (open.includes(t)) o.open += 1; if (isLate(t, ctx.doneIds)) o.late += 1; per.set(id, o); }));
    const prio = Object.keys(PRIORITY).map(k => ({ k, n: open.filter(t => t.priority === k).length }));
    let ck = 0; let ckDone = 0;
    tasks.forEach(t => { const c = ctx.chkBy.get(t.id); if (c) { ckDone += c[0]; ck += c[1]; } });
    return {
      open: open.length, done: tasks.length - open.length, late: open.filter(t => isLate(t, ctx.doneIds)).length,
      dueWeek: open.filter(t => t.due_at && new Date(t.due_at).getTime() >= now && new Date(t.due_at).getTime() <= week).length,
      perList, per: [...per.entries()].sort((a, b) => b[1].open - a[1].open), prio, ck, ckDone,
    };
  }, [lists, tasks, ctx]);
  const Kpi = ({ label, value, tone = '' }) => <div className="e-metric"><span><span className="e-metric-label block">{label}</span><span className={`e-metric-value block ${tone}`}>{value}</span></span></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Đang mở" value={d.open} /><Kpi label="Hoàn thành" value={d.done} /><Kpi label="Trễ hạn" value={d.late} tone={d.late ? 'text-danger-600' : ''} />
        <Kpi label="Hạn 7 ngày tới" value={d.dueWeek} /><Kpi label="Checklist xong" value={d.ck ? `${Math.round((d.ckDone / d.ck) * 100)}%` : '—'} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Thẻ theo cột</div>
          <div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.perList} layout="vertical" margin={{ left: 20, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} /><Tooltip formatter={(v) => [v, 'Thẻ']} /><Bar dataKey="n" fill="#087F83" radius={[0, 4, 4, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Theo người</div>
          <ul className="space-y-1.5 text-[13px]">
            {d.per.map(([id, o]) => <li key={id} className="flex justify-between"><span>{id === '_none' ? 'Chưa giao' : ctx.staffById.get(id)?.full_name || 'Không rõ'}</span><span className="tabular-nums">{o.open} đang mở{o.late ? <b className="text-danger-600"> · {o.late} trễ</b> : ''}</span></li>)}
          </ul>
          <div className="e-card-title mt-4 mb-2">Ưu tiên (thẻ đang mở)</div>
          <div className="flex flex-wrap gap-2">{d.prio.map(p => <span key={p.k} className="inline-flex items-center gap-1"><Tone meta={PRIORITY[p.k]} /><b className="text-[13px]">{p.n}</b></span>)}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- GALLERY ----------
export function GalleryView({ lists, tasks, ctx }) {
  const listName = new Map(lists.map(l => [l.id, l.name]));
  if (!tasks.length) return <div className="e-card"><EmptyState icon={Images} title="Không có thẻ" /></div>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {[...tasks].sort(bySort).map(t => {
        const cover = (ctx.attBy.get(t.id) || []).find(a => /^image\//.test(a.mime || ''));
        const people = (ctx.asgBy.get(t.id) || []).map(id => ctx.staffById.get(id) || { id });
        return (
          <button key={t.id} type="button" onClick={() => ctx.openTask(t.id)} className="e-card overflow-hidden text-left hover:shadow-card transition">
            <div className="aspect-[4/3] bg-slate-100 grid place-items-center" style={!cover && t.cover_color ? { background: t.cover_color } : undefined}>
              {cover ? <img src={cover.url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Images className="w-6 h-6 text-white/70" />}
            </div>
            <div className="p-2.5 space-y-1">
              <div className="text-[13px] font-semibold text-slate-800 line-clamp-2">{t.title}</div>
              <div className="flex items-center gap-2 text-[11.5px] text-slate-400"><span className="truncate flex-1">{listName.get(t.list_id)}{t.due_at ? ` · ${fmtDate(t.due_at)}` : ''}</span>{people.length > 0 && <AvatarStack people={people} size={20} />}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------- MAP: thẻ có địa điểm (VD địa điểm quay) ----------
export function MapView({ tasks, ctx }) {
  const withLoc = tasks.filter(t => (t.location || '').trim());
  const groups = useMemo(() => {
    const m = new Map();
    withLoc.forEach(t => { const k = t.location.trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(t); });
    return [...m.entries()];
  }, [withLoc]);
  const [sel, setSel] = useState(null);
  const current = sel && groups.some(([k]) => k === sel) ? sel : groups[0]?.[0];
  if (!('location' in (tasks[0] || {})) && tasks.length) return <div className="e-card"><EmptyState icon={MapPin} title="Chưa cài trường địa điểm" description="Admin chạy supabase/marketing_workspace_v3_collab.sql để bật view Map." /></div>;
  if (!groups.length) return <div className="e-card"><EmptyState icon={MapPin} title="Chưa có thẻ nào có địa điểm" description="Mở thẻ → nhập “Địa điểm” (VD nơi quay, sự kiện) để thấy trên bản đồ." /></div>;
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="e-card p-2 space-y-1 max-h-[520px] overflow-y-auto">
        {groups.map(([loc, items]) => (
          <div key={loc} className={`rounded-xl p-2 ${loc === current ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
            <button type="button" className="w-full text-left flex items-start gap-1.5 text-[13px] font-semibold text-slate-800" onClick={() => setSel(loc)}><MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />{loc} <span className="text-slate-400 font-normal">· {items.length}</span></button>
            <ul className="pl-5 mt-1 space-y-0.5">{items.map(t => <li key={t.id}><button type="button" className="text-[12.5px] text-slate-600 hover:text-teal-700 text-left" onClick={() => ctx.openTask(t.id)}>{t.title}{t.due_at ? ` · ${fmtDate(t.due_at)}` : ''}</button></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="e-card overflow-hidden">
        <iframe key={current} title={`Bản đồ ${current}`} className="w-full h-[520px] border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(current)}&z=15&output=embed`} />
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current)}`} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 px-3 py-2 text-[12.5px] text-teal-700"><ExternalLink className="w-3.5 h-3.5" /> Mở Google Maps (chỉ đường)</a>
      </div>
    </div>
  );
}
