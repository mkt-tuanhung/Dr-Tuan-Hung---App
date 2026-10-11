// ============================================================
// BẢNG KANBAN CÔNG VIỆC (Ethics ds/components/Kanban.tsx)
// Kéo thả HTML5 giữa các cột Cần làm / Đang làm / Chờ duyệt / Hoàn thành.
// Thả thẻ -> gọi onMove(task, status); trang cha cập nhật lạc quan + hoàn tác khi lỗi.
// Màn nhỏ: các cột cuộn ngang. Điện thoại không kéo được -> bấm thẻ để đổi trạng thái.
// ============================================================
import React, { useState } from 'react';
import { CalendarClock, Repeat, MessageSquare, Sparkles } from 'lucide-react';
import { TASK_STATUS, TASK_PRIORITY, BOARD_COLUMNS, isOverdue, fmtDue, dueHint, initials } from './taskMeta';

function TaskCard({ t, person, onOpen, dragging, draggable, onDragStart, onDragEnd }) {
  const late = isOverdue(t);
  const pr = TASK_PRIORITY[t.priority] || TASK_PRIORITY.normal;
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(t)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t); }}
      tabIndex={0}
      aria-label={t.title}
      className={`rounded-2xl bg-white border shadow-soft p-3.5 cursor-pointer hover:shadow-card hover:border-teal-200 transition outline-none focus-visible:ring-2 focus-visible:ring-teal-300
        ${late ? 'border-danger-200' : 'border-slate-200/80'} ${dragging ? 'opacity-40' : ''} ${draggable ? 'active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className={`min-w-0 flex-1 text-[14px] font-semibold leading-snug ${t.status === 'done' ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>
          {t.title}
          {t.recurrence && <Repeat className="w-3.5 h-3.5 inline ml-1.5 -mt-0.5 text-teal-600" aria-label="Định kỳ" />}
        </div>
        {(t.priority === 'urgent' || t.priority === 'high') && <span className={`e-badge e-badge-sm ${pr.tone}`}>{pr.label}</span>}
      </div>
      {t.description && <p className="text-[12.5px] text-slate-500 mt-1 line-clamp-2">{t.description}</p>}
      <div className="flex items-center gap-2 mt-3">
        <span className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold shrink-0 overflow-hidden ${person?.avatar_url ? '' : 'bg-teal-50 text-teal-700'}`}
          title={person?.full_name || 'Chưa giao'}>
          {person?.avatar_url ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" /> : person ? initials(person.full_name) : '?'}
        </span>
        <span className="text-[12px] text-slate-500 truncate flex-1 min-w-0">{person?.full_name || 'Chưa giao'}</span>
        {t.related_phone && <Sparkles className="w-3.5 h-3.5 text-teal-500 shrink-0" aria-label="Có khách liên quan" />}
        {t.comment_count > 0 && <span className="inline-flex items-center gap-0.5 text-[11.5px] text-slate-400 shrink-0"><MessageSquare className="w-3.5 h-3.5" />{t.comment_count}</span>}
      </div>
      {t.due_at && (
        <div className={`mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] tabular-nums ${late ? 'text-danger-600 font-semibold' : 'text-slate-500'}`}>
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><CalendarClock className="w-3.5 h-3.5" /> {fmtDue(t.due_at)}</span>
          {dueHint(t) && <span className={`whitespace-nowrap ${late ? '' : 'text-slate-400'}`}>· {dueHint(t)}</span>}
        </div>
      )}
    </article>
  );
}

export default function TaskKanban({ tasks, peopleById, onOpen, onMove, canDrag = () => true }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);

  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max lg:min-w-0">
        {BOARD_COLUMNS.map(col => {
          const meta = TASK_STATUS[col];
          const items = tasks.filter(t => t.status === col);
          const isOver = over === col && dragId;
          return (
            <section
              key={col}
              aria-label={meta.label}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== col) setOver(col); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(o => (o === col ? null : o)); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId || e.dataTransfer.getData('text/plain');
                const t = tasks.find(x => String(x.id) === String(id));
                setOver(null); setDragId(null);
                if (t && t.status !== col) onMove(t, col);
              }}
              className={`w-[280px] lg:w-auto lg:flex-1 lg:min-w-0 shrink-0 rounded-2xl p-2.5 border transition
                ${isOver ? 'bg-teal-50/70 border-teal-300 border-dashed' : 'bg-slate-50/80 border-slate-100'}`}
            >
              <header className="flex items-center justify-between gap-2 px-2.5 py-2 mb-2 rounded-xl bg-white border border-slate-200/80">
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden />{meta.label}
                </span>
                <span className="text-[12px] font-semibold text-slate-400 tabular-nums">{items.length}</span>
              </header>
              <div className="space-y-2 min-h-[120px]">
                {items.length === 0 ? (
                  <div className="h-[100px] rounded-xl border-[1.5px] border-dashed border-slate-200 grid place-items-center text-[12.5px] text-slate-400 text-center px-3">
                    {dragId ? 'Thả vào đây' : 'Chưa có việc'}
                  </div>
                ) : items.map(t => {
                  const can = canDrag(t);
                  return (
                    <TaskCard
                      key={t.id}
                      t={t}
                      person={peopleById[t.assignee_id]}
                      onOpen={onOpen}
                      draggable={can}
                      dragging={dragId === t.id}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(t.id)); setDragId(t.id); }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
