// ============================================================
// MARKETING WORKSPACE — TỔNG QUAN (S01) + VIỆC CỦA TÔI (Inbox/Planner)
// Mọi con số tính từ dữ liệu THẬT trong database (thẻ, cột hoàn thành, duyệt, bài đăng),
// có ghi nguồn + thời điểm tải. Không có số minh hoạ.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ListChecks, AlarmClock, ShieldCheck, Send, CheckCircle2, AlertTriangle, RotateCw, Inbox, CalendarClock } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ds';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { vnToday } from '@/lib/vnTime';
import { mwApi } from './mwApi';
import { fmtDateTime, fmtDate, isLate, vnDateOf, PRIORITY, CAMPAIGN_STATUS, PLATFORMS } from './mwMeta';
import { Avatar, Skeleton, Tone } from './mwUi';

function Metric({ icon: Icon, label, value, hint, tone = 'e-tone-brand', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`e-metric ${onClick ? 'hover:border-teal-300 transition' : ''}`}>
      <span className={`e-metric-icon ${tone}`}><Icon /></span>
      <span className="min-w-0">
        <span className="e-metric-label block">{label}</span>
        <span className="e-metric-value block">{value}</span>
        {hint && <span className="e-metric-hint block">{hint}</span>}
      </span>
    </Tag>
  );
}

export function Overview({ ws, boards, staffById, onGo, openTask }) {
  const [st, setSt] = useState({ loading: true });
  const load = useCallback(async () => {
    try {
      const bIds = boards.filter(b => !b.archived_at).map(b => b.id);
      const [lists, tasks, campaigns, contents, pubs, runs] = await Promise.all([
        bIds.length ? mwApi.lists(bIds) : [], bIds.length ? mwApi.tasks(bIds) : [], mwApi.campaigns([ws.id]),
        mwApi.contents(), mwApi.publications(), mwApi.allRuns(),
      ]);
      const wsContents = contents.filter(c => c.workspace_id === ws.id);
      const cIds = new Set(wsContents.map(c => c.id));
      const assignees = await mwApi.assignees(tasks.map(t => t.id));
      setSt({ loading: false, error: null, lists, tasks, assignees, campaigns, contents: wsContents,
        pubs: pubs.filter(p => cIds.has(p.content_id)), runs: runs.filter(r => cIds.has(r.content_id)), at: new Date().toISOString() });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [ws.id, boards]);
  useEffect(() => { setSt({ loading: true }); load(); }, [load]);
  useRealtimeReload('mw_tasks,mw_publications,mw_approval_steps,mw_contents', load);

  const m = useMemo(() => {
    if (st.loading || st.error) return null;
    const doneIds = new Set(st.lists.filter(l => l.is_done).map(l => l.id));
    const open = st.tasks.filter(t => !t.completed_at && !doneIds.has(t.list_id));
    const late = open.filter(t => isLate(t, doneIds));
    const weekAgo = Date.now() - 7 * 86400000;
    // Thông lượng 14 ngày: số thẻ vào cột hoàn thành mỗi ngày
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 86400000); return vnToday(d); });
    const doneByDay = new Map(days.map(d => [d, 0]));
    st.tasks.forEach(t => { const d = t.completed_at && vnDateOf(t.completed_at); if (doneByDay.has(d)) doneByDay.set(d, doneByDay.get(d) + 1); });
    const createdByDay = new Map(days.map(d => [d, 0]));
    st.tasks.forEach(t => { const d = vnDateOf(t.created_at); if (createdByDay.has(d)) createdByDay.set(d, createdByDay.get(d) + 1); });
    const chart = days.map(d => ({ d: `${d.slice(8)}/${d.slice(5, 7)}`, xong: doneByDay.get(d), tao: createdByDay.get(d) }));
    // Khối lượng theo người (thẻ đang mở)
    const openIds = new Set(open.map(t => t.id));
    const load = new Map();
    st.assignees.forEach(a => { if (openIds.has(a.task_id)) load.set(a.user_id, (load.get(a.user_id) || 0) + 1); });
    const lateIds = new Set(late.map(t => t.id));
    const lateBy = new Map();
    st.assignees.forEach(a => { if (lateIds.has(a.task_id)) lateBy.set(a.user_id, (lateBy.get(a.user_id) || 0) + 1); });
    const workload = [...load.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const pendingRuns = st.runs.filter(r => r.state === 'pending');
    const scheduled = st.pubs.filter(p => p.state === 'scheduled' || p.state === 'pending_verification');
    const published7 = st.pubs.filter(p => p.state === 'published' && p.verified_at && new Date(p.verified_at).getTime() >= weekAgo);
    const blocked = st.pubs.filter(p => p.state === 'blocked');
    const invalidated = st.runs.filter(r => r.state === 'invalidated' && r.closed_at && new Date(r.closed_at).getTime() >= weekAgo);
    const priority = [...open].sort((a, b) => (PRIORITY[b.priority].rank - PRIORITY[a.priority].rank) || ((a.due_at ? new Date(a.due_at) : Infinity) - (b.due_at ? new Date(b.due_at) : Infinity))).slice(0, 6);
    return { open, late, chart, workload, lateBy, pendingRuns, scheduled, published7, blocked, invalidated, priority, doneIds };
  }, [st]);

  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={6} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  const contentTitle = new Map(st.contents.map(c => [c.id, c.title]));
  const name = (id) => staffById.get(id)?.full_name || 'Không rõ';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric icon={ListChecks} label="Việc đang mở" value={m.open.length} hint={`${st.tasks.length} thẻ trong ${boards.filter(b => !b.archived_at).length} board`} onClick={() => onGo('board')} />
        <Metric icon={AlarmClock} label="Trễ hạn" value={m.late.length} tone={m.late.length ? 'e-tone-danger' : 'e-tone-success'} hint="Chưa vào cột hoàn thành" onClick={() => onGo('board', { filter: 'late' })} />
        <Metric icon={ShieldCheck} label="Đang chờ duyệt" value={m.pendingRuns.length} tone="e-tone-warning" hint="Quy trình duyệt chưa xong" onClick={() => onGo('approvals')} />
        <Metric icon={Send} label="Chờ đăng / xác minh" value={m.scheduled.length} tone="e-tone-info" hint="Đăng thủ công + nộp link" onClick={() => onGo('publishing')} />
        <Metric icon={CheckCircle2} label="Đã đăng 7 ngày" value={m.published7.length} tone="e-tone-success" hint="Đã có người xác minh link" onClick={() => onGo('publishing')} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        <div className="e-card e-card-pad">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div><div className="e-card-title">Thông lượng sản xuất 14 ngày</div><div className="e-card-sub">Thẻ tạo mới / thẻ vào cột hoàn thành mỗi ngày</div></div>
            <button type="button" className="e-icon-btn w-9 h-9" aria-label="Tải lại" onClick={load}><RotateCw className="w-4 h-4" /></button>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.chart} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f5' }} formatter={(v, k) => [v, k === 'xong' ? 'Hoàn thành' : 'Tạo mới']} />
                <Bar dataKey="tao" fill="#B9DCDC" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="xong" fill="#087F83" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11.5px] text-slate-400 mt-1">Nguồn: bảng mw_tasks (created_at, completed_at) · tải lúc {fmtDateTime(st.at)}</div>
        </div>

        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning-500" /> Cảnh báo</div>
          <ul className="space-y-2 text-[13px]">
            {m.blocked.map(p => <li key={p.id} className="flex gap-2"><span className="text-danger-600 font-semibold shrink-0">Chặn đăng</span><span className="text-slate-600 min-w-0">{contentTitle.get(p.content_id)} · {PLATFORMS[p.platform]} — {p.last_error}</span></li>)}
            {m.invalidated.map(r => <li key={r.id} className="flex gap-2"><span className="text-rose-600 font-semibold shrink-0">Mất hiệu lực</span><span className="text-slate-600 min-w-0">{contentTitle.get(r.content_id)} — đổi phiên bản sau khi gửi duyệt</span></li>)}
            {m.late.slice(0, 5).map(t => <li key={t.id}><button type="button" className="text-left flex gap-2" onClick={() => openTask(t.id)}><span className="text-danger-600 font-semibold shrink-0">Trễ hạn</span><span className="text-slate-600">{t.title} · {fmtDateTime(t.due_at)}</span></button></li>)}
            {!m.blocked.length && !m.invalidated.length && !m.late.length && <li className="text-slate-400">Không có cảnh báo.</li>}
          </ul>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Ưu tiên cao nhất</div>
          {m.priority.length === 0 ? <p className="text-[13px] text-slate-400">Không có việc đang mở.</p> : (
            <ul className="space-y-1.5">
              {m.priority.map(t => (
                <li key={t.id}><button type="button" onClick={() => openTask(t.id)} className="w-full text-left flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50">
                  <Tone meta={PRIORITY[t.priority]} /><span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-slate-800">{t.title}</span>
                  {t.due_at && <span className={`text-[12px] tabular-nums ${isLate(t, m.doneIds) ? 'text-danger-600 font-semibold' : 'text-slate-400'}`}>{fmtDate(t.due_at)}</span>}
                </button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="e-card e-card-pad">
          <div className="e-card-title mb-2">Khối lượng theo người</div>
          {m.workload.length === 0 ? <p className="text-[13px] text-slate-400">Chưa giao việc cho ai.</p> : (
            <ul className="space-y-2">
              {m.workload.map(([uid, n]) => (
                <li key={uid} className="flex items-center gap-2.5">
                  <Avatar person={staffById.get(uid)} size={28} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-slate-700">{name(uid)}</span>
                  <span className="text-[12.5px] tabular-nums text-slate-500">{n} việc{m.lateBy.get(uid) ? <b className="text-danger-600"> · {m.lateBy.get(uid)} trễ</b> : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="e-card e-card-pad">
          <div className="flex items-center justify-between mb-2"><div className="e-card-title">Chiến dịch</div><button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => onGo('campaigns')}>Xem tất cả</button></div>
          {st.campaigns.length === 0 ? <p className="text-[13px] text-slate-400">Chưa có chiến dịch.</p> : (
            <ul className="space-y-2">
              {st.campaigns.slice(0, 5).map(c => {
                const items = st.contents.filter(x => x.campaign_id === c.id);
                const pub = items.filter(x => x.workflow_status === 'published').length;
                return (
                  <li key={c.id} className="text-[13px]">
                    <div className="flex items-center gap-2"><span className="font-semibold text-slate-800 truncate flex-1">{c.name}</span><Tone meta={CAMPAIGN_STATUS[c.status]} /></div>
                    <div className="text-[12px] text-slate-400">{items.length} nội dung · {pub} đã đăng{c.end_date ? ` · đến ${fmtDate(`${c.end_date}T05:00:00Z`)}` : ''}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Việc của tôi ----------
const BUCKETS = [
  { id: 'late', label: 'Quá hạn', tone: 'text-danger-600' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'week', label: '7 ngày tới' },
  { id: 'later', label: 'Sau đó' },
  { id: 'none', label: 'Chưa có hạn' },
];
export function MyTasks({ profile, workspaces, openTask }) {
  const [st, setSt] = useState({ loading: true });
  const load = useCallback(async () => {
    try {
      const ids = (await mwApi.myTaskIds(profile.id)).map(r => r.task_id);
      const tasks = await mwApi.tasksByIds(ids);
      const bIds = [...new Set(tasks.map(t => t.board_id))];
      const lists = bIds.length ? await mwApi.lists(bIds) : [];
      const wsIds = workspaces.map(w => w.id);
      const boards = wsIds.length ? await mwApi.boards(wsIds) : [];
      setSt({ loading: false, tasks, lists, boards });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [profile.id, workspaces]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('mw_tasks,mw_task_assignees', load);

  if (st.loading) return <div className="e-card e-card-pad"><Skeleton rows={5} /></div>;
  if (st.error) return <div className="e-card"><ErrorState description={st.error.message} onRetry={load} /></div>;
  const doneIds = new Set(st.lists.filter(l => l.is_done).map(l => l.id));
  const listName = new Map(st.lists.map(l => [l.id, l.name]));
  const board = new Map(st.boards.map(b => [b.id, b]));
  const wsName = new Map(workspaces.map(w => [w.id, w.name]));
  const open = st.tasks.filter(t => !t.completed_at && !doneIds.has(t.list_id));
  const today = vnToday();
  const week = vnToday(new Date(Date.now() + 7 * 86400000));
  const bucket = (t) => {
    if (!t.due_at) return 'none';
    if (isLate(t, doneIds)) return 'late';
    const d = vnDateOf(t.due_at);
    return d === today ? 'today' : d <= week ? 'week' : 'later';
  };
  if (!open.length) return <div className="e-card"><EmptyState icon={Inbox} title="Bạn không có việc đang mở" description="Việc được giao cho bạn trong mọi workspace sẽ hiện ở đây." /></div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {BUCKETS.map(b => {
        const items = open.filter(t => bucket(t) === b.id).sort((x, y) => (x.due_at ? new Date(x.due_at) : Infinity) - (y.due_at ? new Date(y.due_at) : Infinity));
        if (!items.length) return null;
        return (
          <section key={b.id} className="e-card e-card-pad">
            <h3 className={`text-[14px] font-bold mb-2 ${b.tone || 'text-slate-800'}`}>{b.label} <span className="text-slate-400 font-medium">· {items.length}</span></h3>
            <ul className="space-y-1">
              {items.map(t => (
                <li key={t.id}>
                  <button type="button" onClick={() => openTask(t.id)} className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 flex items-start gap-2.5">
                    <Tone meta={PRIORITY[t.priority]} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-slate-800">{t.title}</span>
                      <span className="block text-[12px] text-slate-400 truncate">{wsName.get(board.get(t.board_id)?.workspace_id)} › {board.get(t.board_id)?.name} › {listName.get(t.list_id)}</span>
                    </span>
                    {t.due_at && <span className={`text-[12px] tabular-nums whitespace-nowrap ${b.id === 'late' ? 'text-danger-600 font-semibold' : 'text-slate-500'}`}><CalendarClock className="w-3.5 h-3.5 inline -mt-0.5" /> {fmtDateTime(t.due_at)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
