// ============================================================
// CÔNG VIỆC & DUYỆT (Ethics BOS D10 "Vận hành - Quản lý công việc")
// Tab "Công việc": lọc nhanh + 4 thẻ số liệu + Danh sách (DataTable) / Kanban kéo thả,
//   tạo / sửa việc, ngăn chi tiết có dòng thời gian bình luận + đổi trạng thái.
//   Dữ liệu: bảng tasks + task_comments (supabase/work_tasks.sql). RLS tự giới hạn:
//   mỗi người thấy việc mình tạo / mình phụ trách, Admin thấy tất cả.
// Tab "Chờ duyệt (n)" (Admin / Kế toán): hộp tổng hợp CHỈ XEM các yêu cầu đang chờ
//   ở các màn sẵn có (đơn nghỉ, ứng lương, tạm ứng, xem phiếu lương, thiết bị mới).
// Prop onNavigate(tabId) — dashboard truyền vào để nút "Mở để duyệt" chuyển màn.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, List, KanbanSquare, ListTodo, AlarmClock, CalendarClock, CircleCheck, Repeat, Inbox, RotateCw, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { runWithReason } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { DataTable, FilterBar, FilterSelect, AlertStrip, EmptyState, ErrorState, usePageTitle } from '@/components/ds';
import { Customer360Button } from '@/features/crm/Customer360.jsx';
import TaskKanban from './TaskKanban.jsx';
import TaskDrawer from './TaskDrawer.jsx';
import TaskFormModal from './TaskFormModal.jsx';
import ApprovalInbox, { useApprovalInbox } from './ApprovalInbox.jsx';
import {
  TASK_STATUS, TASK_PRIORITY, STATUS_ORDER, isOpen, isOverdue, isDueToday, isMissingTable,
  fmtDue, dueHint, initials, hasRole,
} from './taskMeta';

const LIMIT = 1000;
const VIEW_KEY = 'work.tasks.view';
const QUICK = [
  { id: 'all', label: 'Tất cả' },
  { id: 'mine', label: 'Của tôi' },
  { id: 'assigned', label: 'Tôi giao' },
  { id: 'overdue', label: 'Quá hạn' },
  { id: 'done', label: 'Hoàn thành' },
];

const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'; } catch { return 'list'; } };
const saveView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* trình duyệt chặn lưu: bỏ qua */ } };

// Việc đang mở lên trước (hạn gần nhất trước, ưu tiên cao trước); việc đã xong / huỷ xuống cuối
const defaultOrder = (a, b) => {
  const oa = isOpen(a) ? 0 : 1; const ob = isOpen(b) ? 0 : 1;
  if (oa !== ob) return oa - ob;
  if (oa === 0) {
    const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
    const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
    if (da !== db) return da - db;
    return (TASK_PRIORITY[b.priority]?.rank ?? 1) - (TASK_PRIORITY[a.priority]?.rank ?? 1);
  }
  return String(b.completed_at || b.updated_at).localeCompare(String(a.completed_at || a.updated_at));
};

// Bóc số bình luận từ embed task_comments(count)
const withCount = (r) => {
  const { task_comments: tc, ...rest } = r;
  return { ...rest, comment_count: Array.isArray(tc) ? (tc[0]?.count ?? 0) : (r.comment_count ?? 0) };
};

function Metric({ icon: Icon, label, value, hint, tone = '', onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`e-metric ${onClick ? 'e-card-hover' : ''} ${active ? '!border-teal-300 ring-2 ring-teal-100' : ''}`}>
      <span className={`e-metric-icon ${tone}`}><Icon /></span>
      <span className="min-w-0">
        <span className="e-metric-label block !whitespace-normal leading-tight">{label}</span>
        <span className="e-metric-value block">{value}</span>
        {hint && <span className="e-metric-hint hidden sm:block">{hint}</span>}
      </span>
    </Tag>
  );
}

export default function TasksPage({ onNavigate }) {
  usePageTitle('Công việc & Duyệt');
  const { profile } = useAuth();
  const meId = profile?.id;
  const isAdmin = hasRole(profile, 'admin');
  const canApprove = hasRole(profile, 'admin', 'accountant');

  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  const [people, setPeople] = useState([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);

  const [q, setQ] = useState('');
  const [quick, setQuick] = useState('all');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [view, setView] = useState(readView);

  const [form, setForm] = useState({ open: false, task: null });
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);

  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);

  // ---------- Tải dữ liệu ----------
  const loadPeople = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, is_active, role, role_2').order('full_name');
    setPeople(data || []);
    setPeopleLoaded(true);
  }, []);

  const loadTasks = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    const base = (sel) => supabase.from('tasks').select(sel).order('created_at', { ascending: false }).limit(LIMIT);
    let { data, error: err } = await base('*, task_comments(count)').eq('task_comments.kind', 'comment');
    if (err && !isMissingTable(err)) ({ data, error: err } = await base('*')); // embed đếm bình luận lỗi -> lấy bảng trơn
    if (err) {
      const miss = isMissingTable(err);
      setMissing(miss);
      if (!miss) setError(err);
      setTasks([]); setLoading(false); return;
    }
    setMissing(false);
    setTasks((data || []).map(withCount));
    setLoading(false);
  }, []);

  useEffect(() => { loadPeople(); }, [loadPeople]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Realtime: người khác đổi / giao việc -> tải lại nhẹ (gộp nhiều sự kiện liền nhau)
  const reloadTimer = useRef(null);
  useEffect(() => {
    if (missing) return undefined;
    const ch = supabase.channel(`work-tasks-${meId || 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(() => loadTasks({ silent: true }), 700);
      })
      .subscribe();
    return () => { clearTimeout(reloadTimer.current); supabase.removeChannel(ch); };
  }, [missing, meId, loadTasks]);

  const inbox = useApprovalInbox({ enabled: canApprove && peopleLoaded, isAdmin, meId, peopleById });

  // ---------- Số liệu ----------
  const stats = useMemo(() => {
    const now = Date.now(); const weekAgo = now - 7 * 86400000;
    const open = tasks.filter(isOpen);
    return {
      open: open.length,
      mineOpen: open.filter(t => t.assignee_id === meId).length,
      overdue: tasks.filter(t => isOverdue(t, now)).length,
      today: tasks.filter(isDueToday).length,
      done7: tasks.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at).getTime() >= weekAgo).length,
      mine: tasks.filter(t => t.assignee_id === meId && t.status !== 'cancelled').length,
      assigned: tasks.filter(t => t.created_by === meId && t.assignee_id !== meId && t.status !== 'cancelled').length,
    };
  }, [tasks, meId]);

  // ---------- Lọc ----------
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const now = Date.now();
    return tasks.filter(t => {
      if (quick === 'mine' && (t.assignee_id !== meId || t.status === 'cancelled')) return false;
      if (quick === 'assigned' && (t.created_by !== meId || t.assignee_id === meId || t.status === 'cancelled')) return false;
      if (quick === 'overdue' && !isOverdue(t, now)) return false;
      if (quick === 'done' && t.status !== 'done') return false;
      if (assignee === '__none' ? !!t.assignee_id : assignee && t.assignee_id !== assignee) return false;
      if (priority && t.priority !== priority) return false;
      if (kw && ![t.title, t.description, t.related_phone, peopleById[t.assignee_id]?.full_name]
        .some(x => String(x || '').toLowerCase().includes(kw))) return false;
      return true;
    }).sort(defaultOrder);
  }, [tasks, q, quick, assignee, priority, meId, peopleById]);

  const assigneeOptions = useMemo(() => {
    const ids = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))];
    const opts = ids.map(id => ({ value: id, label: id === meId ? `${peopleById[id]?.full_name || 'Tôi'} (tôi)` : peopleById[id]?.full_name || 'Không rõ' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    if (tasks.some(t => !t.assignee_id)) opts.push({ value: '__none', label: 'Chưa giao' });
    return opts;
  }, [tasks, peopleById, meId]);

  const activeFilters = (q ? 1 : 0) + (assignee ? 1 : 0) + (priority ? 1 : 0) + (quick !== 'all' ? 1 : 0);
  const clearFilters = () => { setQ(''); setAssignee(''); setPriority(''); setQuick('all'); };

  // ---------- Thao tác ----------
  const patchLocal = useCallback((id, patch) => setTasks(list => list.map(t => (t.id === id ? { ...t, ...patch } : t))), []);

  // Đổi trạng thái: cập nhật ngay trên màn, lỗi thì trả lại như cũ
  const changeStatus = useCallback(async (task, to, reason) => {
    if (!task || task.status === to) return true;
    const prev = { status: task.status, completed_at: task.completed_at };
    patchLocal(task.id, { status: to, completed_at: to === 'done' ? new Date().toISOString() : null });
    const build = () => supabase.from('tasks').update({ status: to }).eq('id', task.id).select();
    const { data, error: err } = reason ? await runWithReason(build, reason) : await build();
    if (err || !data?.length) {
      patchLocal(task.id, prev);
      toast.error(err ? `Không đổi được trạng thái: ${err.message}` : 'Bạn không có quyền đổi trạng thái việc này');
      return false;
    }
    const row = data[0];
    patchLocal(task.id, row);
    if (reason) {
      const { error: cErr } = await supabase.from('task_comments').insert({ task_id: task.id, author_id: meId, kind: 'comment', body: `Lý do huỷ: ${reason}` });
      if (!cErr) setTasks(list => list.map(t => (t.id === task.id ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t)));
    }
    if (to === 'done' && row.next_task_id && !task.next_task_id) {
      toast.success('Đã hoàn thành — đã tạo sẵn lần lặp tiếp theo');
      loadTasks({ silent: true });
    } else {
      toast.success(`Đã chuyển sang "${TASK_STATUS[to]?.label || to}"`);
    }
    return true;
  }, [meId, loadTasks, patchLocal]);

  const submitForm = async (payload) => {
    setSaving(true);
    const editing = form.task;
    let res;
    if (editing) {
      const patch = Object.fromEntries(Object.entries(payload).filter(([k, v]) => (editing[k] ?? null) !== v));
      if (!Object.keys(patch).length) { setSaving(false); setForm({ open: false, task: null }); return; }
      res = await supabase.from('tasks').update(patch).eq('id', editing.id).select();
    } else {
      res = await supabase.from('tasks').insert({ ...payload, created_by: meId }).select();
    }
    setSaving(false);
    if (res.error || !res.data?.length) {
      const msg = res.error?.message || '';
      toast.error(/row-level security/i.test(msg) || !res.error
        ? 'Không lưu được — bạn chỉ sửa được việc mình tạo / mình phụ trách, và chỉ người tạo hoặc Admin được giao lại.'
        : `Không lưu được: ${msg}`);
      return;
    }
    const row = res.data[0];
    if (editing) {
      patchLocal(editing.id, row);
      toast.success('Đã lưu thay đổi');
    } else {
      setTasks(list => [{ ...row, comment_count: 0 }, ...list]);
      toast.success(row.assignee_id && row.assignee_id !== meId ? `Đã giao việc cho ${peopleById[row.assignee_id]?.full_name || 'người phụ trách'}` : 'Đã tạo công việc');
    }
    setForm({ open: false, task: null });
  };

  const openTask = tasks.find(t => t.id === openId) || null;
  useEffect(() => { if (openId && !loading && !openTask) setOpenId(null); }, [openId, openTask, loading]);

  // ---------- Bảng ----------
  const columns = [
    {
      key: 'title', header: 'Công việc', sortValue: t => t.title,
      cell: t => (
        <div className="min-w-[220px] max-w-[440px]">
          <div className={`font-semibold text-[14px] leading-snug flex items-center gap-1.5 ${t.status === 'done' || t.status === 'cancelled' ? 'text-slate-500' : 'text-slate-900'}`}>
            <span className="truncate">{t.title}</span>
            {t.recurrence && <Repeat className="w-3.5 h-3.5 text-teal-600 shrink-0" aria-label="Định kỳ" />}
          </div>
          {(t.description || t.related_phone) && (
            <div className="flex items-center gap-2 mt-0.5">
              {t.description && <span className="text-[12.5px] text-slate-500 truncate">{t.description}</span>}
              {t.related_phone && <Customer360Button phone={t.related_phone} label="Khách" className="!h-6 !px-1.5 !text-[12px] shrink-0" />}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'assignee', header: 'Người phụ trách', sortValue: t => peopleById[t.assignee_id]?.full_name || '',
      cell: t => {
        const p = peopleById[t.assignee_id];
        return (
          <span className="inline-flex items-center gap-2 min-w-[140px]">
            <span className={`w-8 h-8 rounded-full grid place-items-center text-[11.5px] font-bold shrink-0 overflow-hidden ${p?.avatar_url ? '' : 'bg-teal-50 text-teal-700'}`}>
              {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p ? initials(p.full_name) : '?'}
            </span>
            <span className="text-[13.5px] text-slate-700 truncate max-w-[160px]">{p?.full_name || 'Chưa giao'}{t.assignee_id === meId ? ' (tôi)' : ''}</span>
          </span>
        );
      },
    },
    {
      key: 'due', header: 'Hạn', width: 170, sortValue: t => (t.due_at ? new Date(t.due_at).getTime() : Number.MAX_SAFE_INTEGER),
      cell: t => {
        if (!t.due_at) return <span className="text-slate-400 text-[13px]">Không có hạn</span>;
        const late = isOverdue(t);
        return (
          <div className={`text-[13px] tabular-nums whitespace-nowrap ${late ? 'text-danger-600 font-semibold' : 'text-slate-600'}`}>
            <CalendarClock className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{fmtDue(t.due_at)}
            {dueHint(t) && <div className={`text-[11.5px] ${late ? '' : 'text-slate-400 font-normal'}`}>{dueHint(t)}</div>}
          </div>
        );
      },
    },
    {
      key: 'priority', header: 'Ưu tiên', width: 120, sortValue: t => TASK_PRIORITY[t.priority]?.rank ?? 1,
      cell: t => { const m = TASK_PRIORITY[t.priority] || TASK_PRIORITY.normal; return <span className={`e-badge e-badge-sm ${m.tone}`}>{m.label}</span>; },
    },
    {
      key: 'status', header: 'Trạng thái', width: 140, sortValue: t => STATUS_ORDER.indexOf(t.status),
      cell: t => { const m = TASK_STATUS[t.status] || TASK_STATUS.todo; return <span className={`e-badge ${m.tone}`}><m.icon /> {m.label}</span>; },
    },
  ];

  const createBtn = (
    <button onClick={() => setForm({ open: true, task: null })} className="e-btn e-btn-primary" disabled={missing}>
      <Plus /> Tạo công việc
    </button>
  );

  // ---------- Giao diện ----------
  return (
    <div className="space-y-4">
      {canApprove && (
        <div className="e-tabs" role="tablist" aria-label="Công việc và duyệt">
          <button role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')} className={`e-tab ${tab === 'tasks' ? 'e-tab-active' : ''}`}>
            <ListTodo /> Công việc
          </button>
          <button role="tab" aria-selected={tab === 'approvals'} onClick={() => setTab('approvals')} className={`e-tab ${tab === 'approvals' ? 'e-tab-active' : ''}`}>
            <Inbox /> Chờ duyệt
            {inbox.loading ? <span className="e-tab-count">…</span>
              : inbox.total > 0 ? <span className="e-badge e-badge-sm e-tone-warning tabular-nums">{inbox.total}</span>
                : <span className="e-tab-count">(0)</span>}
          </button>
        </div>
      )}

      {tab === 'approvals' && canApprove ? (
        <ApprovalInbox inbox={inbox} onNavigate={onNavigate} />
      ) : (
        <>
          {missing && (
            <AlertStrip tone="info">
              <b>Chưa bật quản lý công việc.</b> {isAdmin ? <>Chạy file <code className="px-1 rounded bg-white/60">supabase/work_tasks.sql</code> trong Supabase SQL Editor để tạo bảng công việc và bình luận.</> : 'Nhờ Admin bật tính năng này (chạy supabase/work_tasks.sql).'}
              {canApprove && ' Tab "Chờ duyệt" vẫn dùng được.'}
            </AlertStrip>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[18px] lg:text-[22px] font-bold text-slate-900 mr-auto">Danh sách công việc</h2>
            <div className="e-seg" role="group" aria-label="Kiểu hiển thị">
              <button type="button" onClick={() => { setView('list'); saveView('list'); }} aria-pressed={view === 'list'} className={`e-seg-item ${view === 'list' ? 'e-seg-active' : ''}`}><List /> Danh sách</button>
              <button type="button" onClick={() => { setView('board'); saveView('board'); }} aria-pressed={view === 'board'} className={`e-seg-item ${view === 'board' ? 'e-seg-active' : ''}`}><KanbanSquare /> Kanban</button>
            </div>
            {createBtn}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={ListTodo} label="Đang mở" value={loading ? '…' : stats.open} hint={!loading && stats.mineOpen ? `${stats.mineOpen} việc của tôi` : 'Cần làm · Đang làm · Chờ duyệt'}
              onClick={() => setQuick('all')} />
            <Metric icon={AlarmClock} label="Quá hạn" value={loading ? '…' : stats.overdue} tone={stats.overdue ? '!bg-danger-50 !text-danger-600' : ''}
              hint="Chưa xong mà đã qua hạn" onClick={() => setQuick(quick === 'overdue' ? 'all' : 'overdue')} active={quick === 'overdue'} />
            <Metric icon={CalendarClock} label="Đến hạn hôm nay" value={loading ? '…' : stats.today} tone="!bg-warning-50 !text-warning-600" hint="Còn mở, hạn trong hôm nay" />
            <Metric icon={CircleCheck} label="Hoàn thành 7 ngày" value={loading ? '…' : stats.done7} tone="!bg-success-50 !text-success-600"
              hint="Tính theo lúc hoàn thành" onClick={() => setQuick(quick === 'done' ? 'all' : 'done')} active={quick === 'done'} />
          </div>

          <FilterBar
            search={{ value: q, onChange: setQ, placeholder: 'Tìm việc, mô tả, SĐT khách…' }}
            actions={<button onClick={() => loadTasks()} className="e-icon-btn" aria-label="Tải lại" title="Tải lại"><RotateCw className="w-4 h-4" /></button>}
          >
            <div className="e-seg max-w-full overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Lọc nhanh">
              {QUICK.map(f => {
                const n = f.id === 'mine' ? stats.mine : f.id === 'assigned' ? stats.assigned : f.id === 'overdue' ? stats.overdue : null;
                return (
                  <button key={f.id} type="button" onClick={() => setQuick(f.id)} aria-pressed={quick === f.id}
                    className={`e-seg-item ${quick === f.id ? 'e-seg-active' : ''}`}>
                    {f.label}
                    {!loading && n > 0 && <span className={`text-[11.5px] tabular-nums ${f.id === 'overdue' ? 'text-danger-600' : 'text-slate-400'}`}>{n}</span>}
                  </button>
                );
              })}
            </div>
            <FilterSelect label="Người phụ trách" allLabel="Tất cả người phụ trách" value={assignee} onChange={setAssignee} options={assigneeOptions} className="flex-1 sm:flex-none" />
            <FilterSelect label="Độ ưu tiên" allLabel="Mọi độ ưu tiên" value={priority} onChange={setPriority} className="!min-w-[150px] flex-1 sm:flex-none"
              options={Object.entries(TASK_PRIORITY).map(([value, m]) => ({ value, label: m.label }))} />
          </FilterBar>

          {activeFilters > 0 && !loading && !missing && (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
              Đang lọc: <b className="text-slate-700">{filtered.length}</b> / {tasks.length} việc
              <button onClick={clearFilters} className="e-btn e-btn-ghost e-btn-sm">Xoá bộ lọc</button>
            </div>
          )}

          {missing ? (
            <div className="e-card">
              <EmptyState title="Chưa có bảng công việc" description="Sau khi Admin chạy supabase/work_tasks.sql, bạn có thể tạo và giao việc tại đây." icon={ClipboardList} />
            </div>
          ) : view === 'board' ? (
            error ? <div className="e-card"><ErrorState onRetry={() => loadTasks()} /></div>
              : loading ? (
                <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3].map(i => <div key={i} className="w-[280px] lg:flex-1 shrink-0 h-72 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
              ) : (
                <>
                  {filtered.filter(t => t.status !== 'cancelled').length === 0 && tasks.length > 0 && (
                    <AlertStrip tone="info" action="Xoá bộ lọc" onAction={clearFilters}>Không có việc nào khớp bộ lọc.</AlertStrip>
                  )}
                  <TaskKanban
                    tasks={filtered.filter(t => t.status !== 'cancelled')}
                    peopleById={peopleById}
                    onOpen={(t) => setOpenId(t.id)}
                    onMove={(t, to) => changeStatus(t, to)}
                  />
                  <div className="text-[12px] text-slate-400">Kéo thẻ sang cột khác để đổi trạng thái. Trên điện thoại: bấm vào thẻ để đổi.</div>
                </>
              )
          ) : (
            <DataTable
              rows={filtered}
              loading={loading}
              error={error}
              onRetry={() => loadTasks()}
              columns={columns}
              minWidth={820}
              pageSize={20}
              onRowClick={(t) => setOpenId(t.id)}
              rowClassName={(t) => (t.status === 'cancelled' ? 'opacity-60' : '')}
              empty={tasks.length === 0
                ? { title: 'Chưa có công việc nào', description: 'Tạo việc đầu tiên và giao cho đồng nghiệp.', icon: ClipboardList, action: createBtn }
                : { title: 'Không có việc nào khớp bộ lọc', description: 'Thử đổi bộ lọc hoặc từ khoá.', icon: ClipboardList, action: <button onClick={clearFilters} className="e-btn e-btn-secondary e-btn-sm">Xoá bộ lọc</button> }}
              footerStart={`${filtered.length} công việc`}
            />
          )}
        </>
      )}

      <TaskDrawer
        task={openTask}
        peopleById={peopleById}
        meId={meId}
        isAdmin={isAdmin}
        onClose={() => setOpenId(null)}
        onEdit={(t) => setForm({ open: true, task: t })}
        onStatus={changeStatus}
        onDeleted={(id) => { setOpenId(null); setTasks(list => list.filter(t => t.id !== id)); }}
        onCommented={(id) => setTasks(list => list.map(t => (t.id === id ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t)))}
      />

      <TaskFormModal
        open={form.open}
        task={form.task}
        people={people}
        meId={meId}
        canReassign={!form.task || form.task.created_by === meId || isAdmin}
        busy={saving}
        onClose={() => setForm({ open: false, task: null })}
        onSubmit={submitForm}
      />
    </div>
  );
}
