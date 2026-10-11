// ============================================================
// NGĂN CHI TIẾT CÔNG VIỆC (Ethics D10 TaskDrawer)
// - Thông tin: người phụ trách / người tạo / hạn / ưu tiên / lặp lại / khách liên quan
// - Nút đổi trạng thái (Huỷ việc bắt nhập lý do -> ghi vào bình luận)
// - Dòng thời gian: bình luận + các lần đổi trạng thái (dòng hệ thống do trigger ghi)
// task_comments CHỈ GHI THÊM: không có nút sửa / xoá bình luận.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Send, Repeat, CalendarClock, MessageSquare, History, XCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Drawer, ConfirmDialog, EmptyState } from '@/components/ds';
import { Customer360Button } from '@/features/crm/Customer360.jsx';
import {
  TASK_STATUS, TASK_PRIORITY, RECURRENCE, STATUS_ORDER,
  isOverdue, fmtDT, fmtDue, dueHint, timeAgo, initials,
} from './taskMeta';

const Kv = ({ label, children }) => (
  <div className="min-w-0"><div className="e-kv-label">{label}</div><div className="e-kv-value break-words">{children || '—'}</div></div>
);

export default function TaskDrawer({
  task, peopleById, meId, isAdmin, onClose, onEdit, onStatus, onDeleted, onCommented,
}) {
  const [comments, setComments] = useState(null);  // null = đang tải
  const [loadErr, setLoadErr] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const taskId = task?.id;
  const status = task?.status;

  const loadComments = useCallback(async () => {
    if (!taskId) return;
    setLoadErr(null);
    const { data, error } = await supabase.from('task_comments')
      .select('id, author_id, kind, body, from_status, to_status, created_at')
      .eq('task_id', taskId).order('created_at', { ascending: true }).limit(300);
    if (error) { setLoadErr(error); setComments([]); return; }
    setComments(data || []);
  }, [taskId]);

  useEffect(() => { setComments(null); setText(''); }, [taskId]);
  // Mở việc khác hoặc trạng thái đổi (kể cả kéo thả trên Kanban) -> tải lại dòng thời gian
  useEffect(() => { loadComments(); }, [loadComments, status]);

  if (!task) return <Drawer open={false} onClose={onClose} />;

  const st = TASK_STATUS[task.status] || TASK_STATUS.todo;
  const pr = TASK_PRIORITY[task.priority] || TASK_PRIORITY.normal;
  const assignee = peopleById[task.assignee_id];
  const creator = peopleById[task.created_by];
  const late = isOverdue(task);
  const canDelete = (task.created_by === meId || isAdmin) && ['todo', 'cancelled'].includes(task.status);
  const name = (id) => (id === meId ? 'Bạn' : peopleById[id]?.full_name || 'Hệ thống');

  const changeStatus = async (to, reason) => {
    setBusy(true);
    const ok = await onStatus(task, to, reason);
    setBusy(false);
    if (ok) setAskCancel(false);
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('task_comments')
      .insert({ task_id: task.id, author_id: meId, kind: 'comment', body })
      .select('id, author_id, kind, body, from_status, to_status, created_at').single();
    setSending(false);
    if (error) { toast.error(`Không gửi được bình luận: ${error.message}`); return; }
    setText('');
    setComments(list => [...(list || []), data]);
    onCommented?.(task.id);
  };

  const remove = async () => {
    setBusy(true);
    const { data, error } = await supabase.from('tasks').delete().eq('id', task.id).select('id');
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data?.length) { toast.error('Không xoá được — chỉ người tạo hoặc Admin xoá được việc "Cần làm" / "Đã huỷ".'); return; }
    toast.success('Đã xoá công việc');
    setAskDelete(false);
    onDeleted(task.id);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={task.title}
      description={`Tạo bởi ${name(task.created_by)} · ${timeAgo(task.created_at)}`}
      footer={<>
        {canDelete && (
          <button onClick={() => setAskDelete(true)} className="e-btn e-btn-danger-soft mr-auto" disabled={busy}><Trash2 /> Xoá</button>
        )}
        <button onClick={() => onEdit(task)} className="e-btn e-btn-secondary" disabled={busy}><Pencil /> Sửa</button>
        {task.status !== 'done' && task.status !== 'cancelled' && (
          <button onClick={() => changeStatus('done')} className="e-btn e-btn-primary" disabled={busy}>
            <TASK_STATUS.done.icon /> Hoàn thành
          </button>
        )}
      </>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`e-badge ${late ? 'e-tone-danger' : st.tone}`}><st.icon /> {late ? 'Quá hạn' : st.label}</span>
          <span className={`e-badge ${pr.tone}`}>Ưu tiên: {pr.label}</span>
          {task.recurrence && <span className="e-badge e-tone-brand"><Repeat /> {RECURRENCE[task.recurrence]}</span>}
        </div>

        {/* Đổi trạng thái nhanh */}
        <div>
          <div className="e-caption flex mb-2">Trạng thái</div>
          <div className="e-seg flex-wrap" role="group" aria-label="Đổi trạng thái">
            {STATUS_ORDER.map(s => {
              const m = TASK_STATUS[s];
              const active = task.status === s;
              return (
                <button key={s} type="button" disabled={busy || active}
                  onClick={() => (s === 'cancelled' ? setAskCancel(true) : changeStatus(s))}
                  aria-pressed={active}
                  className={`e-seg-item ${active ? 'e-seg-active' : ''} disabled:cursor-default`}>
                  <m.icon /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="e-subtle px-4 py-3 grid grid-cols-2 gap-y-3 gap-x-4">
          <Kv label="Người phụ trách">
            {assignee ? (
              <span className="inline-flex items-center gap-2">
                <span className="e-avatar w-6 h-6 text-[10px]">{initials(assignee.full_name)}</span>
                {assignee.full_name}{task.assignee_id === meId ? ' (tôi)' : ''}
              </span>
            ) : 'Chưa giao'}
          </Kv>
          <Kv label="Người tạo">{creator?.full_name}</Kv>
          <Kv label="Hạn hoàn thành">
            {task.due_at ? (
              <span className={late ? 'text-danger-600' : ''}>
                <CalendarClock className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{fmtDue(task.due_at)}
                {dueHint(task) && <span className="block text-[12px] font-medium">{dueHint(task)}</span>}
              </span>
            ) : 'Không có hạn'}
          </Kv>
          <Kv label={task.status === 'done' ? 'Hoàn thành lúc' : 'Cập nhật'}>{fmtDT(task.status === 'done' ? task.completed_at : task.updated_at)}</Kv>
          {task.related_phone && (
            <div className="col-span-2 flex items-center justify-between gap-3 pt-1">
              <Kv label="Khách liên quan"><span className="tabular-nums">{task.related_phone}</span></Kv>
              <Customer360Button phone={task.related_phone} />
            </div>
          )}
        </div>

        {task.description && (
          <div>
            <div className="e-caption flex mb-2">Mô tả</div>
            <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        <div>
          <div className="e-caption flex mb-3">Hoạt động & bình luận</div>
          {comments === null ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : loadErr ? (
            <div className="text-[13px] text-danger-600">Không tải được bình luận: {loadErr.message}</div>
          ) : comments.length === 0 ? (
            <EmptyState title="Chưa có hoạt động" icon={History} />
          ) : (
            <ol className="relative ml-3 border-l-[1.5px] border-slate-200 space-y-3.5 py-1">
              {comments.map(c => {
                const sys = c.kind === 'status';
                const to = TASK_STATUS[c.to_status];
                return (
                  <li key={c.id} className="relative pl-5">
                    <span className={`absolute -left-[11px] top-0.5 w-5 h-5 rounded-full grid place-items-center ring-4 ring-white
                      ${sys ? `${to?.tone || 'e-tone-neutral'}` : 'bg-teal-600 text-white'}`} aria-hidden>
                      {sys ? (to ? <to.icon className="w-3 h-3" /> : <History className="w-3 h-3" />) : <MessageSquare className="w-3 h-3" />}
                    </span>
                    {sys ? (
                      <div className="text-[13px] text-slate-600">
                        <b className="font-semibold text-slate-800">{name(c.author_id)}</b>{' '}
                        {c.from_status && TASK_STATUS[c.from_status] && to ? (
                          <>chuyển <span className="font-medium">{TASK_STATUS[c.from_status].label}</span> <ArrowRight className="w-3 h-3 inline text-slate-400" /> <span className="font-medium">{to.label}</span></>
                        ) : c.body}
                        <span className="text-[11.5px] text-slate-400 ml-1.5">{timeAgo(c.created_at)}</span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[12.5px]">
                          <b className="font-semibold text-slate-800">{name(c.author_id)}</b>
                          <span className="text-slate-400 ml-1.5" title={fmtDT(c.created_at)}>{timeAgo(c.created_at)}</span>
                        </div>
                        <div className="mt-1 text-[14px] text-slate-700 whitespace-pre-wrap break-words rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">{c.body}</div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <form onSubmit={send} className="mt-4 space-y-2">
            <textarea className="e-textarea min-h-[72px]" value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e); }}
              placeholder="Viết bình luận… (Ctrl/⌘ + Enter để gửi)" aria-label="Bình luận" maxLength={4000} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-slate-400">Bình luận không sửa / xoá được sau khi gửi.</span>
              <button type="submit" className="e-btn e-btn-primary e-btn-sm" disabled={!text.trim() || sending}>
                <Send /> {sending ? 'Đang gửi…' : 'Gửi'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={askCancel}
        onClose={() => setAskCancel(false)}
        onConfirm={(reason) => changeStatus('cancelled', reason)}
        title="Huỷ công việc này?"
        description="Lý do huỷ sẽ được ghi vào dòng thời gian của công việc."
        confirmLabel="Huỷ công việc"
        cancelLabel="Đóng"
        danger
        requireReason
        reasonLabel="Lý do huỷ"
        busy={busy}
      >
        <div className="flex items-center gap-2 text-[13px] text-slate-600"><XCircle className="w-4 h-4 text-rose-500" /> {task.title}</div>
      </ConfirmDialog>

      <ConfirmDialog
        open={askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={remove}
        title="Xoá hẳn công việc?"
        description="Công việc và toàn bộ bình luận sẽ bị xoá, không khôi phục được. Nếu chỉ muốn dừng, hãy chọn Đã huỷ."
        confirmLabel="Xoá"
        danger
        busy={busy}
      />
    </Drawer>
  );
}
