// ============================================================
// NGĂN CHI TIẾT NHÂN SỰ (Ethics D05 EmployeeDrawer)
// Tab: Thông tin · Hợp đồng · Công & phép · Lịch sử
// - Công & phép: chấm công tháng này + 10 đơn gần nhất
// - Lịch sử: audit_log của hồ sơ + các bản ghi gắn với nhân sự (cần audit_log.sql, chỉ Admin đọc được)
// ============================================================
import React, { useEffect, useState } from 'react';
import { Pencil, Lock, LockOpen, ChevronRight, UserRound, FileSignature, CalendarCheck, History } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { vnToday } from '@/lib/vnTime';
import { Drawer, EmptyState } from '@/components/ds';

export const CONTRACT_TYPES = [
  { value: 'probation', label: 'Thử việc' },
  { value: 'fixed_term', label: 'Xác định thời hạn' },
  { value: 'indefinite', label: 'Không xác định thời hạn' },
  { value: 'seasonal', label: 'Thời vụ / CTV' },
];
export const GENDERS = [{ value: 'female', label: 'Nữ' }, { value: 'male', label: 'Nam' }, { value: 'other', label: 'Khác' }];
const label = (list, v) => list.find(x => x.value === v)?.label || '—';

// Số ngày tới hạn (âm = đã quá hạn), null nếu không có ngày
export const daysUntil = (d) => {
  if (!d) return null;
  const a = new Date(`${vnToday()}T00:00:00`); const b = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  return Math.round((b - a) / 86400000);
};

const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDT = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const avInit = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

const ATT_LABEL = { present: 'Có mặt', late: 'Đi muộn', early_leave: 'Về sớm', half_day: 'Nửa ngày', leave: 'Nghỉ phép', absent: 'Vắng' };
const LEAVE_TYPE = { leave: 'Nghỉ phép', half_day: 'Nghỉ nửa ngày', late: 'Đi muộn', early: 'Về sớm' };
const LEAVE_STATUS = { pending: ['Chờ duyệt', 'e-tone-warning'], approved: ['Đã duyệt', 'e-tone-success'], rejected: ['Từ chối', 'e-tone-danger'] };
const FIELD = {
  role: 'Vai trò', role_2: 'Vai trò phụ', position: 'Chức danh', base_salary: 'Lương cơ bản', allowance: 'Phụ cấp',
  is_active: 'Hoạt động', employment_status: 'Loại', contract_type: 'Loại hợp đồng', contract_start: 'HĐ bắt đầu',
  contract_end: 'HĐ hết hạn', bank_account: 'Số tài khoản', bank_name: 'Ngân hàng', check_in: 'Giờ vào', check_out: 'Giờ ra',
  status: 'Trạng thái', amount: 'Số tiền', official_started_at: 'Ngày chính thức', probation_started_at: 'Bắt đầu thử việc',
};
const ENTITY = { profiles: 'Hồ sơ', attendance: 'Chấm công', leave_requests: 'Đơn từ', salary_advances: 'Ứng lương', expenses: 'Chi phí', payroll: 'Bảng lương' };
const val = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Có' : 'Không') : typeof v === 'number' && Math.abs(v) >= 1000 ? v.toLocaleString('vi-VN') : String(v));

const Kv = ({ label: l, children }) => (
  <div className="min-w-0"><div className="e-kv-label">{l}</div><div className="e-kv-value break-words">{children || '—'}</div></div>
);

const TABS = [
  { id: 'info', label: 'Thông tin', icon: UserRound },
  { id: 'contract', label: 'Hợp đồng', icon: FileSignature },
  { id: 'work', label: 'Công & phép', icon: CalendarCheck },
  { id: 'history', label: 'Lịch sử', icon: History },
];

export default function StaffDetailDrawer({
  staff: s, onClose, onEdit, onToggleActive, actions = [], hrExt,
  roleLabels, roleColors, StatusBadge, fmtMoney, joinDate,
}) {
  const [tab, setTab] = useState('info');
  const [work, setWork] = useState(null);     // { att: [], leaves: [] }
  const [hist, setHist] = useState(null);     // [] | { missing: true }

  useEffect(() => { if (s) { setTab('info'); setWork(null); setHist(null); } }, [s]);

  useEffect(() => {
    if (!s || tab !== 'work' || work) return;
    const t = vnToday(); const ms = `${t.slice(0, 7)}-01`;
    Promise.all([
      supabase.from('attendance').select('date, status, check_in, check_out, late_early_hours, overtime_hours').eq('staff_id', s.id).gte('date', ms).lte('date', t),
      supabase.from('leave_requests').select('*').eq('staff_id', s.id).order('created_at', { ascending: false }).limit(10),
    ]).then(([a, l]) => setWork({ att: a.data || [], leaves: l.data || [] }));
  }, [s, tab, work]);

  useEffect(() => {
    if (!s || tab !== 'history' || hist) return;
    const base = supabase.from('audit_log').select('*, actor:profiles!actor_id(full_name)').order('created_at', { ascending: false }).limit(50);
    base.or(`and(entity.eq.profiles,entity_id.eq.${s.id}),after_data->>staff_id.eq.${s.id},before_data->>staff_id.eq.${s.id}`)
      .then(async ({ data, error }) => {
        if (!error) { setHist(data || []); return; }
        if (error.code === '42P01' || error.code === 'PGRST205') { setHist({ missing: true }); return; }
        // Bộ lọc JSON không được hỗ trợ -> chỉ lấy lịch sử của hồ sơ
        const r = await supabase.from('audit_log').select('*, actor:profiles!actor_id(full_name)').eq('entity', 'profiles').eq('entity_id', s.id).order('created_at', { ascending: false }).limit(50);
        setHist(r.error ? { missing: true } : (r.data || []));
      });
  }, [s, tab, hist]);

  if (!s) return <Drawer open={false} onClose={onClose} />;
  const left = daysUntil(s.contract_end);
  const roles = [s.role, s.role_2].filter(Boolean);
  const att = work?.att || [];
  const count = (st) => att.filter(a => a.status === st).length;
  const cong = att.reduce((n, a) => n + (['present', 'late', 'early_leave'].includes(a.status) ? 1 : a.status === 'half_day' ? 0.5 : 0), 0);
  const sum = (k) => att.reduce((n, a) => n + Number(a[k] || 0), 0);

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={s.full_name}
      description={[s.employee_id, s.position].filter(Boolean).join(' · ')}
      footer={<>
        <button onClick={() => onToggleActive(s)} className="e-btn e-btn-secondary mr-auto">{s.is_active ? <><Lock /> Khoá</> : <><LockOpen /> Mở khoá</>}</button>
        <button onClick={() => onEdit(s)} className="e-btn e-btn-primary"><Pencil /> Sửa thông tin</button>
      </>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className={`w-16 h-16 rounded-full overflow-hidden shrink-0 grid place-items-center text-[20px] font-bold ${s.avatar_url ? '' : 'bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700'}`}>
            {s.avatar_url ? <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" /> : avInit(s.full_name)}
          </span>
          <div className="min-w-0 space-y-1.5">
            <StatusBadge x={s} />
            <div className="flex flex-wrap gap-1">
              {roles.map(r => <span key={r} className={`e-badge e-badge-sm ${roleColors[r] || 'e-tone-neutral'}`}>{roleLabels[r] || r}</span>)}
            </div>
          </div>
        </div>

        <div className="e-tabs">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`e-tab ${tab === t.id ? 'e-tab-active' : ''}`}><t.icon /> {t.label}</button>
          ))}
        </div>

        {tab === 'info' && (
          <>
            <div className="e-subtle px-4 py-3 grid grid-cols-2 gap-y-3 gap-x-4">
              <Kv label="Mã nhân viên">{s.employee_id}</Kv>
              <Kv label="Số điện thoại">{s.phone}</Kv>
              {hrExt && <Kv label="Email">{s.email}</Kv>}
              {hrExt && <Kv label="Ngày sinh">{s.birthday ? fmtDate(s.birthday) : null}</Kv>}
              {hrExt && <Kv label="Giới tính">{s.gender ? label(GENDERS, s.gender) : null}</Kv>}
              {hrExt && <Kv label="Địa chỉ">{s.address}</Kv>}
              <Kv label="Lương cơ bản">{fmtMoney(s.base_salary)}</Kv>
              <Kv label="Phụ cấp">{fmtMoney(s.allowance)}</Kv>
              <Kv label="Kiểu lương">{s.fixed_salary ? 'Lương cố định' : 'Theo ngày công'}</Kv>
              <Kv label="Nhận lương">{s.bank_name && s.bank_account ? `${s.bank_name} · ${s.bank_account}` : 'Chưa cập nhật'}</Kv>
            </div>
            <div className="divide-y divide-slate-100">
              {actions.map(a => {
                const cls = `w-full flex items-center gap-3 h-12 px-1 text-[14.5px] font-medium text-left ${a.danger ? 'text-danger-600' : 'text-slate-800'}`;
                const inner = <><span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${a.danger ? 'bg-danger-50' : 'bg-teal-50 text-teal-700'}`}><a.icon className="w-[18px] h-[18px]" /></span><span className="flex-1">{a.label}</span><ChevronRight className="w-4 h-4 text-slate-300" /></>;
                return a.href
                  ? <a key={a.label} href={a.href} className={cls}>{inner}</a>
                  : <button key={a.label} onClick={() => a.fn(s)} className={cls}>{inner}</button>;
              })}
            </div>
          </>
        )}

        {tab === 'contract' && (
          <div className="space-y-3">
            {hrExt && left !== null && left <= 30 && (
              <div className={`e-alert ${left < 0 ? 'e-alert-danger' : 'e-alert-warning'}`}>
                <FileSignature />
                <div>{left < 0 ? `Hợp đồng đã hết hạn ${-left} ngày` : left === 0 ? 'Hợp đồng hết hạn hôm nay' : `Hợp đồng còn ${left} ngày`} ({fmtDate(s.contract_end)})</div>
              </div>
            )}
            <div className="e-subtle px-4 py-3 grid grid-cols-2 gap-y-3 gap-x-4">
              {hrExt && <Kv label="Loại hợp đồng">{s.contract_type ? label(CONTRACT_TYPES, s.contract_type) : null}</Kv>}
              {hrExt && <Kv label="Hiệu lực">{s.contract_start || s.contract_end ? `${fmtDate(s.contract_start)} → ${s.contract_end ? fmtDate(s.contract_end) : 'không thời hạn'}` : null}</Kv>}
              <Kv label="Trạng thái">{s.employment_status === 'probation' ? 'Thử việc (85% lương)' : 'Chính thức'}</Kv>
              <Kv label="Ngày vào làm">{fmtDate(joinDate(s))}</Kv>
              <Kv label="Bắt đầu thử việc">{s.probation_started_at ? fmtDate(s.probation_started_at) : null}</Kv>
              <Kv label="Ngày chính thức">{s.official_started_at ? fmtDate(s.official_started_at) : null}</Kv>
            </div>
            {!hrExt && <div className="text-[12.5px] text-slate-500">Chạy <code className="px-1 rounded bg-slate-100">supabase/hr_extended.sql</code> để lưu loại hợp đồng, ngày hết hạn và thông tin cá nhân.</div>}
          </div>
        )}

        {tab === 'work' && (!work ? <div className="h-24 rounded-xl bg-slate-100 animate-pulse" /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[['Ngày công', cong], ['Đi muộn', count('late')], ['Về sớm', count('early_leave')], ['Nghỉ phép', count('leave') + count('half_day') * 0.5], ['Giờ muộn/sớm', sum('late_early_hours')], ['Giờ tăng ca', sum('overtime_hours')]].map(([l, v]) => (
                <div key={l} className="e-subtle px-3 py-2.5 min-w-0"><div className="e-kv-label truncate">{l}</div><div className="text-[17px] font-bold text-slate-900 tabular-nums">{v}</div></div>
              ))}
            </div>
            <div>
              <div className="e-caption mb-2">Chấm công tháng này</div>
              {att.length === 0 ? <div className="text-[13px] text-slate-400">Chưa có bản ghi chấm công</div> : (
                <div className="flex flex-wrap gap-1.5">
                  {att.slice().sort((a, b) => a.date.localeCompare(b.date)).map(a => (
                    <span key={a.date} title={`${fmtDate(a.date)} · ${ATT_LABEL[a.status] || a.status}${a.check_in ? ` · vào ${String(a.check_in).slice(0, 5)}` : ''}`}
                      className={`e-badge e-badge-sm tabular-nums ${a.status === 'present' ? 'e-tone-success' : a.status === 'late' || a.status === 'early_leave' ? 'e-tone-warning' : a.status === 'absent' ? 'e-tone-danger' : 'e-tone-info'}`}>
                      {a.date.slice(8)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="e-caption mb-2">Đơn từ gần đây</div>
              {work.leaves.length === 0 ? <div className="text-[13px] text-slate-400">Chưa có đơn nào</div> : (
                <div className="divide-y divide-slate-100">
                  {work.leaves.map(l => (
                    <div key={l.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-slate-800">{LEAVE_TYPE[l.type] || l.type} · {fmtDate(l.date)}</div>
                        {(l.reason || l.decision_note) && <div className="text-[12px] text-slate-500 truncate">{l.reason}{l.decision_note ? ` · Phản hồi: ${l.decision_note}` : ''}</div>}
                      </div>
                      <span className={`e-badge e-badge-sm ${(LEAVE_STATUS[l.status] || [])[1] || 'e-tone-neutral'}`}>{(LEAVE_STATUS[l.status] || [l.status])[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {tab === 'history' && (!hist ? <div className="h-24 rounded-xl bg-slate-100 animate-pulse" /> : hist.missing ? (
          <EmptyState title="Chưa bật nhật ký hoạt động" description="Chạy supabase/audit_log.sql để ghi lại thay đổi hồ sơ, lương, chấm công." icon={History} />
        ) : hist.length === 0 ? <EmptyState title="Chưa có thay đổi nào được ghi lại" icon={History} /> : (
          <ol className="relative ml-3 border-l-[1.5px] border-slate-200 space-y-3 py-1">
            {hist.map(h => {
              const keys = h.changed_fields || Object.keys(h.after_data || h.before_data || {}).filter(k => k !== 'id');
              return (
                <li key={h.id} className="relative pl-5">
                  <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-white" />
                  <div className="text-[13.5px] font-semibold text-slate-800">{ENTITY[h.entity] || h.entity} · {h.action === 'insert' ? 'tạo mới' : h.action === 'delete' ? 'xoá' : h.action === 'update' ? 'sửa' : h.action}</div>
                  <div className="text-[12.5px] text-slate-600">
                    {keys.slice(0, 4).map(k => (h.action === 'update'
                      ? `${FIELD[k] || k}: ${val(h.before_data?.[k])} → ${val(h.after_data?.[k])}`
                      : `${FIELD[k] || k}: ${val((h.after_data || h.before_data)?.[k])}`)).join(' · ')}
                  </div>
                  <div className="text-[11.5px] text-slate-400">{[h.actor?.full_name || 'Hệ thống', fmtDT(h.created_at), h.reason ? `Lý do: ${h.reason}` : null].filter(Boolean).join(' · ')}</div>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
    </Drawer>
  );
}
