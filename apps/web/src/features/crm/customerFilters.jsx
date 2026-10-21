// ============================================================
// BỘ LỌC KHÁCH DÙNG CHUNG cho các màn danh sách khách
// (Lịch hẹn, Khách tư vấn, Khách cọc, Khách bong, Khách phẫu thuật, Hậu phẫu…)
//   const f = useCustomerFilters();
//   const shown = applyCustomerFilters(rows, f, { allowPhone });
//   <CustomerFilterBar f={f} rows={rows} allowPhone={…} />
// - Tìm: tên (không dấu cũng được) hoặc SĐT (gõ vài số bất kỳ)
// - Dịch vụ: tách từ ô dịch vụ ("Gọt hàm - nâng ngực" -> Gọt hàm, Nâng ngực)
// - Nhóm dịch vụ: Hàm mặt / Body / Tiểu phẫu / …
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { FilterSelect, SearchInput } from '@/components/ds';

export const SERVICE_GROUPS = ['Hàm mặt', 'Body', 'Tiểu phẫu'];
const NO_GROUP = '__none';

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const phoneKey = (s) => { const d = digits(s); return d.startsWith('84') ? `0${d.slice(2)}` : d; };

// Chữ dịch vụ của 1 dòng: bỏ tiền tố "[Tái khám]", gộp thêm "dịch vụ đã dùng" (lịch tái khám)
export const serviceText = (r) => [String(r?.service || '').replace(/^\[Tái khám\]\s*/i, ''), r?.used_service]
  .filter(Boolean).join(' · ');
const splitServices = (s) => String(s || '')
  .split(/\s*[,;+/|·&]\s*|\s+-\s*|\s*-\s+|\s+và\s+/i)
  .map(x => x.trim().replace(/^[-–.\s]+|[-–.\s]+$/g, ''))
  .filter(x => x.length >= 2);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Danh sách lựa chọn "Dịch vụ" lấy từ dữ liệu đang có, xếp theo số khách nhiều nhất
export function serviceOptions(rows, max = 80) {
  const map = new Map(); // key -> { count, labels: Map(label -> n) }
  (rows || []).forEach(r => {
    const seen = new Set();
    splitServices(serviceText(r)).forEach(part => {
      const k = norm(part);
      if (!k || seen.has(k)) return;
      seen.add(k);
      const e = map.get(k) || { count: 0, labels: new Map() };
      e.count += 1;
      e.labels.set(part, (e.labels.get(part) || 0) + 1);
      map.set(k, e);
    });
  });
  return [...map.entries()]
    .map(([k, e]) => ({ value: k, label: cap([...e.labels.entries()].sort((a, b) => b[1] - a[1])[0][0]), count: e.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'))
    .slice(0, max)
    .map(o => ({ value: o.value, label: `${o.label} (${o.count})` }));
}

export function groupOptions(rows) {
  const extra = new Set();
  let none = 0;
  (rows || []).forEach(r => {
    const g = (r?.service_group || '').trim();
    if (!g) none += 1; else if (!SERVICE_GROUPS.includes(g)) extra.add(g);
  });
  return [
    ...SERVICE_GROUPS.map(g => ({ value: g, label: g })),
    ...[...extra].sort((a, b) => a.localeCompare(b, 'vi')).map(g => ({ value: g, label: g })),
    ...(none ? [{ value: NO_GROUP, label: 'Chưa có nhóm' }] : []),
  ];
}

// Khớp ô tìm: tên (bỏ dấu) hoặc SĐT (từ 3 số). allowPhone=false -> chỉ tìm theo tên (Sale Offline)
export function matchCustomer(r, q, { allowPhone = true, nameKeys = ['customer_name'], phoneKeys = ['phone'] } = {}) {
  const t = norm(q);
  if (!t) return true;
  if (nameKeys.some(k => norm(r?.[k]).includes(t))) return true;
  const d = phoneKey(q);
  if (allowPhone && d.length >= 3) return phoneKeys.some(k => phoneKey(r?.[k]).includes(d));
  return false;
}

export function applyCustomerFilters(rows, f, opts = {}) {
  const { q = '', service = '', group = '' } = f || {};
  if (!q.trim() && !service && !group) return rows || [];
  return (rows || []).filter(r => {
    if (!matchCustomer(r, q, opts)) return false;
    if (service && !norm(serviceText(r)).includes(service)) return false;
    if (group) {
      const g = (r?.service_group || '').trim();
      if (group === NO_GROUP ? g : g !== group) return false;
    }
    return true;
  });
}

export function useCustomerFilters(initial = {}) {
  const [q, setQ] = useState(initial.q || '');
  const [service, setService] = useState(initial.service || '');
  const [group, setGroup] = useState(initial.group || '');
  return useMemo(() => ({
    q, setQ, service, setService, group, setGroup,
    active: !!(q.trim() || service || group),
    reset: () => { setQ(''); setService(''); setGroup(''); },
  }), [q, service, group]);
}

// Thanh lọc: ô tìm (hàng riêng trên điện thoại) + Dịch vụ + Nhóm DV + Xoá lọc
export function CustomerFilterBar({ f, rows, allowPhone = true, placeholder, showGroup = true, showService = true, count, className = '' }) {
  const svcOpts = useMemo(() => (showService ? serviceOptions(rows) : []), [rows, showService]);
  const grpOpts = useMemo(() => (showGroup ? groupOptions(rows) : []), [rows, showGroup]);
  // Giữ lựa chọn đang chọn trong danh sách kể cả khi không còn dòng nào khớp
  const svcList = f.service && !svcOpts.some(o => o.value === f.service) ? [{ value: f.service, label: f.service }, ...svcOpts] : svcOpts;
  return (
    <div className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 ${className}`}>
      <SearchInput value={f.q} onChange={f.setQ}
        placeholder={placeholder || (allowPhone ? 'Tìm tên hoặc số điện thoại…' : 'Tìm tên khách…')}
        className="w-full sm:w-80 [&_input]:max-lg:!h-11 [&_input]:max-lg:!text-[16px]" />
      <div className="flex items-center gap-2 min-w-0">
        {showService && (
          <FilterSelect label="Dịch vụ" allLabel="Tất cả dịch vụ" value={f.service} onChange={f.setService} options={svcList}
            className="flex-1 min-w-0 sm:!min-w-[190px] sm:max-w-[260px] [&_select]:max-lg:!h-11 [&_select]:max-lg:!text-[15px]" />
        )}
        {showGroup && (
          <FilterSelect label="Nhóm dịch vụ" allLabel="Tất cả nhóm" value={f.group} onChange={f.setGroup} options={grpOpts}
            className="flex-1 min-w-0 sm:!min-w-[160px] sm:max-w-[200px] [&_select]:max-lg:!h-11 [&_select]:max-lg:!text-[15px]" />
        )}
        {f.active && (
          <button type="button" onClick={f.reset} title="Xoá lọc"
            className="e-btn e-btn-ghost e-btn-sm shrink-0 h-10 max-lg:h-11 px-2.5 text-slate-500"><X /> <span className="max-sm:hidden">Xoá lọc</span></button>
        )}
      </div>
      {f.active && count != null && <span className="text-[12.5px] text-slate-500 sm:ml-1">{count} kết quả</span>}
    </div>
  );
}

// ---- Tìm trên máy chủ: thấy cả khách NGOÀI khoảng ngày đã tải ----
//   const extra = useServerSearch(f.q, async (safe, digits) => (await supabase…).data);
//   const rows = mergeById(baseRows, extra);
// Kết quả giữ riêng (không bị lượt tải lại realtime xoá), tự xoá khi bỏ ô tìm.
export const mergeById = (base, extra) => {
  if (!extra?.length) return base || [];
  const ids = new Set((base || []).map(x => x.id));
  return [...(base || []), ...extra.filter(x => !ids.has(x.id))];
};
// Điều kiện .or() cho PostgREST: tên chứa chuỗi, hoặc SĐT chứa dãy số (từ 3 số)
export const searchOrCond = (safe, digitsOnly, allowPhone = true) => (
  allowPhone && digitsOnly.length >= 3 ? `customer_name.ilike.%${safe}%,phone.ilike.%${digitsOnly}%` : `customer_name.ilike.%${safe}%`
);
export function useServerSearch(q, fetcher, { minLen = 2, delay = 450 } = {}) {
  const [extra, setExtra] = useState([]);
  const ref = useRef(fetcher);
  ref.current = fetcher;
  useEffect(() => {
    const t = String(q || '').trim();
    if (t.length < minLen) { setExtra([]); return undefined; }
    let alive = true;
    const h = setTimeout(async () => {
      const safe = t.replace(/[%,()*"\\:]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!safe) return;
      try { const rows = await ref.current(safe, safe.replace(/\D/g, '')); if (alive) setExtra(rows || []); } catch { /* lỗi mạng: giữ kết quả cũ */ }
    }, delay);
    return () => { alive = false; clearTimeout(h); };
  }, [q, minLen, delay]);
  return extra;
}
