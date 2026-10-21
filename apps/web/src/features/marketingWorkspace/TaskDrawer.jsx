// ============================================================
// MARKETING WORKSPACE — NGĂN KÉO CHI TIẾT THẺ (S04)
// Tự tải thẻ + board + thành viên + nhãn theo id (mở được từ deep link / thông báo).
// Sửa trường: kiểm tra phiên bản (version) -> người khác vừa sửa thì báo xung đột + tải lại, không ghi đè.
// Bình luận chỉ @nhắc NHÂN SỰ là thành viên workspace (tắt tra cứu khách hàng).
// Đính kèm: kiểm tra loại / dung lượng, tính sha256, tải lên R2 có % tiến độ thật.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Archive, RotateCcw, Copy, Trash2, Paperclip, Link2, Send, Pencil, Check, X, Eye, EyeOff, Plus, CalendarClock, History,
} from 'lucide-react';
import { Drawer, ErrorState, EmptyState } from '@/components/ds';
import MentionInput, { MENTION_RE } from '@/components/MentionInput';
import { uploadViaPresignWithProgress } from '@/lib/r2Client';
import { mwApi, sha256OfFile } from './mwApi';
import {
  PRIORITY, LABEL_COLORS, bySort, fmtDateTime, timeAgo, toLocalInput, fromLocalInput, fmtBytes, describeActivity,
  MAX_UPLOAD_MB, ALLOWED_MIME, wsPerm,
} from './mwMeta';
import { Avatar, Field, Skeleton, Spinner, attempt, BusyButton, Sel } from './mwUi';

const TABS = [
  { id: 'desc', label: 'Mô tả' },
  { id: 'check', label: 'Checklist' },
  { id: 'files', label: 'Đính kèm' },
  { id: 'comments', label: 'Bình luận' },
  { id: 'history', label: 'Lịch sử' },
];

// Hiện @[Tên](staff:id) thành chữ đậm
function CommentBody({ body }) {
  const parts = [];
  let last = 0;
  body.replace(MENTION_RE, (m, name, _t, _id, idx) => {
    if (idx > last) parts.push(body.slice(last, idx));
    parts.push(<b key={idx} className="text-teal-700">@{name}</b>);
    last = idx + m.length;
    return m;
  });
  if (last < body.length) parts.push(body.slice(last));
  return <p className="text-[13.5px] text-slate-700 whitespace-pre-wrap break-words">{parts}</p>;
}

export default function TaskDrawer({ taskId, onClose, profile, workspaces, myRoles, staffById, onChanged }) {
  const [st, setSt] = useState({ loading: true, error: null });
  const [tab, setTab] = useState('desc');
  const { task, board, ws, lists, members, labels, assignees, watchers, taskLabels, checks, comments, files, activity } = st;
  const perm = useMemo(() => wsPerm(profile, ws, myRoles.get(ws?.id)), [profile, ws, myRoles]);

  const load = useCallback(async () => {
    try {
      const t = await mwApi.task(taskId);
      if (!t) { setSt({ loading: false, error: { message: 'Không tìm thấy thẻ hoặc bạn không có quyền xem.' } }); return; }
      const b = await mwApi.board(t.board_id);
      const w = workspaces.find(x => x.id === b?.workspace_id) || (b ? await mwApi.workspace(b.workspace_id) : null);
      const [ls, mem, lbs, asg, wat, tl, ck, cm, fl, ac] = await Promise.all([
        mwApi.lists([t.board_id]), mwApi.members(b.workspace_id), mwApi.labels([b.workspace_id]), mwApi.assignees([t.id]),
        mwApi.watchers(t.id), mwApi.taskLabels([t.id]), mwApi.checklist([t.id]), mwApi.comments(t.id), mwApi.attachments(t.id), mwApi.activity(t.id),
      ]);
      setSt({ loading: false, error: null, task: t, board: b, ws: w, lists: ls.filter(l => !l.archived_at || l.id === t.list_id).sort(bySort), members: mem, labels: lbs,
        assignees: asg.map(a => a.user_id), watchers: wat.map(a => a.user_id), taskLabels: tl.map(a => a.label_id), checks: ck, comments: cm, files: fl, activity: ac });
    } catch (e) { setSt({ loading: false, error: e }); }
  }, [taskId, workspaces]);
  useEffect(() => { setSt({ loading: true, error: null }); setTab('desc'); load(); }, [load]);

  const changed = () => { onChanged?.(); };
  // Sửa trường thẻ (có kiểm tra phiên bản)
  const patch = async (p) => {
    try {
      const fresh = await mwApi.updateTask(task.id, p, task.version);
      setSt(s => ({ ...s, task: fresh }));
      changed();
      mwApi.activity(task.id).then(ac => setSt(s => ({ ...s, activity: ac }))).catch(() => {});
      return true;
    } catch (e) {
      toast.error(e.message);
      if (e.conflict) load();
      return false;
    }
  };
  const move = async (listId) => {
    const col = (await mwApi.tasks([task.board_id])).filter(x => x.list_id === listId && x.id !== task.id).sort(bySort);
    const r = await attempt(() => mwApi.moveTask(task.id, listId, col.at(-1)?.id || null, task.version), 'Đã chuyển cột');
    if (r) { load(); changed(); }
  };
  const refresh = async (what) => {
    const t = task.id;
    const map = {
      assignees: async () => ({ assignees: (await mwApi.assignees([t])).map(a => a.user_id) }),
      watchers: async () => ({ watchers: (await mwApi.watchers(t)).map(a => a.user_id) }),
      labels: async () => ({ taskLabels: (await mwApi.taskLabels([t])).map(a => a.label_id) }),
      checks: async () => ({ checks: await mwApi.checklist([t]) }),
      comments: async () => ({ comments: await mwApi.comments(t) }),
      files: async () => ({ files: await mwApi.attachments(t) }),
    };
    try {
      const [part, ac] = await Promise.all([map[what](), mwApi.activity(t)]);
      setSt(s => ({ ...s, ...part, activity: ac }));
    } catch (e) { toast.error(e.message); }
    changed();
  };

  const memberIds = useMemo(() => {
    const s = new Set((members || []).map(m => m.user_id));
    if (ws?.owner_id) s.add(ws.owner_id);
    return [...s];
  }, [members, ws]);
  const memberStaff = memberIds.map(id => staffById.get(id)).filter(Boolean);
  const nameOf = (id) => staffById.get(id)?.full_name || 'Không rõ';

  return (
    <Drawer open onClose={onClose} size="lg" zClass="z-[60]"
      title={task ? <span className="flex items-center gap-2">{task.cover_color && <span className="w-3 h-3 rounded-full" style={{ background: task.cover_color }} />}{board?.name || 'Thẻ'}</span> : 'Thẻ công việc'}
      description={ws ? `${ws.name}${task?.archived_at ? ' · ĐÃ LƯU TRỮ' : ''}` : undefined}>
      {st.loading ? <Skeleton rows={6} />
        : st.error ? <ErrorState title="Không mở được thẻ" description={st.error.message} onRetry={load} />
          : (
            <div className="space-y-4">
              <TitleEditor task={task} disabled={!perm.edit} onSave={(v) => patch({ title: v })} />

              {/* Thuộc tính */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Cột">
                  <select className="e-input" value={task.list_id} disabled={!perm.edit || !!task.archived_at} onChange={e => move(e.target.value)}>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name}{l.is_done ? ' ✓' : ''}</option>)}
                  </select>
                </Field>
                <Field label="Ưu tiên">
                  <select className="e-input" value={task.priority} disabled={!perm.edit} onChange={e => patch({ priority: e.target.value })}>
                    {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <Field label="Bắt đầu">
                  <input type="datetime-local" className="e-input" disabled={!perm.edit} value={toLocalInput(task.start_at)} onChange={e => patch({ start_at: fromLocalInput(e.target.value) })} />
                </Field>
                <Field label="Hạn">
                  <input type="datetime-local" className="e-input" disabled={!perm.edit} value={toLocalInput(task.due_at)} onChange={e => patch({ due_at: fromLocalInput(e.target.value) })} />
                </Field>
                <Field label="Ước lượng (giờ)">
                  <NumberField value={task.estimate_hours} disabled={!perm.edit} onSave={(v) => patch({ estimate_hours: v })} />
                </Field>
                <div role="group" aria-label="Màu bìa">
                  <span className="e-label">Màu bìa</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button type="button" disabled={!perm.edit} onClick={() => patch({ cover_color: null })} aria-label="Không màu" aria-pressed={!task.cover_color}
                      className={`w-7 h-7 rounded-full border-2 bg-white ${!task.cover_color ? 'border-teal-500' : 'border-slate-200'}`}><X className="w-3.5 h-3.5 mx-auto text-slate-400" /></button>
                    {LABEL_COLORS.map(c => (
                      <button key={c} type="button" disabled={!perm.edit} onClick={() => patch({ cover_color: c })} aria-label={`Màu ${c}`} aria-pressed={task.cover_color === c}
                        className={`w-7 h-7 rounded-full border-2 ${task.cover_color === c ? 'border-slate-800' : 'border-white'}`} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>

              <PeoplePicker label="Phụ trách" ids={assignees} options={memberStaff} disabled={!perm.edit} nameOf={nameOf}
                onAdd={async (id) => { if (await attempt(() => mwApi.addAssignee(task.id, id))) refresh('assignees'); }}
                onRemove={async (id) => { if (await attempt(() => mwApi.removeAssignee(task.id, id))) refresh('assignees'); }} />
              <div className="flex flex-wrap items-center gap-2">
                <PeoplePicker label="Theo dõi" ids={watchers} options={memberStaff} disabled={!perm.edit} nameOf={nameOf} inline
                  onAdd={async (id) => { if (await attempt(() => mwApi.addWatcher(task.id, id))) refresh('watchers'); }}
                  onRemove={async (id) => { if (await attempt(() => mwApi.removeWatcher(task.id, id))) refresh('watchers'); }} />
                {perm.view && (watchers.includes(profile.id)
                  ? <BusyButton className="e-btn e-btn-ghost e-btn-sm" onClick={async () => { if (await attempt(() => mwApi.removeWatcher(task.id, profile.id))) refresh('watchers'); }}><EyeOff /> Bỏ theo dõi</BusyButton>
                  : <BusyButton className="e-btn e-btn-ghost e-btn-sm" onClick={async () => { if (await attempt(() => mwApi.addWatcher(task.id, profile.id))) refresh('watchers'); }}><Eye /> Theo dõi</BusyButton>)}
              </div>

              <div>
                <span className="e-label">Nhãn</span>
                <div className="flex flex-wrap gap-1.5">
                  {labels.length === 0 && <span className="text-[12.5px] text-slate-400">Workspace chưa có nhãn (tạo ở mục Cấu hình).</span>}
                  {labels.map(l => {
                    const on = taskLabels.includes(l.id);
                    return (
                      <button key={l.id} type="button" disabled={!perm.edit} aria-pressed={on}
                        onClick={async () => { if (await attempt(() => (on ? mwApi.removeTaskLabel(task.id, l.id) : mwApi.addTaskLabel(task.id, l.id)))) refresh('labels'); }}
                        className={`px-2.5 h-7 rounded-full text-[12px] font-semibold border transition ${on ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'}`}
                        style={on ? { background: l.color } : undefined}>{on && <Check className="w-3 h-3 inline -mt-0.5 mr-0.5" />}{l.name}</button>
                    );
                  })}
                </div>
              </div>

              {/* Tab */}
              <div className="e-tabs" role="tablist">
                {TABS.map(t => (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`e-tab ${tab === t.id ? 'e-tab-active' : ''}`}>
                    {t.label}
                    {t.id === 'check' && checks.length > 0 && <span className="e-tab-count">{checks.filter(c => c.done).length}/{checks.length}</span>}
                    {t.id === 'files' && files.length > 0 && <span className="e-tab-count">{files.length}</span>}
                    {t.id === 'comments' && comments.filter(c => !c.deleted_at).length > 0 && <span className="e-tab-count">{comments.filter(c => !c.deleted_at).length}</span>}
                  </button>
                ))}
              </div>
              {tab === 'desc' && <DescEditor task={task} disabled={!perm.edit} onSave={(v) => patch({ description: v })} />}
              {tab === 'check' && <Checklist task={task} checks={checks} disabled={!perm.edit} members={memberStaff} staffById={staffById} onDone={() => refresh('checks')} />}
              {tab === 'files' && <Attachments task={task} files={files} perm={perm} profile={profile} staffById={staffById} onDone={() => refresh('files')} />}
              {tab === 'comments' && <Comments task={task} comments={comments} perm={perm} profile={profile} staffById={staffById} members={memberStaff} onDone={() => refresh('comments')} />}
              {tab === 'history' && (
                <ol className="space-y-2.5">
                  {activity.length === 0 && <EmptyState icon={History} title="Chưa có lịch sử" />}
                  {activity.map(a => (
                    <li key={a.id} className="flex gap-2.5 text-[13px]">
                      <Avatar person={staffById.get(a.actor_id)} size={24} />
                      <div className="min-w-0"><b className="text-slate-800">{nameOf(a.actor_id)}</b> <span className="text-slate-600">{describeActivity(a, nameOf)}</span>
                        <div className="text-[11.5px] text-slate-400">{fmtDateTime(a.created_at)}</div></div>
                    </li>
                  ))}
                </ol>
              )}

              {/* Thao tác */}
              {perm.edit && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                  <BusyButton className="e-btn e-btn-secondary e-btn-sm" onClick={async () => { const id = await attempt(() => mwApi.copyTask(task.id), 'Đã sao chép thẻ (không mang người phụ trách / bình luận)'); if (id) changed(); }}><Copy /> Sao chép</BusyButton>
                  {task.archived_at
                    ? <BusyButton className="e-btn e-btn-secondary e-btn-sm" onClick={() => patch({ archived_at: null })}><RotateCcw /> Khôi phục</BusyButton>
                    : <BusyButton className="e-btn e-btn-danger-soft e-btn-sm" onClick={async () => { if (await patch({ archived_at: new Date().toISOString() })) toast.success('Đã lưu trữ thẻ — xem lại ở bộ lọc “Đã lưu trữ”'); }}><Archive /> Lưu trữ</BusyButton>}
                  <span className="ml-auto text-[11.5px] text-slate-400 self-center">Tạo {timeAgo(task.created_at)} bởi {nameOf(task.created_by)} · phiên bản {task.version}</span>
                </div>
              )}
            </div>
          )}
    </Drawer>
  );
}

function TitleEditor({ task, disabled, onSave }) {
  const [v, setV] = useState(task.title);
  useEffect(() => { setV(task.title); }, [task.title]);
  return (
    <textarea className="w-full text-[19px] font-bold text-slate-900 leading-snug resize-none rounded-xl px-2 py-1 -mx-2 border border-transparent hover:border-slate-200 focus:border-teal-400 focus:outline-none bg-transparent"
      rows={2} value={v} maxLength={300} disabled={disabled} aria-label="Tiêu đề thẻ"
      onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      onBlur={() => { const t = v.trim(); if (t && t !== task.title) onSave(t); else setV(task.title); }} />
  );
}

function NumberField({ value, disabled, onSave }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <input type="number" min={0} max={10000} step="0.5" className="e-input" value={v} disabled={disabled}
      onChange={e => setV(e.target.value)}
      onBlur={() => { const n = v === '' ? null : Number(v); if (n !== (value == null ? null : Number(value)) && (n == null || (n >= 0 && n <= 10000))) onSave(n); }} />
  );
}

function DescEditor({ task, disabled, onSave }) {
  const [v, setV] = useState(task.description || '');
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setV(task.description || ''); setDirty(false); }, [task.description]);
  return (
    <div className="space-y-2">
      <textarea className="e-textarea min-h-[160px]" value={v} disabled={disabled} maxLength={20000} placeholder="Mô tả, brief, link tham khảo…"
        onChange={e => { setV(e.target.value); setDirty(true); }} />
      {dirty && !disabled && (
        <div className="flex gap-2">
          <BusyButton className="e-btn e-btn-primary e-btn-sm" onClick={async () => { if (await onSave(v)) setDirty(false); }}>Lưu mô tả</BusyButton>
          <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => { setV(task.description || ''); setDirty(false); }}>Huỷ</button>
        </div>
      )}
      <p className="text-[12px] text-slate-400">Không ghi tên / SĐT / bệnh án của khách hàng vào thẻ Marketing.</p>
    </div>
  );
}

function PeoplePicker({ label, ids, options, disabled, onAdd, onRemove, nameOf, inline }) {
  const [pick, setPick] = useState('');
  const avail = options.filter(p => !ids.includes(p.id));
  return (
    <div className={inline ? 'flex flex-wrap items-center gap-2' : ''}>
      <span className={inline ? 'text-[13px] font-semibold text-slate-600' : 'e-label'}>{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {ids.length === 0 && <span className="text-[12.5px] text-slate-400">Chưa có</span>}
        {ids.map(id => (
          <span key={id} className="inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full bg-slate-100 text-[12.5px] font-medium text-slate-700">
            <Avatar person={{ id, full_name: nameOf(id) }} size={24} />{nameOf(id)}
            {!disabled && <button type="button" onClick={() => onRemove(id)} aria-label={`Bỏ ${nameOf(id)}`} className="text-slate-400 hover:text-danger-600"><X className="w-3.5 h-3.5" /></button>}
          </span>
        ))}
        {!disabled && avail.length > 0 && (
          <Sel wrapClass="!min-w-[130px]" className="!h-8 !text-[13px]" value={pick} aria-label={`Thêm ${label.toLowerCase()}`}
            onChange={async e => { const v = e.target.value; setPick(''); if (v) await onAdd(v); }}>
            <option value="">+ Thêm</option>
            {avail.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Sel>
        )}
      </div>
    </div>
  );
}

function Checklist({ task, checks, disabled, members, staffById, onDone }) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const done = checks.filter(c => c.done).length;
  const add = async (e) => {
    e.preventDefault();
    const v = title.trim();
    if (!v) return;
    if (await attempt(() => mwApi.addCheck(task.id, v, { assignee_id: assignee || null, due_at: fromLocalInput(due) }))) { setTitle(''); setDue(''); setAssignee(''); onDone(); }
  };
  return (
    <div className="space-y-3">
      {checks.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-teal-500 transition-all" style={{ width: `${(done / checks.length) * 100}%` }} /></div>
          <span className="text-[12px] text-slate-500 tabular-nums">{Math.round((done / checks.length) * 100)}%</span>
        </div>
      )}
      <ul className="space-y-1.5">
        {checks.map(c => (
          <li key={c.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50">
            <input type="checkbox" className="e-checkbox mt-0.5" checked={c.done} disabled={disabled} aria-label={c.title}
              onChange={async () => { if (await attempt(() => mwApi.updateCheck(c.id, { done: !c.done }))) onDone(); }} />
            <div className="min-w-0 flex-1">
              <div className={`text-[13.5px] ${c.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{c.title}</div>
              <div className="text-[11.5px] text-slate-400 flex flex-wrap gap-x-2">
                {c.assignee_id && <span>@{staffById.get(c.assignee_id)?.full_name || 'Không rõ'}</span>}
                {c.due_at && <span className={!c.done && new Date(c.due_at) < new Date() ? 'text-danger-600 font-semibold' : ''}><CalendarClock className="w-3 h-3 inline -mt-0.5" /> {fmtDateTime(c.due_at)}</span>}
                {c.done && c.done_by && <span>✓ {staffById.get(c.done_by)?.full_name} · {fmtDateTime(c.done_at)}</span>}
              </div>
            </div>
            {!disabled && <button type="button" className="e-icon-btn w-7 h-7" aria-label={`Xoá ${c.title}`} onClick={async () => { if (await attempt(() => mwApi.deleteCheck(c.id))) onDone(); }}><Trash2 className="w-3.5 h-3.5" /></button>}
          </li>
        ))}
      </ul>
      {checks.length === 0 && <p className="text-[13px] text-slate-400">Chưa có mục nào.</p>}
      {!disabled && (
        <form onSubmit={add} className="grid sm:grid-cols-[1fr_150px_180px_auto] gap-2">
          <input className="e-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Thêm mục…" maxLength={300} aria-label="Mục checklist mới" />
          <select className="e-input" value={assignee} onChange={e => setAssignee(e.target.value)} aria-label="Người phụ trách mục">
            <option value="">Không giao</option>
            {members.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <input type="datetime-local" className="e-input" value={due} onChange={e => setDue(e.target.value)} aria-label="Hạn mục" />
          <button type="submit" className="e-btn e-btn-primary" disabled={!title.trim()}><Plus /> Thêm</button>
        </form>
      )}
    </div>
  );
}

function Attachments({ task, files, perm, profile, staffById, onDone }) {
  const [progress, setProgress] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ url: '', name: '' });
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1048576) { toast.error(`Tệp tối đa ${MAX_UPLOAD_MB} MB`); return; }
    if (!ALLOWED_MIME.test(file.type || '')) { toast.error('Loại tệp không được phép (chỉ ảnh, video, âm thanh, PDF, văn bản, Office)'); return; }
    setProgress(0);
    try {
      const sha = await sha256OfFile(file);
      const url = await uploadViaPresignWithProgress(file, 'mw-attachments', setProgress);
      await mwApi.addAttachment(task.id, { url, name: file.name.slice(0, 300), mime: file.type || null, size_bytes: file.size, sha256: sha });
      toast.success('Đã đính kèm');
      onDone();
    } catch (err) { toast.error(err.message); }
    setProgress(null);
  };
  const addLink = async () => {
    const url = link.url.trim();
    if (!/^https:\/\/\S+\.\S+/.test(url)) { toast.error('Link phải bắt đầu bằng https://'); return; }
    if (await attempt(() => mwApi.addAttachment(task.id, { url, name: (link.name.trim() || url).slice(0, 300) }), 'Đã thêm link')) { setLinkOpen(false); setLink({ url: '', name: '' }); onDone(); }
  };
  return (
    <div className="space-y-3">
      {perm.edit && (
        <div className="flex flex-wrap gap-2">
          <label className={`e-btn e-btn-secondary e-btn-sm cursor-pointer ${progress != null ? 'pointer-events-none opacity-60' : ''}`}>
            <Paperclip /> Tải tệp lên<input type="file" className="sr-only" onChange={upload} disabled={progress != null} />
          </label>
          <button type="button" className="e-btn e-btn-secondary e-btn-sm" onClick={() => setLinkOpen(v => !v)}><Link2 /> Thêm link</button>
        </div>
      )}
      {progress != null && (
        <div className="flex items-center gap-2 text-[12.5px] text-slate-500" role="status">
          <Spinner /> Đang tải lên {progress}%
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-teal-500" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {linkOpen && (
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input className="e-input" placeholder="https://drive.google.com/…" value={link.url} onChange={e => setLink(l => ({ ...l, url: e.target.value }))} aria-label="Link" />
          <input className="e-input" placeholder="Tên hiển thị" value={link.name} onChange={e => setLink(l => ({ ...l, name: e.target.value }))} aria-label="Tên link" />
          <BusyButton onClick={addLink}>Thêm</BusyButton>
        </div>
      )}
      {files.length === 0 && <p className="text-[13px] text-slate-400">Chưa có tệp.</p>}
      <ul className="space-y-1.5">
        {files.map(f => (
          <li key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100">
            {/^image\//.test(f.mime || '') ? <img src={f.url} alt="" className="w-11 h-11 rounded-lg object-cover bg-slate-100" loading="lazy" /> : <span className="w-11 h-11 rounded-lg bg-slate-100 grid place-items-center text-slate-400"><Paperclip className="w-4 h-4" /></span>}
            <div className="min-w-0 flex-1">
              <a href={f.url} target="_blank" rel="noreferrer noopener" className="text-[13.5px] font-semibold text-teal-700 hover:underline truncate block">{f.name}</a>
              <div className="text-[11.5px] text-slate-400 truncate">{[fmtBytes(f.size_bytes), staffById.get(f.uploaded_by)?.full_name, fmtDateTime(f.created_at), f.sha256 && `sha256 ${f.sha256.slice(0, 12)}…`].filter(Boolean).join(' · ')}</div>
            </div>
            {(perm.manage || (perm.edit && f.uploaded_by === profile.id)) && (
              <button type="button" className="e-icon-btn w-8 h-8" aria-label={`Gỡ ${f.name}`} onClick={async () => { if (await attempt(() => mwApi.deleteAttachment(f.id), 'Đã gỡ tệp')) onDone(); }}><Trash2 className="w-4 h-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Comments({ task, comments, perm, profile, staffById, members, onDone }) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const send = async () => {
    const v = text.trim();
    if (!v) return;
    if (await attempt(() => mwApi.addComment(task.id, v.slice(0, 5000)))) { setText(''); onDone(); }
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {comments.length === 0 && <li className="text-[13px] text-slate-400">Chưa có bình luận.</li>}
        {comments.map(c => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar person={staffById.get(c.author_id)} size={30} />
            <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-[12px] text-slate-400">
                <b className="text-[13px] text-slate-800">{staffById.get(c.author_id)?.full_name || 'Không rõ'}</b>{timeAgo(c.created_at)}{c.edited_at && ' · đã sửa'}
                {c.author_id === profile.id && !c.deleted_at && perm.edit && editing !== c.id && (
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="e-icon-btn w-7 h-7" aria-label="Sửa bình luận" onClick={() => { setEditing(c.id); setEditText(c.body); }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button" className="e-icon-btn w-7 h-7" aria-label="Xoá bình luận" onClick={async () => { if (await attempt(() => mwApi.deleteComment(c.id))) onDone(); }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </span>
                )}
              </div>
              {c.deleted_at ? <p className="text-[13px] italic text-slate-400">Bình luận đã xoá</p>
                : editing === c.id ? (
                  <div className="mt-1 space-y-2">
                    <textarea className="e-textarea min-h-[70px]" value={editText} onChange={e => setEditText(e.target.value)} maxLength={5000} />
                    <div className="flex gap-2">
                      <BusyButton className="e-btn e-btn-primary e-btn-sm" disabled={!editText.trim()} onClick={async () => { if (await attempt(() => mwApi.editComment(c.id, editText.trim()))) { setEditing(null); onDone(); } }}>Lưu</BusyButton>
                      <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={() => setEditing(null)}>Huỷ</button>
                    </div>
                  </div>
                ) : <CommentBody body={c.body} />}
            </div>
          </li>
        ))}
      </ul>
      {perm.edit && (
        <div className="flex items-center gap-2">
          <MentionInput value={text} onChange={setText} onEnter={send} staff={members} allowCustomer={false}
            placeholder="Bình luận… gõ @ để nhắc thành viên" className="e-input w-full" />
          <button type="button" className="e-btn e-btn-primary" onClick={send} disabled={!text.trim()} aria-label="Gửi bình luận"><Send /></button>
        </div>
      )}
    </div>
  );
}
