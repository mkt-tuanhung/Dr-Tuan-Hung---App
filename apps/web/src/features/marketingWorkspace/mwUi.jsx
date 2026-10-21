// ============================================================
// MARKETING WORKSPACE — thành phần giao diện nhỏ dùng chung trong module.
// Dùng lớp e-* sẵn có (styles/ethics-ui.css); không thêm CSS toàn cục.
// ============================================================
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { initials } from './mwMeta';

export function Modal({ open, onClose, title, desc, children, footer, size = 'max-w-lg', busy = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-4">
      <div className="e-modal-backdrop" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" aria-label={title} className={`e-modal ${size} max-h-[calc(100vh-24px)] flex flex-col animate-page`}>
        <div className="e-modal-header">
          <div className="min-w-0">
            <div className="e-modal-title">{title}</div>
            {desc && <div className="text-[13px] text-slate-500 mt-1">{desc}</div>}
          </div>
          <button type="button" className="e-icon-btn w-9 h-9 shrink-0" onClick={onClose} disabled={busy} aria-label="Đóng"><X className="w-4 h-4" /></button>
        </div>
        <div className="e-modal-body overflow-y-auto space-y-3.5">{children}</div>
        {footer && <div className="e-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="e-label">{label}{required && <span className="text-danger-500"> *</span>}</span>
      {children}
      {hint && <span className="block text-[12px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Avatar({ person, size = 28 }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (person?.avatar_url) return <img src={person.avatar_url} alt="" title={person.full_name} style={style} className="rounded-full object-cover shrink-0 ring-2 ring-white" />;
  return <span className="e-avatar ring-2 ring-white" style={style} title={person?.full_name || 'Không rõ'}>{initials(person?.full_name)}</span>;
}

export function AvatarStack({ people, max = 3, size = 24 }) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((p, i) => <Avatar key={p?.id || i} person={p} size={size} />)}
      {people.length > max && <span className="e-avatar ring-2 ring-white bg-slate-100 text-slate-500" style={{ width: size, height: size, fontSize: 10 }}>+{people.length - max}</span>}
    </span>
  );
}

// Ô chọn kiểu bộ lọc (lớp e-filter-select là KHUNG bọc select + mũi tên)
export function Sel({ className = '', wrapClass = '', children, ...rest }) {
  return (
    <label className={`e-filter-select ${wrapClass}`}>
      <select className={className} {...rest}>{children}</select>
      <ChevronDown aria-hidden="true" />
    </label>
  );
}

export const Tone = ({ meta, children }) => <span className={`e-badge e-badge-sm ${meta?.tone || 'e-tone-neutral'}`}>{children || meta?.label}</span>;

export function Spinner({ className = 'w-4 h-4' }) { return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />; }

export function Skeleton({ rows = 4 }) {
  return <div className="space-y-2.5" aria-busy="true">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>;
}

// Chạy 1 thao tác ghi: thành công -> kết quả (RPC trả null/void -> true); lỗi -> null + toast
// (lỗi đã được mwError dịch sang tiếng Việt)
export async function attempt(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast.success(okMsg);
    return r ?? true;
  } catch (e) {
    toast.error(e?.message || 'Có lỗi xảy ra');
    return null;
  }
}

// Nút có trạng thái đang chạy (chống bấm 2 lần)
export function BusyButton({ onClick, children, className = 'e-btn e-btn-primary', disabled, title, type = 'button' }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type={type} className={className} disabled={disabled || busy} title={title}
      onClick={async (e) => { if (!onClick) return; setBusy(true); try { await onClick(e); } finally { setBusy(false); } }}>
      {busy && <Spinner />}{children}
    </button>
  );
}

// Chip chọn nhiều (nền tảng, ...)
export function ChipToggle({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(options).map(([k, label]) => {
        const on = value.includes(k);
        return (
          <button key={k} type="button" disabled={disabled} aria-pressed={on}
            onClick={() => onChange(on ? value.filter(x => x !== k) : [...value, k])}
            className={`e-chip ${on ? 'e-chip-active' : ''}`}>{label}</button>
        );
      })}
    </div>
  );
}
