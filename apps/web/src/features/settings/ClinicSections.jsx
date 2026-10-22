// ============================================================
// CÀI ĐẶT › THÔNG TIN PHÒNG KHÁM + GIỜ LÀM VIỆC & CHẤM CÔNG
// Cả hai mục cùng ghi vào 1 dòng của bảng clinic_settings (supabase/clinic_settings.sql),
// mỗi mục chỉ lưu đúng các cột của mình.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Building2, CalendarClock, Info, Plus, Trash2, Wifi, Copy, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getPublicIP } from '@/lib/geo';
import { AlertStrip } from '@/components/ds';
import { SectionHeader, Field, SaveBar } from './settingsShared.jsx';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Báo cho trang cha biết mục đang có thay đổi chưa lưu (để chặn chuyển mục)
function useReportDirty(dirty, onDirtyChange) {
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
}

// ---------------- 1. THÔNG TIN PHÒNG KHÁM ----------------
const INFO_KEYS = ['clinic_name', 'legal_name', 'tax_code', 'hotline', 'email', 'website', 'address', 'logo_url'];
const pickInfo = (row) => Object.fromEntries(INFO_KEYS.map(k => [k, row?.[k] ?? (k === 'clinic_name' ? 'Phòng khám Dr Tuấn Hùng' : '')]));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+().\s-]{8,20}$/;
const URL_RE = /^https?:\/\/\S+$/i;

export function ClinicInfoSection({ settings, readOnly, onDirtyChange }) {
  const base = useMemo(() => pickInfo(settings.row), [settings.row]);
  const [form, setForm] = useState(base);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(base); }, [base]);
  const dirty = !same(form, base);
  useReportDirty(dirty, onDirtyChange);

  const errors = {
    clinic_name: !form.clinic_name.trim() ? 'Bắt buộc nhập tên phòng khám' : null,
    email: form.email.trim() && !EMAIL_RE.test(form.email.trim()) ? 'Email không hợp lệ' : null,
    hotline: form.hotline.trim() && !PHONE_RE.test(form.hotline.trim()) ? 'Số điện thoại không hợp lệ' : null,
    website: form.website.trim() && !URL_RE.test(form.website.trim()) ? 'Cần bắt đầu bằng http:// hoặc https://' : null,
    logo_url: form.logo_url.trim() && !URL_RE.test(form.logo_url.trim()) ? 'Cần là đường dẫn http(s) tới ảnh' : null,
    tax_code: form.tax_code.trim() && !/^[0-9-]{10,14}$/.test(form.tax_code.trim()) ? 'Mã số thuế gồm 10 hoặc 13 chữ số' : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const onSave = async () => {
    setSaving(true);
    const patch = Object.fromEntries(INFO_KEYS.map(k => [k, k === 'clinic_name' ? form[k].trim() : (form[k].trim() || null)]));
    const { error } = await settings.save(patch, 'Cập nhật thông tin phòng khám');
    setSaving(false);
    if (error) { toast.error(`Không lưu được: ${error.message}`); return; }
    toast.success('Đã lưu thông tin phòng khám');
  };

  return (
    <div>
      <SectionHeader icon={Building2} title="Thông tin phòng khám"
        desc="Tên, pháp nhân và liên hệ của phòng khám — dùng làm thông tin chung khi in phiếu, gửi tin cho khách." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên phòng khám" required error={errors.clinic_name}>
          <input className="e-input" value={form.clinic_name} onChange={set('clinic_name')} disabled={readOnly} maxLength={120} />
        </Field>
        <Field label="Tên pháp lý (trên hoá đơn)">
          <input className="e-input" value={form.legal_name} onChange={set('legal_name')} disabled={readOnly} maxLength={200} placeholder="VD: Công ty TNHH …" />
        </Field>
        <Field label="Mã số thuế" error={errors.tax_code}>
          <input className="e-input" value={form.tax_code} onChange={set('tax_code')} disabled={readOnly} inputMode="numeric" maxLength={14} />
        </Field>
        <Field label="Hotline" error={errors.hotline}>
          <input className="e-input" value={form.hotline} onChange={set('hotline')} disabled={readOnly} inputMode="tel" maxLength={20} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="e-input" type="email" value={form.email} onChange={set('email')} disabled={readOnly} maxLength={120} />
        </Field>
        <Field label="Website" error={errors.website}>
          <input className="e-input" value={form.website} onChange={set('website')} disabled={readOnly} placeholder="https://…" maxLength={200} />
        </Field>
        <Field label="Địa chỉ" className="sm:col-span-2">
          <input className="e-input" value={form.address} onChange={set('address')} disabled={readOnly} maxLength={300} />
        </Field>
        <Field label="Logo (đường dẫn ảnh)" className="sm:col-span-2" error={errors.logo_url} hint="Dán link ảnh logo (PNG/SVG) đã tải lên kho ảnh.">
          <div className="flex items-center gap-3">
            <input className="e-input" value={form.logo_url} onChange={set('logo_url')} disabled={readOnly} placeholder="https://…/logo.png" maxLength={500} />
            {form.logo_url && !errors.logo_url && (
              <img src={form.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-contain border border-slate-200 bg-white shrink-0" />
            )}
          </div>
        </Field>
      </div>
      {settings.row?.updated_at && (
        <div className="text-[12px] text-slate-400 mt-4">Cập nhật lần cuối: {new Date(settings.row.updated_at).toLocaleString('vi-VN')}</div>
      )}
      {!readOnly && <SaveBar dirty={dirty} saving={saving} disabled={invalid} onReset={() => setForm(base)} onSave={onSave} />}
    </div>
  );
}

// ---------------- 2. GIỜ LÀM VIỆC & CHẤM CÔNG ----------------
export const WEEKDAYS = [
  ['mon', 'Thứ 2'], ['tue', 'Thứ 3'], ['wed', 'Thứ 4'], ['thu', 'Thứ 5'],
  ['fri', 'Thứ 6'], ['sat', 'Thứ 7'], ['sun', 'Chủ nhật'],
];
const DEFAULT_DAY = { open: '08:00', close: '20:00', closed: false };
const pickHours = (row) => {
  const wh = row?.working_hours && typeof row.working_hours === 'object' ? row.working_hours : {};
  return {
    working_hours: Object.fromEntries(WEEKDAYS.map(([k]) => [k, {
      open: wh[k]?.open || DEFAULT_DAY.open,
      close: wh[k]?.close || DEFAULT_DAY.close,
      closed: !!wh[k]?.closed,
    }])),
    late_grace_minutes: String(row?.late_grace_minutes ?? 0),
    payroll_standard_days: String(row?.payroll_standard_days ?? 26),
    office_ips: Array.isArray(row?.office_ips) ? row.office_ips : [],
  };
};

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;
export const ipError = (ip, list) => {
  const v = ip.trim();
  if (!v) return 'Nhập địa chỉ IP';
  if (!(IPV4_RE.test(v) || (v.includes(':') && IPV6_RE.test(v) && v.length <= 39))) return 'IP không hợp lệ (VD: 42.114.215.104)';
  if (list.includes(v)) return 'IP này đã có trong danh sách';
  return null;
};

export function WorkHoursSection({ settings, readOnly, onDirtyChange }) {
  const base = useMemo(() => pickHours(settings.row), [settings.row]);
  const [form, setForm] = useState(base);
  const [saving, setSaving] = useState(false);
  const [ipDraft, setIpDraft] = useState('');
  const [ipTouched, setIpTouched] = useState(false);
  const [fetchingIp, setFetchingIp] = useState(false);
  const [face, setFace] = useState(null); // cấu hình đang chạy của chấm công Face ID
  useEffect(() => { setForm(base); }, [base]);
  useEffect(() => {
    supabase.from('face_config').select('work_start, late_grace_min, office_ips, location_rule').eq('id', 1).maybeSingle()
      .then(({ data }) => setFace(data || null));
  }, []);
  // Công tắc TẠM TẮT kiểm tra vị trí / Wi-Fi (face_config.location_rule: 'off' <-> 'warn')
  const [locSaving, setLocSaving] = useState(false);
  const toggleLocationOff = async () => {
    const next = face?.location_rule === 'off' ? 'warn' : 'off';
    setLocSaving(true);
    const { data, error } = await supabase.from('face_config').update({ location_rule: next }).eq('id', 1).select('location_rule');
    setLocSaving(false);
    if (error || !data?.length) { toast.error('Không lưu được: ' + (error?.message || 'cần quyền Admin')); return; }
    setFace(f => ({ ...f, location_rule: next }));
    toast.success(next === 'off' ? 'Đã TẮT kiểm tra vị trí & Wi‑Fi — mọi lần chấm công đều hợp lệ' : 'Đã BẬT lại kiểm tra vị trí & Wi‑Fi');
  };
  const dirty = !same(form, base);
  useReportDirty(dirty, onDirtyChange);

  const dayErrors = Object.fromEntries(WEEKDAYS.map(([k]) => {
    const d = form.working_hours[k];
    return [k, !d.closed && (!d.open || !d.close || d.open >= d.close) ? 'Giờ đóng cửa phải sau giờ mở cửa' : null];
  }));
  const grace = Number(form.late_grace_minutes);
  const stdDays = Number(form.payroll_standard_days);
  const graceErr = !/^\d+$/.test(form.late_grace_minutes) || grace > 240 ? 'Từ 0 đến 240 phút' : null;
  const stdErr = !/^\d+$/.test(form.payroll_standard_days) || stdDays < 20 || stdDays > 31 ? 'Từ 20 đến 31 công' : null;
  const invalid = !!graceErr || !!stdErr || Object.values(dayErrors).some(Boolean);
  const ipErr = ipTouched ? ipError(ipDraft, form.office_ips) : null;

  const setDay = (k, patch) => setForm(f => ({ ...f, working_hours: { ...f.working_hours, [k]: { ...f.working_hours[k], ...patch } } }));
  const copyMonday = () => setForm(f => ({ ...f, working_hours: Object.fromEntries(WEEKDAYS.map(([k]) => [k, { ...f.working_hours.mon }])) }));
  const addIp = (raw) => {
    const v = (raw ?? ipDraft).trim();
    const err = ipError(v, form.office_ips);
    if (err) { setIpTouched(true); if (raw) toast.error(err); return; }
    setForm(f => ({ ...f, office_ips: [...f.office_ips, v] }));
    setIpDraft(''); setIpTouched(false);
  };
  const addCurrentIp = async () => {
    setFetchingIp(true);
    const ip = await getPublicIP();
    setFetchingIp(false);
    if (!ip) { toast.error('Không lấy được IP mạng hiện tại'); return; }
    addIp(ip);
  };

  const onSave = async () => {
    setSaving(true);
    const { error } = await settings.save({
      working_hours: form.working_hours,
      late_grace_minutes: grace,
      payroll_standard_days: stdDays,
      office_ips: form.office_ips,
    }, 'Cập nhật giờ làm việc & chấm công');
    setSaving(false);
    if (error) { toast.error(`Không lưu được: ${error.message}`); return; }
    toast.success('Đã lưu giờ làm việc & chấm công');
  };

  return (
    <div>
      <SectionHeader icon={CalendarClock} title="Giờ làm việc & chấm công"
        desc="Giờ mở cửa theo thứ, thời gian ân hạn đi muộn, công chuẩn tháng và IP mạng văn phòng." />

      <AlertStrip tone="info">
        <b>Lưu ý — hiện là thông tin tham khảo.</b> Các màn khác CHƯA đọc những giá trị này:
        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[13px]">
          <li>Bảng lương vẫn dùng công chuẩn cố định <b>26</b> trong mã (hằng số STANDARD_DAYS).</li>
          <li>Chấm công GPS/IP và trang Quản lý chấm công vẫn dùng danh sách IP cố định trong mã (OFFICE_IPS).</li>
          <li>Chấm công GPS tính đi muộn sau <b>09:00</b> (cố định trong mã). Chấm công Face ID dùng cấu hình riêng bên dưới.</li>
          <li>Giờ mở cửa chưa được màn Lịch hẹn dùng để chặn giờ đặt lịch.</li>
        </ul>
      </AlertStrip>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="e-caption">Giờ mở cửa</div>
          {!readOnly && <button type="button" className="e-btn e-btn-ghost e-btn-sm" onClick={copyMonday}><Copy />Áp dụng giờ Thứ 2 cho cả tuần</button>}
        </div>
        <div className="e-subtle divide-y divide-slate-100">
          {WEEKDAYS.map(([k, label]) => {
            const d = form.working_hours[k];
            return (
              <div key={k} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                <div className="w-20 text-[14px] font-semibold text-slate-700">{label}</div>
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-600 w-28">
                  <input type="checkbox" className="e-checkbox" checked={!d.closed} disabled={readOnly}
                    onChange={(e) => setDay(k, { closed: !e.target.checked })} />
                  {d.closed ? 'Nghỉ' : 'Mở cửa'}
                </label>
                {!d.closed && (
                  <div className="flex items-center gap-2">
                    <input type="time" className="e-input w-[120px]" value={d.open} disabled={readOnly} aria-label={`${label} mở cửa`}
                      onChange={(e) => setDay(k, { open: e.target.value })} />
                    <span className="text-slate-400">–</span>
                    <input type="time" className="e-input w-[120px]" value={d.close} disabled={readOnly} aria-label={`${label} đóng cửa`}
                      onChange={(e) => setDay(k, { close: e.target.value })} />
                  </div>
                )}
                {dayErrors[k] && <span className="text-[12px] text-danger-600">{dayErrors[k]}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mt-5">
        <Field label="Ân hạn đi muộn (phút)" error={graceErr} hint="VD ca 08:30, ân hạn 5 phút → sau 08:35 mới tính muộn">
          <input className="e-input" inputMode="numeric" value={form.late_grace_minutes} disabled={readOnly}
            onChange={(e) => setForm(f => ({ ...f, late_grace_minutes: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
        </Field>
        <Field label="Công chuẩn / tháng" error={stdErr} hint="Lương theo công = lương cơ bản ÷ công chuẩn × số công">
          <input className="e-input" inputMode="numeric" value={form.payroll_standard_days} disabled={readOnly}
            onChange={(e) => setForm(f => ({ ...f, payroll_standard_days: e.target.value.replace(/\D/g, '').slice(0, 2) }))} />
        </Field>
      </div>

      <div className="mt-5">
        <div className="e-caption mb-2">IP mạng văn phòng</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {form.office_ips.length === 0 && <span className="text-[13px] text-slate-400">Chưa có IP nào — để trống nghĩa là không kiểm tra IP.</span>}
          {form.office_ips.map(ip => (
            <span key={ip} className="e-chip !h-8 font-mono">
              <Wifi className="w-3.5 h-3.5 text-teal-600" />{ip}
              {!readOnly && (
                <button type="button" aria-label={`Xoá IP ${ip}`} className="ml-1 text-slate-400 hover:text-danger-600"
                  onClick={() => setForm(f => ({ ...f, office_ips: f.office_ips.filter(x => x !== ip) }))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <input className="e-input font-mono" value={ipDraft} placeholder="VD: 42.114.215.104" maxLength={39}
                onChange={(e) => { setIpDraft(e.target.value); setIpTouched(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIp(); } }} />
              {ipErr && <span className="block text-[12px] text-danger-600 mt-1">{ipErr}</span>}
            </div>
            <button type="button" className="e-btn e-btn-secondary" onClick={() => addIp()}><Plus />Thêm IP</button>
            <button type="button" className="e-btn e-btn-ghost" onClick={addCurrentIp} disabled={fetchingIp}>
              <Wifi />{fetchingIp ? 'Đang lấy IP…' : 'Thêm IP mạng đang dùng'}
            </button>
          </div>
        )}
      </div>

      {face && (
        <div className="e-subtle px-4 py-3 mt-5 text-[13px] text-slate-600">
          <div className="flex items-center gap-2 font-semibold text-slate-700 mb-1"><Info className="w-4 h-4 text-teal-600" />Đang áp dụng cho chấm công Face ID (bảng face_config)</div>
          Giờ vào ca <b>{String(face.work_start || '').slice(0, 5) || '—'}</b> · ân hạn <b>{face.late_grace_min ?? 0} phút</b> ·
          {' '}{Array.isArray(face.office_ips) ? face.office_ips.length : 0} IP văn phòng ·
          {' '}sai vị trí: <b>{face.location_rule === 'off' ? 'ĐANG TẮT kiểm tra — mọi lần chấm đều hợp lệ' : face.location_rule === 'require' ? 'từ chối ghi công' : 'vẫn ghi công + cảnh báo'}</b>.
          <div className="text-[12px] text-slate-400 mt-1">Cấu hình này nằm riêng trong face_config, không đổi theo các ô ở trên.</div>
        </div>
      )}

      {face && !readOnly && (
        <div className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${face.location_rule === 'off' ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
          <MapPin className={`w-5 h-5 shrink-0 ${face.location_rule === 'off' ? 'text-amber-600' : 'text-teal-600'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-slate-800">Tạm tắt kiểm tra vị trí & Wi‑Fi khi chấm công</div>
            <div className="text-[12.5px] text-slate-500">
              {face.location_rule === 'off'
                ? 'Đang tắt: mọi lần check-in / check-out đều tính hợp lệ, không cảnh báo sai vị trí hay sai Wi‑Fi.'
                : 'Bật lên khi cần: nhân sự chấm công ở đâu cũng tính hợp lệ (Face ID và bấm nút).'}
            </div>
          </div>
          <button type="button" role="switch" aria-checked={face.location_rule === 'off'} aria-label="Tạm tắt kiểm tra vị trí và Wi-Fi" disabled={locSaving} onClick={toggleLocationOff}
            className={`relative shrink-0 w-11 h-6 rounded-full transition ${face.location_rule === 'off' ? 'bg-amber-500' : 'bg-slate-300'} disabled:opacity-60`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${face.location_rule === 'off' ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      )}

      {!readOnly && <SaveBar dirty={dirty} saving={saving} disabled={invalid} onReset={() => { setForm(base); setIpDraft(''); setIpTouched(false); }} onSave={onSave} />}
    </div>
  );
}
