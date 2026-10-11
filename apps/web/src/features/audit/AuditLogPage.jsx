// ============================================================
// NHẬT KÝ HOẠT ĐỘNG (Ethics D12 "Nhật ký hoạt động" — quy tắc AUDITABLE)
// Đọc bảng audit_log (supabase/audit_log.sql). RLS tự giới hạn:
// Admin thấy tất cả; Kế toán / Cổ đông thấy phần tài chính - lương.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollText, Download, RotateCw, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { downloadCsv } from '@/lib/csv';
import { vnToday } from '@/lib/vnTime';
import { logAuditEvent } from '@/lib/audit';
import { DataTable, FilterBar, FilterSelect, AlertStrip, Drawer, usePageTitle } from '@/components/ds';
import { APPT_TONE } from '@/features/appointments/calendarUtils';
import { PAY_STATUS_LABEL } from '@/features/payroll/workflow';

const LIMIT = 500;

const ENTITY_LABEL = {
  payroll: 'Bảng lương',
  profiles: 'Nhân sự',
  customer_appointments: 'Lịch hẹn / Khách hàng',
  finance_transactions: 'Thu chi tài chính',
  cash_flows: 'Dòng tiền',
  risk_fund: 'Quỹ rủi ro',
  salary_advances: 'Ứng lương',
  expenses: 'Tạm ứng / Chi phí',
  leave_requests: 'Đơn nghỉ / đi muộn',
  attendance: 'Chấm công',
  partner_surgeries: 'Mổ đối tác',
};
const ACTION_META = {
  insert: { label: 'Tạo mới', tone: 'e-tone-success' },
  update: { label: 'Sửa', tone: 'e-tone-info' },
  delete: { label: 'Xoá', tone: 'e-tone-danger' },
  export: { label: 'Xuất file', tone: 'e-tone-lavender' },
  print: { label: 'In', tone: 'e-tone-lavender' },
  view_sensitive: { label: 'Xem dữ liệu nhạy cảm', tone: 'e-tone-warning' },
  impersonate: { label: 'Đăng nhập thay', tone: 'e-tone-warning' },
};
const FIELD_LABEL = {
  status: 'Trạng thái', amount: 'Số tiền', other_bonus: 'Thưởng khác', other_deduction: 'Khấu trừ',
  role: 'Vai trò', role_2: 'Vai trò phụ', position: 'Chức danh', base_salary: 'Lương cơ bản', allowance: 'Phụ cấp',
  fixed_salary: 'Lương cố định', is_active: 'Đang hoạt động', employment_status: 'Loại hợp đồng',
  probation_started_at: 'Bắt đầu thử việc', official_started_at: 'Ngày chính thức', bank_name: 'Ngân hàng',
  bank_account: 'Số tài khoản', employee_id: 'Mã NV', sale_id: 'Sale', telesale_id: 'Telesale', telesale_id_2: 'Telesale 2',
  bac_si_id: 'Bác sĩ', deposit_amount: 'Tiền cọc', deposit_date: 'Ngày cọc', revenue: 'Doanh thu', upsale_revenue: 'Upsale',
  hospital_fee: 'Viện phí', surgery_date: 'Ngày mổ', reject_reason: 'Lý do từ chối', month: 'Tháng', year: 'Năm',
  is_advance: 'Là tạm ứng', category: 'Danh mục', deleted_at: 'Đã xoá lúc', paid_at: 'Thanh toán lúc',
  advance_repaid_at: 'Hoàn ứng lúc', type: 'Loại', date: 'Ngày', leave_type: 'Loại nghỉ', check_in: 'Giờ vào',
  check_out: 'Giờ ra', late_time: 'Giờ đến muộn', early_time: 'Giờ về sớm', late_early_hours: 'Giờ muộn/sớm',
  overtime_hours: 'Giờ tăng ca', overtime_ranges: 'Khung tăng ca', partner_fee: 'Phí đối tác', surgery_fee: 'Phí mổ',
  material_fee: 'Phí vật tư', partner_paid: 'Đối tác đã trả', phu_mo_1_id: 'Phụ mổ 1', phu_mo_2_id: 'Phụ mổ 2',
  phu_mo_3_id: 'Phụ mổ 3', flow_type: 'Thu / chi', method: 'Hình thức', notes: 'Ghi chú', note: 'Ghi chú',
  handover_person: 'Người bàn giao', full_name: 'Họ tên', kind: 'Loại', staff_id: 'Nhân sự', created_by: 'Người tạo', rows: 'Số dòng', file: 'Tệp',
};
const STATUS_LABEL = {
  ...Object.fromEntries(Object.entries(APPT_TONE || {}).map(([k, v]) => [k, v.label])),
  ...PAY_STATUS_LABEL,
  pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', paid: 'Đã chi trả',
  present: 'Có mặt', absent: 'Vắng', leave: 'Nghỉ phép', late: 'Đi muộn', early_leave: 'Về sớm', half_day: 'Nửa ngày',
  probation: 'Thử việc', official: 'Chính thức', inactive: 'Đã xoá', in: 'Thu', out: 'Chi', cash: 'Tiền mặt', transfer: 'Chuyển khoản',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };
const fmtTime = (s) => new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const isMissing = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205'
  || (/audit_log/.test(e.message || '') && /does not exist|could not find|schema cache/i.test(e.message || '')));

export default function AuditLogPage() {
  usePageTitle('Nhật ký hoạt động');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  const [names, setNames] = useState({});        // id nhân sự -> tên
  const [custNames, setCustNames] = useState({}); // id lịch hẹn -> tên khách
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(vnToday());
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const end = new Date(`${to}T00:00:00`); end.setDate(end.getDate() + 1);
    let query = supabase.from('audit_log')
      .select('*, actor:profiles!actor_id(full_name, employee_id)')
      .gte('created_at', `${from}T00:00:00+07:00`).lt('created_at', `${isoDay(end)}T00:00:00+07:00`)
      .order('created_at', { ascending: false }).limit(LIMIT);
    if (entity) query = query.eq('entity', entity);
    if (action) query = query.eq('action', action);
    const [{ data, error: err }, staffRes] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name'),
    ]);
    if (err) {
      setMissing(isMissing(err));
      if (!isMissing(err)) setError(err);
      setRows([]); setLoading(false); return;
    }
    setMissing(false);
    setRows(data || []);
    setNames(Object.fromEntries((staffRes.data || []).map(s => [s.id, s.full_name])));
    const apptIds = [...new Set((data || []).filter(r => r.entity === 'customer_appointments' && r.entity_id).map(r => r.entity_id))];
    if (apptIds.length) {
      const { data: appts } = await supabase.from('customer_appointments').select('id, customer_name').in('id', apptIds.slice(0, 300));
      setCustNames(Object.fromEntries((appts || []).map(a => [a.id, a.customer_name])));
    } else setCustNames({});
    setLoading(false);
  }, [from, to, entity, action]);

  useEffect(() => { load(); }, [load]);

  const fmtVal = useCallback((key, v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Có' : 'Không';
    if (typeof v === 'number') return Math.abs(v) >= 1000 ? new Intl.NumberFormat('vi-VN').format(v) : String(v);
    if (typeof v === 'string' && UUID_RE.test(v)) return names[v] || `${v.slice(0, 8)}…`;
    if (typeof v === 'string' && STATUS_LABEL[v] && /status|kind|flow_type|method|type/.test(key)) return STATUS_LABEL[v];
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }, [names]);

  const targetLabel = useCallback((r) => {
    if (!r.entity_id) return '';
    if (r.entity === 'profiles') return names[r.entity_id] || '';
    if (r.entity === 'customer_appointments') return custNames[r.entity_id] || '';
    const sid = r.after_data?.staff_id || r.before_data?.staff_id;
    return sid ? (names[sid] || '') : '';
  }, [names, custNames]);

  const changes = useCallback((r) => {
    if (r.action === 'update') return (r.changed_fields || []).map(k => ({ k, from: r.before_data?.[k], to: r.after_data?.[k] }));
    const data = r.after_data || r.before_data || {};
    return Object.keys(data).filter(k => k !== 'id').map(k => ({ k, from: r.action === 'delete' ? data[k] : undefined, to: r.action === 'delete' ? undefined : data[k] }));
  }, []);

  const summary = useCallback((r) => {
    const list = changes(r);
    if (!list.length) return '—';
    const show = list.slice(0, 2).map(c => (r.action === 'update'
      ? `${FIELD_LABEL[c.k] || c.k}: ${fmtVal(c.k, c.from)} → ${fmtVal(c.k, c.to)}`
      : `${FIELD_LABEL[c.k] || c.k}: ${fmtVal(c.k, c.to ?? c.from)}`));
    return show.join(' · ') + (list.length > 2 ? ` · +${list.length - 2}` : '');
  }, [changes, fmtVal]);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(r => [r.actor?.full_name, r.reason, r.entity_id, targetLabel(r), ENTITY_LABEL[r.entity], summary(r)]
      .some(x => String(x || '').toLowerCase().includes(kw)));
  }, [rows, q, targetLabel, summary]);

  const exportCsv = () => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Bản ghi', 'Thay đổi', 'Lý do', 'IP'];
    const lines = view.map(r => [fmtTime(r.created_at), r.actor?.full_name || 'Hệ thống', ACTION_META[r.action]?.label || r.action,
      ENTITY_LABEL[r.entity] || r.entity, targetLabel(r) || r.entity_id, summary(r), r.reason, r.ip].map(cell).join(','));
    downloadCsv(`nhat-ky-${from}_${to}.csv`, [head.map(cell).join(','), ...lines].join('\n'));
    logAuditEvent('export', 'audit_log', { details: { rows: view.length, from, to, entity: entity || null, action: action || null } });
  };

  const columns = [
    { key: 'time', header: 'Thời gian', sortValue: r => r.created_at, width: 150, cell: r => <span className="text-slate-600 tabular-nums whitespace-nowrap">{fmtTime(r.created_at)}</span> },
    { key: 'actor', header: 'Người thực hiện', sortValue: r => r.actor?.full_name || '', cell: r => (
      <div className="min-w-[140px]">
        <div className="font-semibold text-slate-900 text-[14px] leading-tight">{r.actor?.full_name || 'Hệ thống'}</div>
        {r.actor?.employee_id && <div className="text-[12px] text-slate-500">{r.actor.employee_id}</div>}
      </div>
    ) },
    { key: 'action', header: 'Hành động', sortValue: r => r.action, cell: r => <span className={`e-badge e-badge-sm ${ACTION_META[r.action]?.tone || 'e-tone-neutral'}`}>{ACTION_META[r.action]?.label || r.action}</span> },
    { key: 'entity', header: 'Đối tượng', sortValue: r => ENTITY_LABEL[r.entity] || r.entity, cell: r => (
      <div className="min-w-[150px]">
        <div className="text-slate-800 text-[13.5px] font-medium">{ENTITY_LABEL[r.entity] || r.entity}</div>
        {targetLabel(r) && <div className="text-[12px] text-slate-500 truncate max-w-[200px]">{targetLabel(r)}</div>}
      </div>
    ) },
    { key: 'change', header: 'Thay đổi', cell: r => <span className="text-[13px] text-slate-600 line-clamp-2 max-w-[360px]">{summary(r)}</span> },
    { key: 'reason', header: 'Lý do', cell: r => <span className="text-[13px] text-slate-600 line-clamp-2 max-w-[220px]">{r.reason || '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      {missing && (
        <AlertStrip tone="info">
          <b>Chưa bật nhật ký hoạt động.</b> Chạy file <code className="px-1 rounded bg-white/60">supabase/audit_log.sql</code> trong Supabase SQL Editor để bắt đầu ghi lại các thay đổi về lương, tài chính, lịch hẹn, nhân sự.
        </AlertStrip>
      )}

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: 'Tìm theo người, khách, lý do…' }}
        actions={<>
          <button onClick={load} className="e-icon-btn" aria-label="Tải lại" title="Tải lại"><RotateCw className="w-4 h-4" /></button>
          <button onClick={exportCsv} disabled={!view.length} className="e-btn e-btn-secondary"><Download /> Xuất CSV</button>
        </>}
      >
        <FilterSelect label="Đối tượng" allLabel="Tất cả đối tượng" value={entity} onChange={setEntity}
          options={Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label }))} />
        <FilterSelect label="Hành động" allLabel="Tất cả hành động" value={action} onChange={setAction}
          options={Object.entries(ACTION_META).map(([value, m]) => ({ value, label: m.label }))} className="!min-w-[160px]" />
        <label className="flex items-center gap-1.5 text-[13px] text-slate-500">
          Từ <input type="date" className="e-input !w-auto" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-slate-500">
          đến <input type="date" className="e-input !w-auto" value={to} min={from} max={vnToday()} onChange={e => e.target.value && setTo(e.target.value)} />
        </label>
      </FilterBar>

      {!loading && rows.length >= LIMIT && (
        <AlertStrip tone="info">Đang hiện {LIMIT} thao tác mới nhất trong khoảng ngày đã chọn. Thu hẹp ngày hoặc lọc theo đối tượng để xem các thao tác cũ hơn.</AlertStrip>
      )}

      <DataTable
        rows={view}
        loading={loading}
        error={error}
        onRetry={load}
        columns={columns}
        minWidth={1000}
        pageSize={20}
        onRowClick={setDetail}
        empty={{ title: missing ? 'Chưa có nhật ký' : 'Không có thao tác nào', description: missing ? undefined : 'Thử đổi khoảng ngày hoặc bộ lọc.', icon: ScrollText }}
        footerStart={`${view.length} thao tác`}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${ACTION_META[detail.action]?.label || detail.action} · ${ENTITY_LABEL[detail.entity] || detail.entity}` : ''}
        description={detail ? `${detail.actor?.full_name || 'Hệ thống'} · ${fmtTime(detail.created_at)}` : ''}
        size="lg"
      >
        {detail && (
          <div className="space-y-4">
            <div className="e-subtle px-4 py-3 grid grid-cols-2 gap-y-3 gap-x-4">
              <div><div className="e-kv-label">Bản ghi</div><div className="e-kv-value break-all">{targetLabel(detail) || detail.entity_id || '—'}</div></div>
              <div><div className="e-kv-label">Lý do</div><div className="e-kv-value">{detail.reason || '—'}</div></div>
              <div><div className="e-kv-label">Địa chỉ IP</div><div className="e-kv-value tabular-nums">{detail.ip || '—'}</div></div>
              <div><div className="e-kv-label">Trình duyệt</div><div className="e-kv-value text-[12.5px] font-medium line-clamp-2">{detail.user_agent || '—'}</div></div>
            </div>
            <div className="e-card overflow-hidden">
              <table className="e-table">
                <thead><tr><th>Trường</th>{detail.action !== 'insert' && detail.action !== 'export' && <th>Trước</th>}{detail.action !== 'delete' && <th>Sau</th>}</tr></thead>
                <tbody>
                  {changes(detail).map(c => (
                    <tr key={c.k}>
                      <td className="font-medium text-slate-700">{FIELD_LABEL[c.k] || c.k}</td>
                      {detail.action !== 'insert' && detail.action !== 'export' && <td className="text-danger-600 break-all">{fmtVal(c.k, c.from)}</td>}
                      {detail.action !== 'delete' && (
                        <td className="text-success-700 break-all">
                          {detail.action === 'update' && <ArrowRight className="w-3.5 h-3.5 inline mr-1 text-slate-400" />}{fmtVal(c.k, c.to)}
                        </td>
                      )}
                    </tr>
                  ))}
                  {changes(detail).length === 0 && <tr><td colSpan={3} className="text-center text-slate-400">Không có chi tiết</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
