// ============================================================
// NGĂN KÉO CHI TIẾT + HỘP XÁC NHẬN (Ethics ds/components/Overlay.tsx)
// - Drawer: trượt từ phải, Esc / bấm nền để đóng, khoá cuộn trang
// - ConfirmDialog: requireReason=true bắt nhập lý do (thao tác nhạy cảm phải
//   có lý do để ghi nhật ký — quy tắc AUDITABLE của Ethics)
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';

function useEscClose(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
}

export function Drawer({ open, onClose, title, description, size = 'md', footer, children, zClass = 'z-50' }) {
  const panelRef = useRef(null);
  useEscClose(open, onClose);
  useEffect(() => { if (open) panelRef.current?.focus(); }, [open]);
  if (!open) return null;
  return createPortal(
    <div className={`fixed inset-0 ${zClass}`}>
      <div className="e-modal-backdrop" onClick={onClose} />
      <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className={`e-drawer outline-none ${size === 'lg' ? 'e-drawer-lg' : ''}`}>
        <div className="e-drawer-header">
          <div className="min-w-0">
            {title && <div className="e-drawer-title">{title}</div>}
            {description && <div className="e-drawer-desc">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
        </div>
        <div className="e-drawer-body">{children}</div>
        {footer && <div className="e-drawer-footer">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Xác nhận', cancelLabel = 'Huỷ', danger = false,
  requireReason = false, reasonLabel = 'Lý do', reasonPlaceholder = 'Nhập lý do…', minReason = 5,
  busy = false, children,
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  useEscClose(open, () => !busy && onClose());
  if (!open) return null;
  const tooShort = requireReason && reason.trim().length < minReason;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="e-modal-backdrop" onClick={() => !busy && onClose()} />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="e-modal max-w-md animate-page">
        <div className="e-modal-header border-b-0 pb-1">
          <div className="flex items-start gap-3">
            {danger && <span className="w-10 h-10 rounded-full bg-danger-50 text-danger-600 grid place-items-center shrink-0"><AlertTriangle className="w-5 h-5" /></span>}
            <div>
              <div className="e-modal-title">{title}</div>
              {description && <div className="text-[13.5px] text-slate-500 mt-1 leading-relaxed">{description}</div>}
            </div>
          </div>
        </div>
        <div className="e-modal-body pt-2">
          {children}
          {requireReason && (
            <label className="block mt-2">
              <span className="e-label">{reasonLabel} <span className="text-danger-500">*</span></span>
              <textarea className="e-textarea min-h-[84px]" value={reason} onChange={e => setReason(e.target.value)} placeholder={reasonPlaceholder} autoFocus />
              {reason && tooShort && <span className="text-[12px] text-danger-600 mt-1 block">Lý do cần ít nhất {minReason} ký tự</span>}
            </label>
          )}
        </div>
        <div className="e-modal-footer">
          <button type="button" className="e-btn e-btn-secondary" onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`e-btn ${danger ? 'e-btn-danger' : 'e-btn-primary'}`} disabled={busy || tooShort}
            onClick={() => onConfirm(reason.trim())}>
            {busy ? 'Đang xử lý…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
