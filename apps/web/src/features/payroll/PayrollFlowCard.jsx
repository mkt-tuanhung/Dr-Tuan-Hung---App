// ============================================================
// THẺ QUY TRÌNH DUYỆT LƯƠNG (Ethics D08 "pay-flow"):
//   thanh 7 bước -> tổng thực nhận + nút thao tác của bước hiện tại
// và THẺ LỊCH SỬ PHÊ DUYỆT (Ethics "Lịch sử phê duyệt").
// ============================================================
import React, { useState } from 'react';
import { Check, Lock, ShieldCheck, Save, Undo2, ImageDown, Wallet, History } from 'lucide-react';
import { ConfirmDialog, EmptyState } from '@/components/ds';
import {
  PAY_STEPS, PAY_STATUS_LABEL, PAY_TRANSITIONS, PAY_REOPEN,
  nextStatus, isEditableStatus, isLockedStatus, blockReason, hasRole,
} from './workflow';

const fmtM = (n) => (Number(n) ? new Intl.NumberFormat('vi-VN').format(Math.round(n)) : '0') + 'đ';
const fmtDT = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export function PayrollStepper({ status }) {
  const idx = PAY_STEPS.indexOf(status);
  return (
    <ol className="e-steps" aria-label="Quy trình duyệt lương">
      {PAY_STEPS.map((s, i) => {
        const state = i < idx || status === 'paid' ? 'done' : i === idx ? 'current' : 'todo';
        return (
          <li key={s} className={`e-step e-step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="e-step-dot">{state === 'done' ? <Check /> : i + 1}</span>
            <span>{PAY_STATUS_LABEL[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function PayrollFlowCard({
  period, history, profile, periodLabel, totalNet, staffCount, totalCommission,
  busy, loading, onSave, onTransition, onExportImage, exportLabel,
}) {
  const [dialog, setDialog] = useState(null); // { to }
  const status = period?.status || 'draft';
  const next = nextStatus(status);
  const t = next && PAY_TRANSITIONS[next];
  const nextBlock = next ? blockReason(next, profile, history) : null;
  const canReopen = status !== 'draft' && status !== 'paid' && hasRole(profile, PAY_REOPEN.roles);
  const editable = isEditableStatus(status);
  const dlg = dialog && (dialog.to === 'draft' ? PAY_REOPEN : PAY_TRANSITIONS[dialog.to]);

  return (
    <div className="e-card px-5 py-[18px] flex flex-col gap-3.5">
      <PayrollStepper status={status} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <div className="flex items-center gap-3.5 flex-wrap text-[13px] text-slate-500 min-w-0">
          <span className="e-metric-icon w-11 h-11 lg:w-11 lg:h-11 hidden sm:grid"><Wallet className="!w-5 !h-5" /></span>
          <span>Tổng thực nhận · {periodLabel}
            <b className="ml-1.5 text-[24px] lg:text-[26px] font-bold text-teal-800 tabular-nums align-middle">{fmtM(totalNet)}</b>
          </span>
          <span>{staffCount} nhân sự · hoa hồng {fmtM(totalCommission)}</span>
          {editable
            ? <span className="e-badge e-badge-sm e-tone-info">Tạm tính · {PAY_STATUS_LABEL[status]}</span>
            : isLockedStatus(status)
              ? <span className="e-badge e-badge-sm e-tone-brand"><Lock />{PAY_STATUS_LABEL[status]}{period?.locked_at ? ` ${fmtDT(period.locked_at).split(' ').pop()}` : ''}</span>
              : <span className="e-badge e-badge-sm e-tone-warning">Đang duyệt · số liệu đã khoá sửa</span>}
        </div>
        <div className="flex gap-2 flex-wrap ml-auto justify-end">
          <button onClick={onExportImage} disabled={loading} className="e-btn e-btn-secondary"><ImageDown /> {exportLabel}</button>
          {canReopen && (
            <button onClick={() => setDialog({ to: 'draft' })} disabled={busy || loading} className="e-btn e-btn-secondary"><Undo2 /> {PAY_REOPEN.label}</button>
          )}
          {editable && (
            <button onClick={onSave} disabled={busy || loading || !hasRole(profile, ['accountant', 'admin'])} className="e-btn e-btn-outline"><Save /> Lưu nháp</button>
          )}
          {t && (
            <button onClick={() => setDialog({ to: next })} disabled={busy || loading || !!nextBlock} title={nextBlock || undefined} className="e-btn e-btn-primary">
              {next === 'locked' ? <Lock /> : <ShieldCheck />} {t.label}
            </button>
          )}
        </div>
      </div>
      {t && nextBlock && !loading && <div className="text-[12.5px] text-slate-400 -mt-1.5 text-right">{nextBlock}</div>}

      <ConfirmDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        busy={busy}
        danger={dialog?.to === 'draft'}
        title={dialog ? (dialog.to === 'draft' ? `Trả bảng lương ${periodLabel} về nháp?` : `${dlg.label}?`) : ''}
        description={dialog && (dialog.to === 'draft'
          ? 'Bảng lương quay lại bước Nháp để sửa số liệu và phải duyệt lại từ đầu. Lý do được ghi vào lịch sử phê duyệt.'
          : `Chuyển ${periodLabel} từ "${PAY_STATUS_LABEL[status]}" sang "${PAY_STATUS_LABEL[dialog.to]}".${isEditableStatus(dialog.to) ? '' : ' Sau bước này số liệu không sửa được nữa.'}${['hr_review', 'manager_review'].includes(dialog.to) ? ' Bảng lương hiện tại sẽ được lưu trước khi chuyển.' : ''}`)}
        confirmLabel={dialog?.to === 'draft' ? 'Trả về nháp' : 'Xác nhận'}
        requireReason={!!dlg?.note}
        reasonLabel={dialog?.to === 'draft' ? 'Lý do trả về' : 'Ghi chú'}
        reasonPlaceholder={dialog?.to === 'paid' ? 'VD: Đã chuyển khoản ngày 15/10' : dialog?.to === 'locked' ? 'VD: Đã duyệt lương tháng' : 'VD: Sửa lại hoa hồng'}
        onConfirm={async (note) => { const ok = await onTransition(dialog.to, note); if (ok) setDialog(null); }}
      />
    </div>
  );
}

export function PayrollHistoryCard({ history }) {
  return (
    <div className="e-card e-card-pad">
      <h3 className="e-card-title mb-3 flex items-center gap-2"><History className="w-5 h-5 text-teal-600" /> Lịch sử phê duyệt</h3>
      {history.length === 0 ? <EmptyState title="Chưa có bước duyệt nào" description="Bắt đầu bằng nút “Gửi HR kiểm tra”." icon={ShieldCheck} /> : (
        <div className="divide-y divide-slate-100">
          {history.slice().reverse().map(h => (
            <div key={h.id} className="flex items-start gap-3 py-2.5">
              <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${h.to_status === 'draft' ? 'bg-warning-50 text-warning-600' : 'bg-teal-50 text-teal-700'}`}>
                {h.to_status === 'draft' ? <Undo2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-slate-800">
                  {h.from_status ? `${PAY_STATUS_LABEL[h.from_status] || h.from_status} → ` : ''}{PAY_STATUS_LABEL[h.to_status] || h.to_status}
                </div>
                <div className="text-[12px] text-slate-500">
                  {[h.actor?.full_name, fmtDT(h.created_at), h.total_net != null ? `tổng ${fmtM(h.total_net)}` : null].filter(Boolean).join(' · ')}
                </div>
                {h.note && <div className="text-[12.5px] text-slate-600 mt-0.5">“{h.note}”</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
