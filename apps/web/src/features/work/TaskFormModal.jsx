// ============================================================
// HỘP TẠO / SỬA CÔNG VIỆC (Ethics D10 CreateTaskModal)
// Tên · mô tả · người phụ trách · hạn (ngày + giờ) · ưu tiên · lặp lại · SĐT khách
// Khi sửa: chỉ người tạo hoặc Admin được giao lại cho người khác
// (RLS chặn người phụ trách "giao đi rồi mất dấu").
// ============================================================
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Repeat } from 'lucide-react';
import { TASK_PRIORITY, RECURRENCE, splitLocal, joinLocal } from './taskMeta';

const blank = (meId) => ({
  title: '', description: '', assignee_id: meId || '', date: '', time: '17:00',
  priority: 'normal', recurrence: '', related_phone: '',
});

export default function TaskFormModal({ open, task, people, meId, canReassign = true, busy, onClose, onSubmit }) {
  const [form, setForm] = useState(blank(meId));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (task) {
      const { date, time } = splitLocal(task.due_at);
      setForm({
        title: task.title || '', description: task.description || '', assignee_id: task.assignee_id || '',
        date, time: time || '17:00', priority: task.priority || 'normal', recurrence: task.recurrence || '',
        related_phone: task.related_phone || '',
      });
    } else setForm(blank(meId));
  }, [open, task, meId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const phone = form.related_phone.replace(/[^\d+]/g, '');
  const errors = {
    title: !form.title.trim() ? 'Nhập tên công việc' : form.title.trim().length > 200 ? 'Tối đa 200 ký tự' : null,
    phone: phone && phone.replace(/\D/g, '').length < 9 ? 'Số điện thoại chưa đúng' : null,
    recurrence: form.recurrence && !form.date ? 'Việc lặp lại cần có hạn để tính lần tiếp theo' : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    onSubmit({
      title: form.title.trim(),
      description: form.description.trim() || null,
      assignee_id: form.assignee_id || null,
      due_at: joinLocal(form.date, form.time),
      priority: form.priority,
      recurrence: form.recurrence || null,
      related_phone: phone || null,
    });
  };

  // Người phụ trách hiện tại có thể đã nghỉ việc -> vẫn hiện trong danh sách
  const options = people.filter(p => p.is_active !== false || p.id === form.assignee_id);

  return createPortal(
    <div className="fixed inset-0 z-[55] grid place-items-center p-3 sm:p-4">
      <div className="e-modal-backdrop" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={task ? 'Sửa công việc' : 'Tạo công việc'}
        className="e-modal max-w-2xl max-h-[calc(100vh-24px)] flex flex-col animate-page">
        <div className="e-modal-header">
          <div>
            <div className="e-modal-title">{task ? 'Sửa công việc' : 'Tạo công việc'}</div>
            <div className="text-[13px] text-slate-500 mt-0.5">Người phụ trách sẽ thấy việc này trong mục "Của tôi".</div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
        </div>

        <div className="e-modal-body overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
          <label className="sm:col-span-2 block">
            <span className="e-label">Tên công việc <span className="text-danger-500">*</span></span>
            <input className="e-input" value={form.title} onChange={set('title')} autoFocus maxLength={220}
              placeholder="VD: Gọi lại khách hỏi lịch tái khám" />
            {touched && errors.title && <span className="text-[12px] text-danger-600 mt-1 block">{errors.title}</span>}
          </label>

          <label className="sm:col-span-2 block">
            <span className="e-label">Mô tả</span>
            <textarea className="e-textarea min-h-[88px]" value={form.description} onChange={set('description')}
              placeholder="Chi tiết cần làm, ghi chú cho người phụ trách…" />
          </label>

          <label className="block">
            <span className="e-label">Người phụ trách</span>
            <select className="e-input" value={form.assignee_id} onChange={set('assignee_id')} disabled={!canReassign}>
              <option value="">— Chưa giao —</option>
              {options.map(p => (
                <option key={p.id} value={p.id}>{p.full_name || 'Không tên'}{p.id === meId ? ' (tôi)' : ''}{p.is_active === false ? ' · đã khoá' : ''}</option>
              ))}
            </select>
            {!canReassign && <span className="text-[11.5px] text-slate-400 mt-1 block">Chỉ người tạo hoặc Admin được giao lại việc này.</span>}
          </label>

          <label className="block">
            <span className="e-label">Độ ưu tiên</span>
            <select className="e-input" value={form.priority} onChange={set('priority')}>
              {Object.entries(TASK_PRIORITY).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </label>

          <div className="block">
            <span className="e-label">Hạn hoàn thành</span>
            <div className="flex gap-2">
              <input type="date" className="e-input flex-1 min-w-0" value={form.date} onChange={set('date')} aria-label="Ngày hết hạn" />
              <input type="time" className="e-input !w-[116px]" value={form.time} onChange={set('time')} disabled={!form.date} aria-label="Giờ hết hạn" />
            </div>
            {form.date && (
              <button type="button" onClick={() => setForm(f => ({ ...f, date: '' }))} className="text-[12px] text-slate-400 hover:text-danger-600 mt-1">Bỏ hạn</button>
            )}
          </div>

          <label className="block">
            <span className="e-label inline-flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Lặp lại</span>
            <select className="e-input" value={form.recurrence} onChange={set('recurrence')}>
              <option value="">Không lặp</option>
              {Object.entries(RECURRENCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {touched && errors.recurrence
              ? <span className="text-[12px] text-danger-600 mt-1 block">{errors.recurrence}</span>
              : form.recurrence && <span className="text-[11.5px] text-slate-400 mt-1 block">Khi hoàn thành, hệ thống tự tạo lần tiếp theo.</span>}
          </label>

          <label className="sm:col-span-2 block">
            <span className="e-label">SĐT khách liên quan (không bắt buộc)</span>
            <input className="e-input tabular-nums" inputMode="tel" value={form.related_phone} onChange={set('related_phone')} placeholder="VD: 0912345678" />
            {touched && errors.phone && <span className="text-[12px] text-danger-600 mt-1 block">{errors.phone}</span>}
          </label>
        </div>

        <div className="e-modal-footer">
          <button type="button" className="e-btn e-btn-secondary" onClick={onClose} disabled={busy}>Huỷ</button>
          <button type="submit" className="e-btn e-btn-primary" disabled={busy}>
            {busy ? 'Đang lưu…' : task ? 'Lưu thay đổi' : 'Tạo công việc'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
