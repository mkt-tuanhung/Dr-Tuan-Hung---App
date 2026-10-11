// Dải cảnh báo (Ethics .alert-strip) — VD: "2 hợp đồng sắp hết hạn trong 30 ngày … Xem"
import React from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

const ALERT_ICON = { warning: AlertTriangle, danger: XCircle, info: Info, success: CheckCircle2 };

export default function AlertStrip({ tone = 'warning', children, action, onAction }) {
  const Icon = ALERT_ICON[tone] || Info;
  return (
    <div className={`e-alert e-alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <button type="button" className="e-alert-action" onClick={onAction}>{action}</button>}
    </div>
  );
}
