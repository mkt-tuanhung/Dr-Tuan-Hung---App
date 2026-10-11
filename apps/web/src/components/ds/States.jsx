// Trạng thái trống / lỗi / không có quyền (Ethics ds/components/States.tsx)
import React from 'react';
import { Inbox, AlertTriangle, Lock, RotateCw } from 'lucide-react';

export function EmptyState({ title = 'Không có dữ liệu', description, action, icon: Icon = Inbox }) {
  return (
    <div className="e-empty">
      <div className="e-empty-icon"><Icon /></div>
      <div className="e-empty-title">{title}</div>
      {description && <div className="e-empty-desc">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Không tải được dữ liệu', description = 'Kiểm tra kết nối mạng rồi thử lại.', onRetry }) {
  return (
    <div className="e-empty" role="alert">
      <div className="e-empty-icon !bg-danger-50 !text-danger-600"><AlertTriangle /></div>
      <div className="e-empty-title">{title}</div>
      {description && <div className="e-empty-desc">{description}</div>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="e-btn e-btn-secondary e-btn-sm mt-4"><RotateCw /> Thử lại</button>
      )}
    </div>
  );
}

export function PermissionDenied({ title = 'Bạn không có quyền xem mục này', description = 'Liên hệ Admin nếu bạn cần được cấp quyền.' }) {
  return (
    <div className="e-empty">
      <div className="e-empty-icon !bg-slate-100 !text-slate-500"><Lock /></div>
      <div className="e-empty-title">{title}</div>
      {description && <div className="e-empty-desc">{description}</div>}
    </div>
  );
}
