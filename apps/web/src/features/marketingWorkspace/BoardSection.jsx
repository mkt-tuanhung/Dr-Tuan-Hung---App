// ============================================================
// MARKETING WORKSPACE — BẢNG CÔNG VIỆC (S03 Kanban, S05 Bảng dữ liệu, S06 Lịch, S07 Timeline)
// Mọi chế độ xem dùng CHUNG 1 nguồn thẻ (mw_tasks) của board đang chọn -> đổi hạn ở Lịch
// thấy ngay ở Kanban / Bảng / Timeline, không nhân bản thẻ.
// Kéo thả: HTML5 (chuột). Cảm ứng / bàn phím: nút "Di chuyển" (phím M trên thẻ) mở hộp chọn cột + vị trí.
// Thay đổi lạc quan; lỗi / xung đột phiên bản -> hoàn tác + tải lại.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Columns3, Table2, CalendarDays, GanttChartSquare, LayoutDashboard, Images, Map as MapIcon, Archive, Trash2, FolderOpen, Paperclip, Link2, ImagePlus, UserPlus, Tag,
  MoreHorizontal, Move, CheckSquare, CalendarClock, ChevronLeft, ChevronRight, Download, RotateCcw, Filter, X,
} from 'lucide-react';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { EmptyState, ErrorState, SearchInput } from '@/components/ds';
import { vnToday } from '@/lib/vnTime';
import { mwApi, sha256OfFile } from './mwApi';
import { uploadViaPresignWithProgress } from '@/lib/r2Client';
import {
  PRIORITY, BOARD_TEMPLATES, bySort, fmtDate, fmtDateTime, isLate, moveToDate, toLocalInput, fromLocalInput, vnDateOf,
} from './mwMeta';
import { Modal, Field, Avatar, AvatarStack, Tone, Skeleton, attempt, BusyButton, Sel } from './mwUi';
import { KhoSourcePicker, useKhoAccess, KHO_LIST_STATUS } from './KhoSources';
import { GanttView, BoardDashboard, GalleryView, MapView } from './BoardViews2';

const VIEWS = [
  { id: 'kanban', label: 'Bảng', icon: Columns3 },
  { id: 'table', label: 'Bảng dữ liệu', icon: Table2 },
  { id: 'calendar', label: 'Lịch', icon: CalendarDays },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'gallery', label: 'Gallery', icon: Images },
  { id: 'map', label: 'Map', icon: MapIcon },
];

const storeGet = (k, d) => { try { return window.localStorage.getItem(k) || d; } catch { return d; } };
const storeSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* bỏ qua */ } };

// Vị trí sort cục bộ (giữa thẻ trước và sau) để thẻ nằm đúng chỗ ngay khi thả
function localSort(tasks, taskId, listId, afterId) {
  const col = tasks.filter(t => t.list_id === listId && t.id !== taskId).sort(bySort);
  if (!afterId) return (col[0] ? Number(col[0].sort_index) : 2048) - 1024;
  const i = col.findIndex(t => t.id === afterId);
  const prev = Number(col[i]?.sort_index ?? 0);
  const next = col[i + 1] ? Number(col[i + 1].sort_index) : null;
  return next == null ? prev + 1024 : (prev + next) / 2;
}

export function useBoardData(boardId, archived) {
  const [state, setState] = useState({ loading: true, error: null, lists: [], tasks: [], assignees: [], taskLabels: [], checks: [], atts: [], srcs: [] });
  const load = useCallback(async () => {
    if (!boardId) { setState(s => ({ ...s, loading: false, lists: [], tasks: [] })); return; }
    try {
      const [lists, tasks] = await Promise.all([mwApi.lists([boardId]), mwApi.tasks([boardId], { archived })]);
      const ids = tasks.map(t => t.id);
      const [assignees, taskLabels, checks, atts, srcs] = await Promise.all([mwApi.assignees(ids), mwApi.taskLabels(ids), mwApi.checklist(ids), mwApi.boardAttachments(ids),
        mwApi.taskSources(ids).catch(() => [])]);   // v2 chưa cài / không có quyền Kho -> bỏ qua
      setState({ loading: false, error: null, lists, tasks, assignees, taskLabels, checks, atts, srcs });
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e }));
    }
  }, [boardId, archived]);
  useEffect(() => { setState(s => ({ ...s, loading: true })); load(); }, [load]);
  useRealtimeReload(boardId ? 'mw_tasks,mw_lists,mw_task_assignees,mw_checklist_items' : '', load);
  const setTasks = (fn) => setState(s => ({ ...s, tasks: typeof fn === 'function' ? fn(s.tasks) : fn }));
  return { ...state, reload: load, setTasks };
}

export default function BoardSection({ ws, boards, perm, staffById, labels, openTask, reloadBoards, focusBoardId, initialFilter, taskVersion }) {
  const activeBoards = boards.filter(b => !b.archived_at);
  const [boardId, setBoardId] = useState(() => storeGet(`mw_board_${ws.id}`, ''));
  const [view, setView] = useState(() => storeGet('mw_view', 'kanban'));
  const [archived, setArchived] = useState(false);
  const [q, setQ] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fLate, setFLate] = useState(initialFilter === 'late');
  const [newBoard, setNewBoard] = useState(false);
  const [moveFor, setMoveFor] = useState(null);

  useEffect(() => { if (focusBoardId) setBoardId(focusBoardId); }, [focusBoardId]);
  useEffect(() => { if (initialFilter === 'late') setFLate(true); }, [initialFilter]);
  // board đã lưu không còn / không thấy -> chọn board đầu tiên
  const current = activeBoards.find(b => b.id === boardId) || activeBoards[0] || null;
  useEffect(() => { if (current) storeSet(`mw_board_${ws.id}`, current.id); }, [current, ws.id]);
  useEffect(() => { storeSet('mw_view', view); }, [view]);

  const data = useBoardData(current?.id, archived);
  // Thành viên workspace (để giao người thực hiện ngay khi tạo thẻ)
  const [members, setMembers] = useState([]);
  useEffect(() => {
    let alive = true;
    mwApi.members(ws.id).then(m => { if (alive) setMembers(m); }).catch(() => {});
    return () => { alive = false; };
  }, [ws.id]);
  const memberPeople = useMemo(() => {
    const order = { editor: 0, manager: 1, owner: 2, viewer: 3 };
    const ids = new Map(members.map(m => [m.user_id, m.role]));
    if (ws.owner_id && !ids.has(ws.owner_id)) ids.set(ws.owner_id, 'owner');
    return [...ids.entries()].filter(([, r]) => r !== 'viewer').sort((a, b) => order[a[1]] - order[b[1]])
      .map(([id, role]) => ({ ...(staffById.get(id) || { id, full_name: 'Không rõ' }), mwRole: role }));
  }, [members, ws.owner_id, staffById]);
  // Drawer vừa lưu thẻ -> tải lại board (taskVersion tăng)
  useEffect(() => { if (taskVersion) data.reload(); }, [taskVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const lists = useMemo(() => data.lists.filter(l => !l.archived_at).sort(bySort), [data.lists]);
  const doneIds = useMemo(() => new Set(data.lists.filter(l => l.is_done).map(l => l.id)), [data.lists]);
  const asgBy = useMemo(() => {
    const m = new Map();
    data.assignees.forEach(a => { if (!m.has(a.task_id)) m.set(a.task_id, []); m.get(a.task_id).push(a.user_id); });
    return m;
  }, [data.assignees]);
  const lblBy = useMemo(() => {
    const m = new Map();
    data.taskLabels.forEach(a => { if (!m.has(a.task_id)) m.set(a.task_id, []); m.get(a.task_id).push(a.label_id); });
    return m;
  }, [data.taskLabels]);
  const chkBy = useMemo(() => {
    const m = new Map();
    data.checks.forEach(c => { const v = m.get(c.task_id) || [0, 0]; v[1] += 1; if (c.done) v[0] += 1; m.set(c.task_id, v); });
    return m;
  }, [data.checks]);
  const labelById = useMemo(() => new Map(labels.map(l => [l.id, l])), [labels]);
  const srcBy = useMemo(() => {
    const m = new Map();
    data.srcs.forEach(x => m.set(x.task_id, (m.get(x.task_id) || 0) + 1));
    return m;
  }, [data.srcs]);
  const attBy = useMemo(() => {
    const m = new Map();
    data.atts.forEach(a => { if (!m.has(a.task_id)) m.set(a.task_id, []); m.get(a.task_id).push(a); });
    return m;
  }, [data.atts]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.tasks.filter(t =>
      (!term || t.title.toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term))
      && (!fAssignee || (fAssignee === '_none' ? !(asgBy.get(t.id) || []).length : (asgBy.get(t.id) || []).includes(fAssignee)))
      && (!fLabel || (lblBy.get(t.id) || []).includes(fLabel))
      && (!fPriority || t.priority === fPriority)
      && (!fLate || isLate(t, doneIds)));
  }, [data.tasks, q, fAssignee, fLabel, fPriority, fLate, asgBy, lblBy, doneIds]);
  const hasFilter = q || fAssignee || fLabel || fPriority || fLate;
  const clearFilter = () => { setQ(''); setFAssignee(''); setFLabel(''); setFPriority(''); setFLate(false); };

  const ctx = { staffById, asgBy, lblBy, chkBy, labelById, attBy, srcBy, doneIds, openTask, perm, labels, memberPeople };

  // ----- Ghi -----
  const moveTask = async (task, listId, afterId, targetBoard) => {
    const prev = data.tasks;
    const crossBoard = targetBoard && targetBoard !== task.board_id;
    if (crossBoard) data.setTasks(ts => ts.filter(t => t.id !== task.id));
    else data.setTasks(ts => ts.map(t => (t.id === task.id ? { ...t, list_id: listId, sort_index: localSort(ts, task.id, listId, afterId) } : t)));
    try {
      await mwApi.moveTask(task.id, listId, afterId, task.version);
      if (!crossBoard) {
        const fresh = await mwApi.task(task.id);
        if (fresh) data.setTasks(ts => ts.map(t => (t.id === task.id ? fresh : t)));
      } else toast.success('Đã chuyển thẻ sang board khác');
    } catch (e) {
      data.setTasks(prev);
      toast.error(e.message);
      if (e.conflict) data.reload();
    }
  };
  const patchTask = async (task, patch) => {
    const prev = data.tasks;
    data.setTasks(ts => ts.map(t => (t.id === task.id ? { ...t, ...patch } : t)));
    try {
      const fresh = await mwApi.updateTask(task.id, patch, task.version);
      data.setTasks(ts => ts.map(t => (t.id === task.id ? fresh : t)));
      return true;
    } catch (e) {
      data.setTasks(prev);
      toast.error(e.message);
      if (e.conflict) data.reload();
      return false;
    }
  };
  // Thêm thẻ nhanh: tên + người thực hiện + nhãn + link + ảnh (lỗi từng phần không làm mất thẻ đã tạo)
  const quickAdd = async (listId, f) => {
    const t = await attempt(() => mwApi.createTask(current.id, listId, f.title));
    if (!t) return false;
    data.setTasks(ts => [...ts, t]);
    const errs = [];
    const run = (p) => p.catch(e => errs.push(e.message));
    await Promise.all([
      ...f.assignees.map(id => run(mwApi.addAssignee(t.id, id))),
      ...f.labelIds.map(id => run(mwApi.addTaskLabel(t.id, id))),
      ...f.links.map(url => run(mwApi.addAttachment(t.id, { url, name: url.slice(0, 300) }))),
    ]);
    for (const p of (f.sources || [])) await run(mwApi.addTaskSource(t.id, p.customerId, p.assetId));
    for (const file of f.images) {
      await run((async () => {
        const sha = await sha256OfFile(file);
        const url = await uploadViaPresignWithProgress(file, 'mw-attachments');
        await mwApi.addAttachment(t.id, { url, name: file.name.slice(0, 300), mime: file.type || null, size_bytes: file.size, sha256: sha });
      })());
    }
    if (errs.length) toast.error(`Đã tạo thẻ nhưng lỗi: ${errs[0]}`);
    data.reload();
    return true;
  };

  if (!activeBoards.length) {
    return (
      <div className="e-card">
        <EmptyState icon={Columns3} title="Workspace chưa có board"
          description={perm.manage ? 'Bảng công việc = các cột (VD Ý tưởng → Kịch bản → Quay → Dựng → Đăng) chứa thẻ việc. Bấm Tạo board, chọn mẫu cột, rồi thêm thẻ và giao người.' : 'Quản lý workspace chưa tạo bảng công việc nào.'}
          action={perm.manage && <button type="button" className="e-btn e-btn-primary" onClick={() => setNewBoard(true)}><Plus /> Tạo board</button>} />
        <NewBoardModal open={newBoard} onClose={() => setNewBoard(false)} ws={ws} onCreated={async (id) => { await reloadBoards(); setBoardId(id); }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Chọn board */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {activeBoards.map(b => (
          <button key={b.id} type="button" onClick={() => setBoardId(b.id)}
            className={`e-chip shrink-0 ${current?.id === b.id ? 'e-chip-active' : ''}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />{b.name}
          </button>
        ))}
        {perm.manage && <button type="button" className="e-chip shrink-0 border-dashed" onClick={() => setNewBoard(true)}><Plus className="w-4 h-4" /> Board mới</button>}
      </div>

      {/* Chế độ xem + lọc */}
      <div className="e-card p-2.5 space-y-2.5">
        <div className="e-tabs border-b-0" role="tablist" aria-label="Chế độ xem">
          {VIEWS.map(v => (
            <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className={`e-tab ${view === v.id ? 'e-tab-active' : ''}`}>
              <v.icon />{v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Tìm thẻ trong board…" className="w-full sm:w-64" />
          <Sel wrapClass="!min-w-[150px]" value={fAssignee} onChange={e => setFAssignee(e.target.value)} aria-label="Lọc người phụ trách">
            <option value="">Mọi người</option>
            <option value="_none">Chưa giao</option>
            {[...new Set(data.assignees.map(a => a.user_id))].map(id => <option key={id} value={id}>{staffById.get(id)?.full_name || 'Không rõ'}</option>)}
          </Sel>
          <Sel wrapClass="!min-w-[150px]" value={fLabel} onChange={e => setFLabel(e.target.value)} aria-label="Lọc nhãn">
            <option value="">Mọi nhãn</option>
            {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Sel>
          <Sel wrapClass="!min-w-[150px]" value={fPriority} onChange={e => setFPriority(e.target.value)} aria-label="Lọc ưu tiên">
            <option value="">Mọi ưu tiên</option>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Sel>
          <button type="button" className={`e-chip ${fLate ? 'e-chip-active' : ''}`} aria-pressed={fLate} onClick={() => setFLate(v => !v)}>Trễ hạn</button>
          <button type="button" className={`e-chip ${archived ? 'e-chip-active' : ''}`} aria-pressed={archived} onClick={() => setArchived(v => !v)}><Archive className="w-4 h-4" /> Đã lưu trữ</button>
          {hasFilter && <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={clearFilter}><X /> Xoá lọc</button>}
          <span className="ml-auto text-[12.5px] text-slate-400 tabular-nums">{filtered.length}/{data.tasks.length} thẻ{hasFilter ? ' (đang lọc)' : ''}</span>
        </div>
      </div>

      {data.error ? <div className="e-card"><ErrorState description={data.error.message} onRetry={data.reload} /></div>
        : data.loading ? <div className="e-card e-card-pad"><Skeleton rows={5} /></div>
          : archived ? <ArchivedList tasks={filtered} lists={data.lists} perm={perm} onRestore={(t) => patchTask(t, { archived_at: null }).then(ok => ok && data.setTasks(ts => ts.filter(x => x.id !== t.id)))} openTask={openTask} />
            : view === 'kanban' ? <KanbanView lists={lists} tasks={filtered} allTasks={data.tasks} ctx={ctx} onMove={moveTask} onQuickAdd={quickAdd} onMoveSheet={setMoveFor} onReload={data.reload} board={current} />
              : view === 'table' ? <TableView lists={lists} tasks={filtered} ctx={ctx} onPatch={patchTask} onMove={moveTask} allTasks={data.tasks} board={current} />
                : view === 'calendar' ? <CalendarView tasks={filtered} ctx={ctx} onPatch={patchTask} />
                  : view === 'gantt' ? <GanttView lists={lists} tasks={filtered} ctx={ctx} onPatch={patchTask} />
                    : view === 'dashboard' ? <BoardDashboard lists={lists} tasks={filtered} ctx={ctx} />
                      : view === 'gallery' ? <GalleryView lists={lists} tasks={filtered} ctx={ctx} />
                        : view === 'map' ? <MapView tasks={filtered} ctx={ctx} />
                          : <TimelineView lists={lists} tasks={filtered} ctx={ctx} />}

      <NewBoardModal open={newBoard} onClose={() => setNewBoard(false)} ws={ws} onCreated={async (id) => { await reloadBoards(); setBoardId(id); }} />
      <MoveSheet task={moveFor} onClose={() => setMoveFor(null)} boards={activeBoards} lists={lists} tasks={data.tasks}
        onMove={async (listId, afterId, targetBoard) => { const t = moveFor; setMoveFor(null); await moveTask(t, listId, afterId, targetBoard); }} />
    </div>
  );
}

// ---------- Thẻ ----------
function TaskCard({ t, ctx, onDragStart, onDragEnd, dragging, onMoveSheet }) {
  const people = (ctx.asgBy.get(t.id) || []).map(id => ctx.staffById.get(id) || { id, full_name: '?' });
  const lbls = (ctx.lblBy.get(t.id) || []).map(id => ctx.labelById.get(id)).filter(Boolean);
  const chk = ctx.chkBy.get(t.id);
  const atts = ctx.attBy.get(t.id) || [];
  const cover = atts.find(a => /^image\//.test(a.mime || ''));
  const late = isLate(t, ctx.doneIds);
  const pr = PRIORITY[t.priority];
  return (
    <article draggable={ctx.perm.edit} onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={() => ctx.openTask(t.id)} tabIndex={0} aria-label={t.title} data-task-id={t.id}
      onKeyDown={(e) => { if (e.key === 'Enter') ctx.openTask(t.id); if ((e.key === 'm' || e.key === 'M') && ctx.perm.edit) { e.preventDefault(); onMoveSheet(t); } }}
      className={`group relative rounded-2xl bg-white border shadow-soft cursor-pointer transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-300
        motion-safe:hover:-translate-y-0.5 hover:shadow-card ${late ? 'border-danger-200' : 'border-slate-200/80 hover:border-teal-200'} ${dragging ? 'opacity-40' : ''}`}>
      {cover ? <img src={cover.url} alt="" loading="lazy" className="w-full h-32 object-cover rounded-t-2xl bg-slate-100" />
        : t.cover_color && <div className="h-2 rounded-t-2xl" style={{ background: t.cover_color }} />}
      <div className="p-3">
        {lbls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {lbls.map(l => <span key={l.id} className="px-2 h-5 inline-flex items-center rounded-full text-[11px] font-semibold text-white" style={{ background: l.color }}>{l.name}</span>)}
          </div>
        )}
        <div className="flex items-start gap-2">
          <div className={`min-w-0 flex-1 text-[14px] font-semibold leading-snug ${t.completed_at ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>{t.title}</div>
          {ctx.perm.edit && (
            <button type="button" aria-label="Di chuyển thẻ" title="Di chuyển (phím M)" onClick={(e) => { e.stopPropagation(); onMoveSheet(t); }}
              className="e-icon-btn w-7 h-7 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><Move className="w-3.5 h-3.5" /></button>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-2 text-[12px] text-slate-500 tabular-nums">
          {(t.priority === 'high' || t.priority === 'urgent') && <Tone meta={pr} />}
          {t.due_at && <span className={`inline-flex items-center gap-1 ${late ? 'text-danger-600 font-semibold' : ''}`}><CalendarClock className="w-3.5 h-3.5" />{fmtDateTime(t.due_at)}</span>}
          {chk && <span className={`inline-flex items-center gap-1 ${chk[0] === chk[1] ? 'text-success-600' : ''}`}><CheckSquare className="w-3.5 h-3.5" />{chk[0]}/{chk[1]}</span>}
          {atts.length > 0 && <span className="inline-flex items-center gap-1" title={`${atts.length} ảnh / link / tệp`}><Paperclip className="w-3.5 h-3.5" />{atts.length}</span>}
          {ctx.srcBy.get(t.id) > 0 && <span className="inline-flex items-center gap-1 text-teal-700" title={`${ctx.srcBy.get(t.id)} source Kho Media`}><FolderOpen className="w-3.5 h-3.5" />{ctx.srcBy.get(t.id)}</span>}
          <span className="ml-auto">{people.length ? <AvatarStack people={people} /> : <span className="text-slate-300">Chưa giao</span>}</span>
        </div>
      </div>
    </article>
  );
}

// ---------- Kanban ----------
function KanbanView({ lists, tasks, allTasks, ctx, onMove, onQuickAdd, onMoveSheet, onReload, board }) {
  const [drag, setDrag] = useState(null);       // task đang kéo
  const [drop, setDrop] = useState(null);       // { listId, afterId }
  const [adding, setAdding] = useState(null);   // listId đang nhập thẻ nhanh
  const [listMenu, setListMenu] = useState(null);
  const [delList, setDelList] = useState(null);
  const [newList, setNewList] = useState(false);

  const colTasks = (listId) => tasks.filter(t => t.list_id === listId).sort(bySort);
  const finishDrop = (e) => {
    e.preventDefault();
    const d = drop; const t = drag;
    setDrag(null); setDrop(null);
    if (!t || !d) return;
    // thả lại đúng chỗ cũ -> không gọi server
    const same = allTasks.filter(x => x.list_id === t.list_id).sort(bySort);
    const currentAfter = same[same.findIndex(x => x.id === t.id) - 1]?.id || null;
    if (d.listId === t.list_id && (d.afterId === currentAfter || d.afterId === t.id)) return;
    onMove(t, d.listId, d.afterId);
  };

  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-3">
      <div className="flex gap-3 items-start min-w-max">
        {lists.map(l => {
          const items = colTasks(l.id);
          const total = allTasks.filter(t => t.list_id === l.id).length;
          const overWip = l.wip_limit && total >= l.wip_limit;
          const isOver = drag && drop?.listId === l.id;
          return (
            <section key={l.id} aria-label={l.name}
              onDragOver={(e) => { if (!drag) return; e.preventDefault(); if (!e.target.closest('[data-task-id]')) { const last = items.filter(x => x.id !== drag.id).at(-1); if (drop?.listId !== l.id || drop?.afterId !== (last?.id || null)) setDrop({ listId: l.id, afterId: last?.id || null }); } }}
              onDrop={finishDrop}
              className={`w-[284px] shrink-0 rounded-2xl p-2.5 border transition-colors ${isOver ? 'bg-teal-50/70 border-teal-300 border-dashed' : 'bg-slate-50/80 border-slate-100'}`}>
              <header className="flex items-center gap-2 px-2 py-1.5 mb-2">
                <span className={`w-2 h-2 rounded-full ${l.is_done ? 'bg-success-500' : 'bg-teal-500'}`} />
                <h3 className="text-[13.5px] font-bold text-slate-800 truncate flex-1">{l.name}</h3>
                {(l.kho_status === 'dang_dung' || l.kho_status === 'da_dung') && <span title={`Thẻ vào cột này -> source Kho Media: ${KHO_LIST_STATUS[l.kho_status]}`}><FolderOpen className="w-3.5 h-3.5 text-teal-600" aria-label={`Cập nhật Kho: ${KHO_LIST_STATUS[l.kho_status]}`} /></span>}
                <span className={`text-[12px] tabular-nums px-1.5 rounded-full ${overWip ? 'bg-danger-50 text-danger-600 font-semibold' : 'text-slate-400'}`}
                  title={l.wip_limit ? `Giới hạn WIP ${l.wip_limit}` : undefined}>{items.length}{l.wip_limit ? `/${l.wip_limit}` : ''}</span>
                {ctx.perm.manage && <button type="button" className="e-icon-btn w-7 h-7 hover:!text-danger-600" aria-label={`Xoá cột ${l.name}`} title="Xoá cột" onClick={() => setDelList(l)}><Trash2 className="w-3.5 h-3.5" /></button>}
                {ctx.perm.manage && <button type="button" className="e-icon-btn w-7 h-7" aria-label={`Tuỳ chọn cột ${l.name}`} onClick={() => setListMenu(l)}><MoreHorizontal className="w-4 h-4" /></button>}
              </header>
              <div className="space-y-2 min-h-[24px]">
                {drop?.listId === l.id && drop.afterId === null && drag && <DropLine />}
                {items.map(t => (
                  <div key={t.id}
                    onDragOver={(e) => {
                      if (!drag || drag.id === t.id) return;
                      e.preventDefault(); e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      const top = e.clientY < r.top + r.height / 2;
                      const col = items.filter(x => x.id !== drag.id);
                      const idx = col.findIndex(x => x.id === t.id);
                      const afterId = top ? (col[idx - 1]?.id || null) : t.id;
                      if (drop?.listId !== l.id || drop?.afterId !== afterId) setDrop({ listId: l.id, afterId });
                    }}>
                    <TaskCard t={t} ctx={ctx} dragging={drag?.id === t.id} onMoveSheet={onMoveSheet}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); setDrag(t); }}
                      onDragEnd={() => { setDrag(null); setDrop(null); }} />
                    {drop?.listId === l.id && drop.afterId === t.id && drag && drag.id !== t.id && <div className="pt-2"><DropLine /></div>}
                  </div>
                ))}
              </div>
              {ctx.perm.edit && (adding === l.id ? (
                <QuickAddForm ctx={ctx} onCancel={() => setAdding(null)} onSubmit={(f) => onQuickAdd(l.id, f)} />
              ) : (
                <button type="button" onClick={() => setAdding(l.id)}
                  className="mt-2 w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[13px] text-slate-500 hover:bg-white hover:text-teal-700 transition"><Plus className="w-4 h-4" /> Thêm công việc</button>
              ))}
            </section>
          );
        })}
        {ctx.perm.manage && (
          <button type="button" onClick={() => setNewList(true)} className="w-[260px] shrink-0 rounded-2xl border border-dashed border-slate-300 p-3 text-[13.5px] text-slate-500 hover:border-teal-400 hover:text-teal-700 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Thêm cột
          </button>
        )}
      </div>
      <ListMenu list={listMenu} lists={lists} allTasks={allTasks} onClose={() => setListMenu(null)} onDone={onReload} onDelete={(l) => { setListMenu(null); setDelList(l); }} />
      <DeleteListModal list={delList} lists={lists} allTasks={allTasks} onClose={() => setDelList(null)} onDone={onReload} />
      <NewListModal open={newList} onClose={() => setNewList(false)} board={board} lists={lists} onDone={onReload} />
    </div>
  );
}
// Form thêm thẻ nhanh trong cột: tên + người thực hiện + nhãn + link + ảnh
const MAX_IMG_MB = 20;
function QuickAddForm({ ctx, onCancel, onSubmit }) {
  const [title, setTitle] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [labelIds, setLabelIds] = useState([]);
  const [links, setLinks] = useState([]);
  const [link, setLink] = useState('');
  const [images, setImages] = useState([]);
  const [sources, setSources] = useState([]);
  const [picker, setPicker] = useState(false);
  const kho = useKhoAccess();
  const [open, setOpen] = useState({ people: true, tags: false, link: false });
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => images.map(f => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);
  const addLink = () => {
    const v = link.trim();
    if (!v) return;
    if (!/^https:\/\/\S+\.\S+/.test(v)) { toast.error('Link phải bắt đầu bằng https://'); return; }
    if (!links.includes(v)) setLinks([...links, v]);
    setLink('');
  };
  const pickImages = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const ok = files.filter(f => /^image\//.test(f.type) && f.size <= MAX_IMG_MB * 1048576);
    if (ok.length < files.length) toast.error(`Chỉ nhận ảnh, tối đa ${MAX_IMG_MB} MB / ảnh`);
    setImages(v => [...v, ...ok].slice(0, 10));
  };
  const submit = async (e) => {
    e?.preventDefault();
    const v = title.trim();
    if (!v || busy) return;
    const pending = link.trim() && /^https:\/\/\S+\.\S+/.test(link.trim()) ? [...links, link.trim()] : links;
    setBusy(true);
    const ok = await onSubmit({ title: v, assignees, labelIds, links: pending, images, sources });
    setBusy(false);
    if (ok) { setTitle(''); setAssignees([]); setLabelIds([]); setLinks([]); setLink(''); setImages([]); setSources([]); }
  };
  const avail = ctx.memberPeople.filter(p => !assignees.includes(p.id));
  const toggle = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));
  return (
    <form className="mt-2 space-y-2 rounded-xl bg-white border border-teal-200 p-2" onSubmit={submit}>
      <textarea autoFocus className="e-textarea min-h-[60px]" value={title} onChange={e => setTitle(e.target.value)} placeholder="Tên công việc…" maxLength={300} aria-label="Tên công việc"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') onCancel(); }} />

      {open.people && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {assignees.map(id => (
              <span key={id} className="inline-flex items-center gap-1 h-7 pl-0.5 pr-1.5 rounded-full bg-teal-50 text-[12px] text-teal-800">
                <Avatar person={ctx.staffById.get(id)} size={22} />{ctx.staffById.get(id)?.full_name}
                <button type="button" aria-label="Bỏ người thực hiện" onClick={() => setAssignees(assignees.filter(x => x !== id))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          {avail.length > 0 ? (
            <select className="e-input h-9 text-[13px]" value="" aria-label="Thêm người thực hiện" onChange={e => { if (e.target.value) setAssignees([...assignees, e.target.value]); }}>
              <option value="">+ Người thực hiện…</option>
              {avail.map(p => <option key={p.id} value={p.id}>{p.full_name}{p.mwRole === 'editor' ? ' · Thực hiện' : p.mwRole === 'manager' ? ' · Quản lý' : ' · Chủ'}</option>)}
            </select>
          ) : !assignees.length && <p className="text-[11.5px] text-slate-400">Chưa có thành viên — thêm ở “Thành viên & cấu hình”.</p>}
        </div>
      )}
      {open.tags && (
        <div className="flex flex-wrap gap-1">
          {ctx.labels.length === 0 && <span className="text-[11.5px] text-slate-400">Chưa có nhãn — tạo ở “Thành viên & cấu hình”.</span>}
          {ctx.labels.map(lb => {
            const on = labelIds.includes(lb.id);
            return <button key={lb.id} type="button" aria-pressed={on} onClick={() => setLabelIds(on ? labelIds.filter(x => x !== lb.id) : [...labelIds, lb.id])}
              className={`px-2 h-6 rounded-full text-[11.5px] font-semibold border ${on ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'}`} style={on ? { background: lb.color } : undefined}>{lb.name}</button>;
          })}
        </div>
      )}
      {open.link && (
        <div className="space-y-1">
          {links.map(u => (
            <div key={u} className="flex items-center gap-1 text-[12px] text-teal-700"><Link2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate flex-1">{u}</span>
              <button type="button" aria-label="Bỏ link" onClick={() => setLinks(links.filter(x => x !== u))}><X className="w-3 h-3 text-slate-400" /></button></div>
          ))}
          <div className="flex gap-1">
            <input className="e-input h-9 text-[13px] flex-1" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" aria-label="Dán link"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
            <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={addLink}>Thêm</button>
          </div>
        </div>
      )}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sources.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-teal-50 text-[11.5px] text-teal-800 font-mono">
              <FolderOpen className="w-3 h-3" />{p.code || 'source'}{p.assetId ? ' · file' : ''}
              <button type="button" aria-label="Bỏ source" onClick={() => setSources(sources.filter((_, k) => k !== i))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-1">
          {previews.map((u, i) => (
            <div key={u} className="relative">
              <img src={u} alt="" className="w-full h-14 object-cover rounded-lg" />
              <button type="button" aria-label="Bỏ ảnh" onClick={() => setImages(images.filter((_, k) => k !== i))}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 grid place-items-center"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1">
        <button type="button" className={`e-icon-btn w-8 h-8 ${open.people ? '!text-teal-700 !bg-teal-50' : ''}`} title="Người thực hiện" aria-label="Người thực hiện" onClick={() => toggle('people')}><UserPlus className="w-4 h-4" /></button>
        <button type="button" className={`e-icon-btn w-8 h-8 ${open.tags ? '!text-teal-700 !bg-teal-50' : ''}`} title="Nhãn" aria-label="Nhãn" onClick={() => toggle('tags')}><Tag className="w-4 h-4" /></button>
        <button type="button" className={`e-icon-btn w-8 h-8 ${open.link ? '!text-teal-700 !bg-teal-50' : ''}`} title="Link" aria-label="Link" onClick={() => toggle('link')}><Link2 className="w-4 h-4" /></button>
        <label className="e-icon-btn w-8 h-8 cursor-pointer" title="Thêm ảnh" aria-label="Thêm ảnh"><ImagePlus className="w-4 h-4" />
          <input type="file" accept="image/*" multiple className="sr-only" onChange={pickImages} /></label>
        {kho && <button type="button" className="e-icon-btn w-8 h-8" title="Gắn source từ Kho Media" aria-label="Gắn source từ Kho Media" onClick={() => setPicker(true)}><FolderOpen className="w-4 h-4" /></button>}
      </div>
      <KhoSourcePicker open={picker} onClose={() => setPicker(false)} context={{ text: [title, ...labelIds.map(id => ctx.labelById.get(id)?.name)].join(' ') }}
        already={new Set(sources.filter(p => !p.assetId).map(p => p.customerId))}
        onPick={(picks) => setSources(prev => [...prev, ...picks.filter(p => !prev.some(x => x.customerId === p.customerId && x.assetId === p.assetId))])} />
      <div className="flex gap-2">
        <button type="submit" className="e-btn e-btn-primary e-btn-sm" disabled={!title.trim() || busy}>{busy ? 'Đang lưu…' : 'Thêm thẻ'}</button>
        <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={onCancel} disabled={busy}>Huỷ</button>
      </div>
    </form>
  );
}

const DropLine = () => <div className="h-1 rounded-full bg-teal-400 motion-safe:animate-pulse" aria-hidden="true" />;

function ListMenu({ list, lists, allTasks, onClose, onDone, onDelete }) {
  const [name, setName] = useState('');
  const [wip, setWip] = useState('');
  const [done, setDone] = useState(false);
  const [kho, setKho] = useState('none');
  useEffect(() => { if (list) { setName(list.name); setWip(list.wip_limit || ''); setDone(list.is_done); setKho(list.kho_status || 'none'); } }, [list]);
  if (!list) return null;
  const idx = lists.findIndex(l => l.id === list.id);
  const save = async () => {
    const w = wip === '' ? null : Number(wip);
    if (w != null && (!Number.isInteger(w) || w < 1 || w > 500)) { toast.error('Giới hạn WIP 1–500'); return; }
    const patch = { name: name.trim(), wip_limit: w, is_done: done };
    if ('kho_status' in list) patch.kho_status = kho;     // cột chỉ có khi đã cài v2
    if (await attempt(() => mwApi.updateList(list.id, patch), 'Đã lưu cột')) { onClose(); onDone(); }
  };
  const shift = async (dir) => {
    const other = lists[idx + dir];
    if (!other) return;
    const pos = dir < 0 ? (lists[idx - 2] ? (Number(lists[idx - 2].sort_index) + Number(other.sort_index)) / 2 : Number(other.sort_index) - 1024)
      : (lists[idx + 2] ? (Number(other.sort_index) + Number(lists[idx + 2].sort_index)) / 2 : Number(other.sort_index) + 1024);
    if (await attempt(() => mwApi.updateList(list.id, { sort_index: pos }))) { onClose(); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={`Cột “${list.name}”`} footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Đóng</button>
      <BusyButton onClick={save} disabled={!name.trim()}>Lưu</BusyButton>
    </>}>
      <Field label="Tên cột" required><input className="e-input" value={name} maxLength={80} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Giới hạn WIP" hint="Số thẻ tối đa trong cột — để trống nếu không giới hạn. Database chặn kéo thêm khi đầy."><input className="e-input" type="number" min={1} max={500} value={wip} onChange={e => setWip(e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="e-checkbox" checked={done} onChange={e => setDone(e.target.checked)} /> Cột hoàn thành (thẻ vào cột này được tính là xong)</label>
      {'kho_status' in list && (
        <Field label="Khi thẻ vào cột này, cập nhật source bên Kho Media" hint="Chỉ cập nhật tiến (Chưa dựng → Đang dựng → Đã dựng), không hạ trạng thái.">
          <select className="e-input" value={kho} onChange={e => setKho(e.target.value)} aria-label="Cập nhật Kho Media">
            {Object.entries(KHO_LIST_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <BusyButton className="e-btn e-btn-secondary e-btn-sm" disabled={idx <= 0} onClick={() => shift(-1)}><ChevronLeft /> Sang trái</BusyButton>
        <BusyButton className="e-btn e-btn-secondary e-btn-sm" disabled={idx >= lists.length - 1} onClick={() => shift(1)}>Sang phải <ChevronRight /></BusyButton>
        <button type="button" className="e-btn e-btn-danger-soft e-btn-sm ml-auto" disabled={lists.length <= 1} onClick={() => onDelete(list)}><Trash2 /> Xoá cột</button>
      </div>
    </Modal>
  );
}

// Xoá cột (chủ bảng / quản lý / Admin — DB kiểm tra quyền). Cột còn thẻ -> chuyển thẻ sang cột khác trước.
// Cột bị gỡ khỏi bảng (archived_at) chứ không xoá vật lý: thẻ đã lưu trữ + lịch sử vẫn giữ nguyên.
function DeleteListModal({ list, lists, allTasks, onClose, onDone }) {
  const others = list ? lists.filter(l => l.id !== list.id) : [];
  const [target, setTarget] = useState('');
  useEffect(() => { if (list) setTarget(lists.find(l => l.id !== list.id)?.id || ''); }, [list, lists]);
  if (!list) return null;
  const cards = allTasks.filter(t => t.list_id === list.id).sort(bySort);
  const run = async () => {
    try {
      let after = allTasks.filter(t => t.list_id === target).sort(bySort).at(-1)?.id || null;
      for (const t of cards) {                       // chuyển lần lượt, giữ thứ tự
        await mwApi.moveTask(t.id, target, after, t.version);
        after = t.id;
      }
      await mwApi.updateList(list.id, { archived_at: new Date().toISOString() });
      toast.success(cards.length ? `Đã xoá cột “${list.name}” và chuyển ${cards.length} thẻ` : `Đã xoá cột “${list.name}”`);
      onClose(); onDone();
    } catch (e) { toast.error(e.message); onDone(); }
  };
  return (
    <Modal open onClose={onClose} title={`Xoá cột “${list.name}”?`} footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton className="e-btn e-btn-danger" disabled={!others.length || (cards.length > 0 && !target)} onClick={run}><Trash2 /> Xoá cột</BusyButton>
    </>}>
      {!others.length ? <p className="text-[13.5px] text-slate-600">Bảng phải còn ít nhất 1 cột.</p>
        : cards.length ? (
          <Field label={`Cột đang có ${cards.length} thẻ — chuyển sang cột`} required>
            <select className="e-input" aria-label="Chuyển thẻ sang cột" value={target} onChange={e => setTarget(e.target.value)}>
              {others.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        ) : <p className="text-[13.5px] text-slate-600">Cột trống — xoá khỏi bảng.</p>}
    </Modal>
  );
}

function NewListModal({ open, onClose, board, lists, onDone }) {
  const [name, setName] = useState('');
  useEffect(() => { if (open) setName(''); }, [open]);
  const save = async () => {
    const pos = (lists.length ? Number(lists[lists.length - 1].sort_index) : 0) + 1024;
    if (await attempt(() => mwApi.createList(board.id, name.trim(), pos), 'Đã thêm cột')) { onClose(); onDone(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Thêm cột" footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton onClick={save} disabled={!name.trim()}>Thêm</BusyButton>
    </>}>
      <Field label="Tên cột" required><input autoFocus className="e-input" value={name} maxLength={80} onChange={e => setName(e.target.value)} /></Field>
    </Modal>
  );
}

// Tạo board: theo mẫu cột (RPC mw_create_board) hoặc TỰ ĐẶT cột.
// Tự đặt: tạo board mẫu "Trống" rồi đổi tên / thêm / ẩn cột theo danh sách người dùng nhập
// (quản lý được sửa cột qua REST — không cần thêm SQL). Cột cuối = cột hoàn thành.
export async function createBoardWith(wsId, name, tpl, cols) {
  if (tpl !== 'custom') return mwApi.createBoard(wsId, name, tpl);
  const names = cols.map(c => c.trim()).filter(Boolean);
  const id = await mwApi.createBoard(wsId, name, 'custom');
  const lists = (await mwApi.lists([id])).sort(bySort);
  for (let i = 0; i < Math.max(names.length, lists.length); i += 1) {
    const isDone = i === names.length - 1;
    if (i < names.length && lists[i]) await mwApi.updateList(lists[i].id, { name: names[i], is_done: isDone });
    else if (i < names.length) await mwApi.createList(id, names[i], (i + 1) * 1024).then(r => (isDone ? mwApi.updateList(r.id, { is_done: true }) : null));
    else await mwApi.updateList(lists[i].id, { archived_at: new Date().toISOString() });
  }
  return id;
}

// Chọn mẫu cột hoặc tự đặt cột
export function TemplatePicker({ tpl, setTpl, cols, setCols }) {
  const custom = tpl === 'custom';
  return (
    <div className="space-y-2.5">
      <span className="e-label">Cột của bảng</span>
      <div className="grid sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => setTpl('custom')} aria-pressed={custom}
          className={`text-left rounded-xl border p-3 transition sm:col-span-2 ${custom ? 'border-teal-500 bg-teal-50' : 'border-dashed border-slate-300 hover:border-teal-300'}`}>
          <div className="text-[13.5px] font-semibold text-slate-800">✏️ Tự đặt cột</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Tự gõ tên từng cột theo quy trình của team (thêm / sửa / xoá cột lúc nào cũng được)</div>
        </button>
        {BOARD_TEMPLATES.map(t => (
          <button key={t.id} type="button" onClick={() => setTpl(t.id)} aria-pressed={tpl === t.id}
            className={`text-left rounded-xl border p-3 transition ${tpl === t.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}>
            <div className="text-[13.5px] font-semibold text-slate-800">{t.label}</div>
            <div className="text-[12px] text-slate-500 mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>
      {custom && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3 space-y-2">
          {cols.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-[12px] text-slate-400 tabular-nums text-right">{i + 1}</span>
              <input className="e-input flex-1" value={c} maxLength={80} placeholder={`Tên cột ${i + 1}`} aria-label={`Tên cột ${i + 1}`}
                onChange={e => setCols(cols.map((x, k) => (k === i ? e.target.value : x)))} />
              <button type="button" className="e-icon-btn w-9 h-9" aria-label={`Xoá cột ${i + 1}`} disabled={cols.length <= 1}
                onClick={() => setCols(cols.filter((_, k) => k !== i))}><X className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button type="button" className="e-btn e-btn-secondary e-btn-sm" disabled={cols.length >= 30} onClick={() => setCols([...cols, ''])}><Plus /> Thêm cột</button>
            <span className="text-[12px] text-slate-500">Cột cuối được tính là “hoàn thành”.</span>
          </div>
        </div>
      )}
    </div>
  );
}
export const DEFAULT_CUSTOM_COLS = ['Cần làm', 'Đang làm', 'Hoàn thành'];
export const customColsOk = (tpl, cols) => tpl !== 'custom' || cols.some(c => c.trim());

export function NewBoardModal({ open, onClose, ws, onCreated }) {
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState('video');
  const [cols, setCols] = useState(DEFAULT_CUSTOM_COLS);
  useEffect(() => { if (open) { setName(''); setTpl('video'); setCols(DEFAULT_CUSTOM_COLS); } }, [open]);
  const save = async () => {
    const id = await attempt(() => createBoardWith(ws.id, name.trim(), tpl, cols), 'Đã tạo board');
    if (id) { onClose(); onCreated?.(id); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Tạo board" desc={`Trong workspace “${ws.name}”`} size="max-w-xl" footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton onClick={save} disabled={!name.trim() || !customColsOk(tpl, cols)}>Tạo board</BusyButton>
    </>}>
      <Field label="Tên board" required><input autoFocus className="e-input" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="VD: Video tháng 11" /></Field>
      <TemplatePicker tpl={tpl} setTpl={setTpl} cols={cols} setCols={setCols} />
    </Modal>
  );
}

// Hộp di chuyển thẻ (thay kéo thả trên điện thoại / bàn phím)
function MoveSheet({ task, onClose, boards, lists, tasks, onMove }) {
  const [boardId, setBoardId] = useState('');
  const [bLists, setBLists] = useState([]);
  const [bTasks, setBTasks] = useState([]);
  const [listId, setListId] = useState('');
  const [pos, setPos] = useState('bottom');
  useEffect(() => { if (task) { setBoardId(task.board_id); setListId(task.list_id); setPos('bottom'); } }, [task]);
  useEffect(() => {
    if (!task || !boardId) return;
    if (boardId === task.board_id) { setBLists(lists); setBTasks(tasks); return; }
    let alive = true;
    Promise.all([mwApi.lists([boardId]), mwApi.tasks([boardId])]).then(([ls, ts]) => {
      if (!alive) return;
      const act = ls.filter(l => !l.archived_at).sort(bySort);
      setBLists(act); setBTasks(ts); setListId(act[0]?.id || '');
    }).catch(e => toast.error(e.message));
    return () => { alive = false; };
  }, [boardId, task, lists, tasks]);
  if (!task) return null;
  const col = bTasks.filter(t => t.list_id === listId && t.id !== task.id).sort(bySort);
  return (
    <Modal open onClose={onClose} title="Di chuyển thẻ" desc={task.title} footer={<>
      <button type="button" className="e-btn e-btn-secondary" onClick={onClose}>Huỷ</button>
      <BusyButton disabled={!listId} onClick={() => onMove(listId, pos === 'top' ? null : (col.at(-1)?.id || null), boardId)}>Di chuyển</BusyButton>
    </>}>
      <Field label="Board"><select className="e-input" aria-label="Board đích" value={boardId} onChange={e => setBoardId(e.target.value)}>{boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label="Cột"><select className="e-input" aria-label="Cột đích" value={listId} onChange={e => setListId(e.target.value)}>{bLists.filter(l => !l.archived_at).map(l => <option key={l.id} value={l.id}>{l.name}{l.wip_limit ? ` (WIP ${l.wip_limit})` : ''}</option>)}</select></Field>
      <div role="group" aria-label="Vị trí">
        <span className="e-label">Vị trí</span>
        <div className="e-seg">
          <button type="button" aria-pressed={pos === 'top'} className={`e-seg-item ${pos === 'top' ? 'e-seg-active' : ''}`} onClick={() => setPos('top')}>Đầu cột</button>
          <button type="button" aria-pressed={pos === 'bottom'} className={`e-seg-item ${pos === 'bottom' ? 'e-seg-active' : ''}`} onClick={() => setPos('bottom')}>Cuối cột</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Bảng dữ liệu (S05) ----------
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function TableView({ lists, tasks, ctx, onPatch, onMove, allTasks, board }) {
  const [sort, setSort] = useState({ key: 'list', dir: 1 });
  const listById = new Map(lists.map(l => [l.id, l]));
  const rows = [...tasks].sort((a, b) => {
    const k = sort.key;
    const va = k === 'list' ? lists.findIndex(l => l.id === a.list_id) * 1e6 + Number(a.sort_index) / 1e6 : k === 'priority' ? PRIORITY[a.priority].rank : k === 'due_at' ? (a.due_at ? new Date(a.due_at).getTime() : Infinity) : (a[k] || '');
    const vb = k === 'list' ? lists.findIndex(l => l.id === b.list_id) * 1e6 + Number(b.sort_index) / 1e6 : k === 'priority' ? PRIORITY[b.priority].rank : k === 'due_at' ? (b.due_at ? new Date(b.due_at).getTime() : Infinity) : (b[k] || '');
    return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir;
  });
  const th = (key, label) => (
    <th scope="col"><button type="button" className="e-sort" onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : 1 }))}>
      {label}{sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>
  );
  const exportCsv = () => {
    const head = ['Tiêu đề', 'Cột', 'Ưu tiên', 'Người phụ trách', 'Nhãn', 'Bắt đầu', 'Hạn', 'Checklist', 'Hoàn thành lúc'];
    const lines = rows.map(t => [
      t.title, listById.get(t.list_id)?.name, PRIORITY[t.priority].label,
      (ctx.asgBy.get(t.id) || []).map(id => ctx.staffById.get(id)?.full_name).join('; '),
      (ctx.lblBy.get(t.id) || []).map(id => ctx.labelById.get(id)?.name).join('; '),
      t.start_at ? fmtDateTime(t.start_at) : '', t.due_at ? fmtDateTime(t.due_at) : '',
      ctx.chkBy.get(t.id) ? ctx.chkBy.get(t.id).join('/') : '', t.completed_at ? fmtDateTime(t.completed_at) : '',
    ].map(csvCell).join(','));
    const blob = new Blob(['﻿' + [head.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${board?.name || 'board'}-${vnToday()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  if (!rows.length) return <div className="e-card"><EmptyState title="Không có thẻ phù hợp" /></div>;
  return (
    <div className="e-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <span className="text-[12.5px] text-slate-500">{rows.length} dòng · sửa trực tiếp trong ô, đồng bộ với Bảng / Lịch</span>
        <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={exportCsv}><Download /> Xuất CSV</button>
      </div>
      <div className="e-table-wrap overflow-x-auto">
        <table className="e-table min-w-[980px]">
          <thead><tr>{th('title', 'Tiêu đề')}{th('list', 'Cột')}{th('priority', 'Ưu tiên')}<th scope="col">Phụ trách</th><th scope="col">Nhãn</th>{th('due_at', 'Hạn')}<th scope="col">Checklist</th></tr></thead>
          <tbody>
            {rows.map(t => <TableRow key={t.id} t={t} lists={lists} ctx={ctx} onPatch={onPatch} onMove={onMove} allTasks={allTasks} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function TableRow({ t, lists, ctx, onPatch, onMove, allTasks }) {
  const [title, setTitle] = useState(t.title);
  useEffect(() => { setTitle(t.title); }, [t.title]);
  const ro = !ctx.perm.edit;
  const people = (ctx.asgBy.get(t.id) || []).map(id => ctx.staffById.get(id) || { id });
  const chk = ctx.chkBy.get(t.id);
  return (
    <tr className={isLate(t, ctx.doneIds) ? 'bg-danger-50/40' : ''}>
      <td className="min-w-[260px]">
        <div className="flex items-center gap-2">
          <input className="e-input h-9 flex-1" value={title} disabled={ro} maxLength={300} aria-label="Tiêu đề"
            onChange={e => setTitle(e.target.value)}
            onBlur={() => { const v = title.trim(); if (v && v !== t.title) onPatch(t, { title: v }); else setTitle(t.title); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTitle(t.title); e.currentTarget.blur(); } }} />
          <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => ctx.openTask(t.id)}>Mở</button>
        </div>
      </td>
      <td>
        <select className="e-input h-9" value={t.list_id} disabled={ro} aria-label="Cột"
          onChange={e => { const lid = e.target.value; const last = allTasks.filter(x => x.list_id === lid && x.id !== t.id).sort(bySort).at(-1); onMove(t, lid, last?.id || null); }}>
          {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>
      <td>
        <select className="e-input h-9" value={t.priority} disabled={ro} aria-label="Ưu tiên" onChange={e => onPatch(t, { priority: e.target.value })}>
          {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </td>
      <td>{people.length ? <AvatarStack people={people} max={4} /> : <span className="text-slate-300 text-[13px]">—</span>}</td>
      <td className="max-w-[180px]">
        <div className="flex flex-wrap gap-1">{(ctx.lblBy.get(t.id) || []).map(id => ctx.labelById.get(id)).filter(Boolean).map(l => <span key={l.id} className="px-2 h-5 inline-flex items-center rounded-full text-[11px] font-semibold text-white" style={{ background: l.color }}>{l.name}</span>)}</div>
      </td>
      <td>
        <input type="datetime-local" className="e-input h-9 w-[200px]" disabled={ro} aria-label="Hạn" value={toLocalInput(t.due_at)}
          onChange={e => onPatch(t, { due_at: fromLocalInput(e.target.value) })} />
      </td>
      <td className="tabular-nums text-[13px]">{chk ? `${chk[0]}/${chk[1]}` : '—'}</td>
    </tr>
  );
}

// ---------- Lịch tháng (S06) ----------
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ymdAdd = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function CalendarView({ tasks, ctx, onPatch }) {
  const [month, setMonth] = useState(() => vnToday().slice(0, 7));
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const first = `${month}-01`;
  const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = ymdAdd(first, -dow);
  const days = Array.from({ length: 42 }, (_, i) => ymdAdd(start, i));
  const byDay = new Map();
  tasks.forEach(t => { if (!t.due_at) return; const k = vnDateOf(t.due_at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(t); });
  const noDue = tasks.filter(t => !t.due_at).length;
  const shiftMonth = (n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const today = vnToday();
  const [y, m] = month.split('-');
  const dropOn = (ymd) => {
    const t = drag; setDrag(null); setOver(null);
    if (!t || vnDateOf(t.due_at) === ymd) return;
    onPatch(t, { due_at: moveToDate(t.due_at, ymd) });
  };
  const chip = (t) => (
    <button key={t.id} type="button" draggable={ctx.perm.edit} onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); setDrag(t); }} onDragEnd={() => { setDrag(null); setOver(null); }}
      onClick={() => ctx.openTask(t.id)} title={t.title}
      className={`w-full text-left truncate rounded-md px-1.5 py-0.5 text-[11.5px] font-medium border ${t.completed_at ? 'bg-success-50 border-success-100 text-success-700 line-through' : isLate(t, ctx.doneIds) ? 'bg-danger-50 border-danger-100 text-danger-700' : 'bg-teal-50 border-teal-100 text-teal-800'}`}>
      {t.title}
    </button>
  );
  return (
    <div className="e-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button type="button" className="e-icon-btn w-9 h-9" aria-label="Tháng trước" onClick={() => shiftMonth(-1)}><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-[15px] font-bold text-slate-800 min-w-[120px] text-center">Tháng {Number(m)}/{y}</div>
        <button type="button" className="e-icon-btn w-9 h-9" aria-label="Tháng sau" onClick={() => shiftMonth(1)}><ChevronRight className="w-4 h-4" /></button>
        <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => setMonth(today.slice(0, 7))}>Hôm nay</button>
        <span className="ml-auto text-[12px] text-slate-400">{noDue ? `${noDue} thẻ chưa có hạn · ` : ''}Kéo thẻ sang ngày khác để đổi hạn (giữ nguyên giờ)</span>
      </div>
      {/* Máy tính: lưới tháng */}
      <div className="hidden sm:grid grid-cols-7 text-[12px]">
        {WEEKDAYS.map(d => <div key={d} className="px-2 py-1.5 text-slate-400 font-semibold border-b border-slate-100">{d}</div>)}
        {days.map(d => {
          const items = byDay.get(d) || [];
          const inMonth = d.startsWith(month);
          return (
            <div key={d} data-date={d} onDragOver={(e) => { if (drag) { e.preventDefault(); if (over !== d) setOver(d); } }} onDrop={(e) => { e.preventDefault(); dropOn(d); }}
              className={`min-h-[104px] p-1.5 border-b border-r border-slate-100 space-y-1 ${inMonth ? '' : 'bg-slate-50/60'} ${over === d ? 'bg-teal-50' : ''}`}>
              <div className={`text-[12px] font-semibold ${d === today ? 'inline-grid place-items-center w-6 h-6 rounded-full bg-teal-600 text-white' : inMonth ? 'text-slate-600' : 'text-slate-300'}`}>{Number(d.slice(8))}</div>
              {items.slice(0, 4).map(chip)}
              {items.length > 4 && <div className="text-[11px] text-slate-400 px-1">+{items.length - 4} thẻ</div>}
            </div>
          );
        })}
      </div>
      {/* Điện thoại: agenda theo ngày */}
      <div className="sm:hidden divide-y divide-slate-100">
        {days.filter(d => d.startsWith(month) && byDay.get(d)?.length).map(d => (
          <div key={d} className="px-4 py-3">
            <div className={`text-[12.5px] font-semibold mb-1.5 ${d === today ? 'text-teal-700' : 'text-slate-500'}`}>{fmtDate(`${d}T05:00:00Z`)}{d === today ? ' · Hôm nay' : ''}</div>
            <div className="space-y-1">{byDay.get(d).map(chip)}</div>
          </div>
        ))}
        {!days.some(d => d.startsWith(month) && byDay.get(d)?.length) && <EmptyState title="Không có hạn nào trong tháng" />}
      </div>
    </div>
  );
}

// ---------- Timeline (S07) ----------
function TimelineView({ lists, tasks, ctx }) {
  const [from, setFrom] = useState(() => { const t = vnToday(); const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7; return ymdAdd(t, -dow - 7); });
  const DAYS = 35;
  const start = new Date(`${from}T00:00:00+07:00`).getTime();
  const span = DAYS * 86400000;
  const pct = (ms) => Math.min(100, Math.max(0, ((ms - start) / span) * 100));
  const dated = tasks.filter(t => t.due_at);
  const today = vnToday();
  const todayPct = pct(new Date(`${today}T12:00:00+07:00`).getTime());
  return (
    <div className="e-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button type="button" className="e-icon-btn w-9 h-9" aria-label="Lùi 1 tuần" onClick={() => setFrom(f => ymdAdd(f, -7))}><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-[14px] font-semibold text-slate-700">{fmtDate(`${from}T05:00:00Z`)} – {fmtDate(`${ymdAdd(from, DAYS - 1)}T05:00:00Z`)}</div>
        <button type="button" className="e-icon-btn w-9 h-9" aria-label="Tới 1 tuần" onClick={() => setFrom(f => ymdAdd(f, 7))}><ChevronRight className="w-4 h-4" /></button>
        <span className="ml-auto text-[12px] text-slate-400"><Filter className="w-3.5 h-3.5 inline -mt-0.5" /> Thanh = ngày bắt đầu → hạn · {tasks.length - dated.length} thẻ chưa có hạn không hiện</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[200px_1fr] border-b border-slate-100 text-[11px] text-slate-400">
            <div className="px-3 py-1.5">Cột / thẻ</div>
            <div className="relative h-7">
              {Array.from({ length: DAYS / 7 }, (_, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-slate-100 pl-1 pt-1.5" style={{ left: `${(i * 7 / DAYS) * 100}%` }}>{fmtDate(`${ymdAdd(from, i * 7)}T05:00:00Z`)}</div>
              ))}
            </div>
          </div>
          {lists.map(l => {
            const items = dated.filter(t => t.list_id === l.id).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
            if (!items.length) return null;
            return (
              <div key={l.id}>
                <div className="px-3 py-1.5 text-[12px] font-bold text-slate-600 bg-slate-50/80 border-b border-slate-100">{l.name}</div>
                {items.map(t => {
                  const end = new Date(t.due_at).getTime();
                  const s = t.start_at ? new Date(t.start_at).getTime() : end - 86400000;
                  const left = pct(s); const right = pct(end);
                  const outside = end < start || s > start + span;
                  return (
                    <div key={t.id} className="grid grid-cols-[200px_1fr] border-b border-slate-50 items-center">
                      <button type="button" onClick={() => ctx.openTask(t.id)} className="px-3 py-2 text-left text-[12.5px] text-slate-700 truncate hover:text-teal-700">{t.title}</button>
                      <div className="relative h-9">
                        <div className="absolute top-0 bottom-0 w-px bg-amber-400/70" style={{ left: `${todayPct}%` }} aria-hidden="true" />
                        {!outside && (
                          <button type="button" onClick={() => ctx.openTask(t.id)} title={`${t.title} · hạn ${fmtDateTime(t.due_at)}`}
                            className={`absolute top-2 h-5 rounded-md text-[10.5px] text-white px-1.5 truncate ${t.completed_at ? 'bg-success-500' : isLate(t, ctx.doneIds) ? 'bg-danger-500' : 'bg-teal-600'}`}
                            style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}>{t.title}</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!dated.length && <EmptyState title="Chưa có thẻ nào có hạn" description="Đặt hạn cho thẻ để thấy trên Timeline." />}
        </div>
      </div>
    </div>
  );
}

function ArchivedList({ tasks, lists, perm, onRestore, openTask }) {
  if (!tasks.length) return <div className="e-card"><EmptyState icon={Archive} title="Không có thẻ lưu trữ" /></div>;
  const name = new Map(lists.map(l => [l.id, l.name]));
  return (
    <div className="e-card divide-y divide-slate-100">
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-3">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openTask(t.id)}>
            <div className="text-[14px] font-semibold text-slate-700 truncate">{t.title}</div>
            <div className="text-[12px] text-slate-400">{name.get(t.list_id)} · lưu trữ {fmtDateTime(t.archived_at)}</div>
          </button>
          {perm.edit && <BusyButton className="e-btn e-btn-secondary e-btn-sm" onClick={() => onRestore(t)}><RotateCcw /> Khôi phục</BusyButton>}
        </div>
      ))}
    </div>
  );
}
