// ============================================================
// SỬA THÔNG TIN KHÁCH TỪ HỒ SƠ 360 (chỉ Admin)
//  - EditApptModal: mọi thông tin 1 lịch hẹn / ca mổ (tư vấn, cọc, phẫu thuật, hậu phẫu, nhật ký)
//  - EditLeadModal: Data KH
//  - EditCustomerModal: tên + SĐT -> áp cho TẤT CẢ hồ sơ của khách (để 360 vẫn gom đúng)
// Chỉ hiện ô của cột có thật trong dữ liệu; chỉ gửi các ô đã đổi; kiểm tra số dòng cập nhật
// (RLS chặn thì Supabase không báo lỗi mà trả 0 dòng).
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { SERVICE_GROUPS } from '@/features/crm/customerFilters.jsx';
import { JOURNEY as SURGERY_JOURNEY } from '@/features/appointments/journey.jsx';

const STATUS_OPTS = [['scheduled', 'Chờ tư vấn'], ['coc', 'Đã cọc'], ['phau_thuat', 'Phẫu thuật'], ['bong', 'Khách bong'], ['cancelled', 'Đã huỷ']];
const LEAD_STATUS_OPTS = [['tiep_can', 'Tiếp cận'], ['nong', 'Nóng'], ['tiem_nang', 'Tiềm năng'], ['da_hen_lich', 'Đã hẹn lịch'], ['coc', 'Cọc'], ['da_lam_dv', 'Đã làm dịch vụ'], ['sai_gon', 'Sài Gòn'], ['chot_fail', 'Chốt Fail'], ['mat', 'Mất']];
const POST_OP = ['Đang theo dõi', 'Tái khám', 'Đã ổn định', 'Có biến chứng'];
const CSKH = ['Hài lòng', 'Không hài lòng', 'Bình thường', 'Tiềm năng', 'Gặp vấn đề'];
const BONG_CARE = ['Đang chăm sóc', 'Đã quay lại tư vấn', 'Làm nơi khác', 'Hủy hẳn'];
const opts = (arr) => arr.map(x => (Array.isArray(x) ? { value: x[0], label: x[1] } : { value: x, label: x }));

const APPT_SECTIONS = [
  { title: 'Lịch hẹn & tư vấn', fields: [
    { key: 'appointment_date', label: 'Ngày hẹn', type: 'date', required: true },
    { key: 'appointment_time', label: 'Giờ hẹn', type: 'time' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: opts(STATUS_OPTS), required: true },
    { key: 'service', label: 'Dịch vụ', type: 'text', span: 2 },
    { key: 'used_service', label: 'Dịch vụ đã sử dụng (tái khám)', type: 'text', span: 2 },
    { key: 'service_group', label: 'Nhóm dịch vụ', type: 'select', options: opts(SERVICE_GROUPS) },
    { key: 'surgery_type', label: 'Loại phẫu thuật', type: 'select', options: opts(['Tiểu phẫu', 'Đại phẫu']) },
    { key: 'customer_source', label: 'Nguồn khách', type: 'text' },
    { key: 'customer_type', label: 'Tệp khách', type: 'select', options: opts(['Mới', 'Cũ']) },
    { key: 'test_status', label: 'Xét nghiệm', type: 'text' },
    { key: 'expected_bill', label: 'Bill dự kiến (đ)', type: 'number' },
    { key: 'social_link', label: 'Link tham khảo', type: 'text', span: 2 },
    { key: 'notes', label: 'Ghi chú', type: 'textarea', span: 2 },
  ] },
  { title: 'Phụ trách', fields: [
    { key: 'telesale_id', label: 'Telesale', type: 'staff' },
    { key: 'telesale_id_2', label: 'Telesale 2', type: 'staff' },
    { key: 'sale_id', label: 'Sale Offline / phụ trách', type: 'staff' },
  ] },
  { title: 'Đặt cọc', fields: [
    { key: 'deposit_amount', label: 'Tiền cọc (đ)', type: 'number' },
    { key: 'deposit_date', label: 'Ngày cọc', type: 'date' },
    { key: 'expected_surgery_date', label: 'Ngày dự kiến mổ', type: 'date' },
    { key: 'expected_surgery_plan', label: 'Kế hoạch mổ', type: 'textarea', span: 2 },
  ] },
  { title: 'Phẫu thuật', fields: [
    { key: 'surgery_date', label: 'Ngày mổ', type: 'date' },
    { key: 'surgery_time', label: 'Giờ mổ', type: 'time' },
    { key: 'revenue', label: 'Doanh thu (đ)', type: 'number' },
    { key: 'upsale_revenue', label: 'Upsale (đ)', type: 'number' },
    { key: 'hospital_fee', label: 'Viện phí (đ)', type: 'number' },
    { key: 'journey_status', label: 'Hành trình', type: 'select', options: Object.entries(SURGERY_JOURNEY).map(([v, j]) => ({ value: v, label: j.label })) },
    { key: 'bac_si_id', label: 'Bác sĩ', type: 'staff' },
    { key: 'phu_mo_1_id', label: 'Phụ mổ 1', type: 'staff' },
    { key: 'phu_mo_2_id', label: 'Phụ mổ 2', type: 'staff' },
    { key: 'phu_mo_3_id', label: 'Phụ mổ 3', type: 'staff' },
    { key: 'truc_dem_id', label: 'Trực đêm', type: 'staff' },
    { key: 'truc_dem_id_2', label: 'Trực đêm 2', type: 'staff' },
    { key: 'surgery_notes', label: 'Ghi chú ca mổ', type: 'textarea', span: 2 },
    { key: 'truc_dem_notes', label: 'Ghi chú trực đêm', type: 'textarea', span: 2 },
  ] },
  { title: 'Hậu phẫu & CSKH', fields: [
    { key: 'hau_phau_id', label: 'Điều dưỡng hậu phẫu', type: 'staff' },
    { key: 'post_op_status', label: 'Trạng thái hậu phẫu', type: 'select', options: opts(POST_OP) },
    { key: 'next_recheck_at', label: 'Tái khám tiếp theo', type: 'datetime' },
    { key: 'cskh_status', label: 'Phân loại CSKH', type: 'select', options: opts(CSKH) },
    { key: 'bong_date', label: 'Ngày bong', type: 'date' },
    { key: 'care_status', label: 'Chăm sóc khách bong', type: 'select', options: opts(BONG_CARE) },
  ] },
  { title: 'Hồ sơ & nhật ký (sửa trực tiếp nội dung)', fields: [
    { key: 'consult_note', label: 'Hồ sơ tư vấn', type: 'textarea', span: 2 },
    { key: 'extra_consult', label: 'Tư vấn thêm', type: 'textarea', span: 2 },
    { key: 'care_notes', label: 'Lịch sử tư vấn / chăm sóc', type: 'textarea', span: 2, rows: 5 },
    { key: 'post_op_notes', label: 'Nhật ký hậu phẫu', type: 'textarea', span: 2, rows: 5 },
    { key: 'cskh_notes', label: 'Nhật ký CSKH', type: 'textarea', span: 2, rows: 5 },
  ] },
];

const LEAD_SECTIONS = [
  { title: 'Data khách hàng', fields: [
    { key: 'status', label: 'Trạng thái', type: 'select', options: opts(LEAD_STATUS_OPTS) },
    { key: 'source', label: 'Nguồn', type: 'text' },
    { key: 'customer_group', label: 'Tệp / nhóm khách', type: 'text' },
    { key: 'telesale_id', label: 'Telesale', type: 'staff' },
    { key: 'truc_page_id', label: 'Trực page', type: 'staff' },
    { key: 'next_call_at', label: 'Hẹn gọi lại', type: 'datetime' },
    { key: 'gender', label: 'Giới tính', type: 'select', options: opts(['Nữ', 'Nam', 'Khác']) },
    { key: 'birthday', label: 'Ngày sinh', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'address', label: 'Địa chỉ', type: 'text', span: 2 },
    { key: 'description', label: 'Nhu cầu / mô tả', type: 'textarea', span: 2 },
    { key: 'last_exchange', label: 'Trao đổi gần nhất', type: 'textarea', span: 2 },
    { key: 'reached_info', label: 'Thông tin đã tiếp cận', type: 'textarea', span: 2 },
  ] },
];

// ---- chuyển giá trị DB <-> ô nhập ----
const pad = (n) => String(n).padStart(2, '0');
const toLocalVN = (iso) => { // ISO -> 'YYYY-MM-DDTHH:mm' giờ Việt Nam
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const v = new Date(d.getTime() + 7 * 3600e3);
  return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}T${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
};
const toInput = (f, v) => {
  if (v == null) return '';
  if (f.type === 'date') return String(v).slice(0, 10);
  if (f.type === 'time') return String(v).slice(0, 5);
  if (f.type === 'datetime') return toLocalVN(v);
  return String(v);
};
const fromInput = (f, s) => {
  const t = typeof s === 'string' ? s.trim() : s;
  if (t === '' || t == null) return null;
  if (f.type === 'number') { const n = Number(String(t).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null; }
  if (f.type === 'datetime') return new Date(`${t}:00+07:00`).toISOString();
  return t;
};

let staffCache = null;
function useStaff() {
  const [list, setList] = useState(staffCache || []);
  useEffect(() => {
    if (staffCache) return;
    supabase.from('profiles').select('id, full_name, role, is_active, employment_status').order('full_name')
      .then(({ data }) => { staffCache = data || []; setList(staffCache); });
  }, []);
  return list;
}

function ModalShell({ title, subtitle, onClose, footer, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div className="e-modal-backdrop" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="e-modal sm:max-w-2xl max-sm:rounded-b-none flex flex-col max-h-[92vh]">
        <div className="e-modal-header">
          <div className="min-w-0"><div className="e-modal-title">{title}</div>{subtitle && <div className="text-[12.5px] text-slate-500 mt-0.5">{subtitle}</div>}</div>
          <button type="button" onClick={onClose} className="e-icon-btn w-9 h-9 shrink-0" aria-label="Đóng"><X className="w-4 h-4" /></button>
        </div>
        <div className="e-modal-body overflow-y-auto flex-1">{children}</div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 max-sm:pb-[calc(0.875rem+env(safe-area-inset-bottom))]">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

function FieldInput({ f, value, onChange, staff, current }) {
  const cls = 'e-input max-lg:!h-11 max-lg:!text-[16px]';
  if (f.type === 'textarea') return <textarea className="e-textarea max-lg:!text-[16px]" rows={f.rows || 3} value={value} onChange={e => onChange(e.target.value)} />;
  if (f.type === 'select' || f.type === 'staff') {
    let options = f.options || [];
    if (f.type === 'staff') {
      options = staff.filter(s => (s.is_active !== false && s.employment_status !== 'inactive') || s.id === current)
        .map(s => ({ value: s.id, label: `${s.full_name}${s.is_active === false || s.employment_status === 'inactive' ? ' (đã nghỉ)' : ''}` }));
    }
    if (value && !options.some(o => o.value === value)) options = [{ value, label: value }, ...options];
    return (
      <select className={cls} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{f.required ? '— Chọn —' : '— Trống —'}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  const type = f.type === 'number' ? 'text' : f.type === 'datetime' ? 'datetime-local' : f.type;
  return <input className={cls} type={type} inputMode={f.type === 'number' ? 'numeric' : undefined} value={value} onChange={e => onChange(e.target.value)} />;
}

function FormEditor({ title, subtitle, row, sections, onClose, onSave, note }) {
  const staff = useStaff();
  const shown = useMemo(() => sections.map(s => ({ ...s, fields: s.fields.filter(f => f.key in (row || {})) })).filter(s => s.fields.length), [sections, row]);
  const initial = useMemo(() => Object.fromEntries(shown.flatMap(s => s.fields).map(f => [f.key, toInput(f, row[f.key])])), [shown, row]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const fields = shown.flatMap(s => s.fields);
  const changed = fields.filter(f => String(form[f.key] ?? '') !== String(initial[f.key] ?? ''));

  const save = async () => {
    const miss = fields.find(f => f.required && !String(form[f.key] || '').trim());
    if (miss) { toast.error(`Chưa nhập ${miss.label}`); return; }
    if (!changed.length) { onClose(); return; }
    const patch = Object.fromEntries(changed.map(f => [f.key, fromInput(f, form[f.key])]));
    setBusy(true);
    try { await onSave(patch); } finally { setBusy(false); }
  };

  return (
    <ModalShell title={title} subtitle={subtitle} onClose={() => !busy && onClose()}
      footer={<>
        <span className="mr-auto text-[12.5px] text-slate-500">{changed.length ? `${changed.length} mục đã sửa` : 'Chưa sửa gì'}</span>
        <button type="button" onClick={onClose} disabled={busy} className="e-btn e-btn-secondary max-lg:h-11">Huỷ</button>
        <button type="button" onClick={save} disabled={busy || !changed.length} className="e-btn e-btn-primary max-lg:h-11"><Save /> {busy ? 'Đang lưu…' : 'Lưu'}</button>
      </>}>
      {note && <div className="mb-3 flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 px-3 py-2 text-[12.5px] text-warning-700"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{note}</div>}
      <div className="space-y-5">
        {shown.map(s => (
          <section key={s.title}>
            <div className="e-caption mb-2">{s.title}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3">
              {s.fields.map(f => (
                <label key={f.key} className={`block ${f.span === 2 ? 'sm:col-span-2' : ''}`}>
                  <span className="e-label">{f.label}{f.required && <span className="text-danger-500"> *</span>}</span>
                  <FieldInput f={f} value={form[f.key] ?? ''} current={row[f.key]} staff={staff} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ModalShell>
  );
}

const updateRow = async (table, id, patch) => {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không có quyền sửa hoặc hồ sơ không còn tồn tại');
};

export function EditApptModal({ appt, onClose, onSaved }) {
  const label = String(appt.service || '').replace(/^\[Tái khám\]\s*/i, '') || 'lịch hẹn';
  return (
    <FormEditor title={`Sửa: ${label}`} subtitle={appt.customer_name} row={appt} sections={APPT_SECTIONS} onClose={onClose}
      note="Đổi trạng thái ở đây không gửi thông báo Telegram như thao tác trên màn nghiệp vụ."
      onSave={async (patch) => {
        try { await updateRow('customer_appointments', appt.id, patch); toast.success('Đã lưu thay đổi'); onSaved(); }
        catch (e) { toast.error(`Lưu thất bại: ${e.message}`); }
      }} />
  );
}

export function EditLeadModal({ lead, onClose, onSaved }) {
  return (
    <FormEditor title="Sửa Data khách hàng" subtitle={lead.customer_name} row={lead} sections={LEAD_SECTIONS} onClose={onClose}
      note={lead.getfly_id ? 'Khách đồng bộ từ GetFly: lần đồng bộ sau có thể ghi đè các ô GetFly quản lý.' : null}
      onSave={async (patch) => {
        try { await updateRow('marketing_data', lead.id, patch); toast.success('Đã lưu Data KH'); onSaved(); }
        catch (e) { toast.error(`Lưu thất bại: ${e.message}`); }
      }} />
  );
}

// Tên + SĐT: đổi cho mọi lịch hẹn + Data KH của khách
export function EditCustomerModal({ name, phone, appts, lead, onClose, onSaved }) {
  const [f, setF] = useState({ name: name || '', phone: phone || '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const nm = f.name.trim(); const ph = f.phone.replace(/[^\d+]/g, '');
    if (!nm) { toast.error('Chưa nhập tên khách'); return; }
    if (ph.replace(/\D/g, '').length < 9) { toast.error('Số điện thoại không hợp lệ'); return; }
    if (nm === name && ph === phone) { onClose(); return; }
    setBusy(true);
    try {
      const ids = appts.map(a => a.id);
      if (ids.length) {
        const { data, error } = await supabase.from('customer_appointments').update({ customer_name: nm, phone: ph }).in('id', ids).select('id');
        if (error) throw error;
        if ((data?.length || 0) < ids.length) throw new Error(`chỉ cập nhật được ${data?.length || 0}/${ids.length} lịch hẹn`);
      }
      if (lead?.id) await updateRow('marketing_data', lead.id, { customer_name: nm, phone: ph });
      toast.success('Đã cập nhật tên / SĐT cho mọi hồ sơ của khách');
      onSaved(ph, nm);
    } catch (e) { toast.error(`Lưu thất bại: ${e.message}`); } finally { setBusy(false); }
  };
  return (
    <ModalShell title="Sửa thông tin khách" subtitle={`Áp dụng cho ${appts.length} lịch hẹn${lead ? ' + Data KH' : ''}`} onClose={() => !busy && onClose()}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className="e-btn e-btn-secondary max-lg:h-11">Huỷ</button>
        <button type="button" onClick={save} disabled={busy} className="e-btn e-btn-primary max-lg:h-11"><Save /> {busy ? 'Đang lưu…' : 'Lưu'}</button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block"><span className="e-label">Tên khách hàng <span className="text-danger-500">*</span></span>
          <input className="e-input max-lg:!h-11 max-lg:!text-[16px]" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} /></label>
        <label className="block"><span className="e-label">Số điện thoại <span className="text-danger-500">*</span></span>
          <input className="e-input max-lg:!h-11 max-lg:!text-[16px]" inputMode="tel" value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} /></label>
      </div>
    </ModalShell>
  );
}
