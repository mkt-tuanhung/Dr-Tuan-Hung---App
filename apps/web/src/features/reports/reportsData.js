// ============================================================
// DỮ LIỆU BÁO CÁO & PHÂN TÍCH (Ethics D11 "Báo cáo / BI")
// - Tính kỳ báo cáo + kỳ so sánh (kỳ liền trước, CÙNG SỐ NGÀY)
// - Tải dữ liệu có giới hạn ngày, phân trang 1000 dòng/lần (PostgREST cắt ở 1000)
// - Gộp số liệu: chỉ số tổng, chuỗi biểu đồ, top dịch vụ, nguồn khách, hiệu suất nhân sự
// RLS tự giới hạn dữ liệu theo vai trò (admin / kế toán / cổ đông xem toàn bộ).
// ============================================================
import { supabase } from '@/lib/supabaseClient';
import { vnToday } from '@/lib/vnTime';
import { isRecheck } from '@/lib/kpiCalc';

// Doanh thu = cột revenue (giống "Doanh thu" ở Tổng quan Admin; KPI Sale coi upsale là
// MỘT PHẦN của revenue: phần cơ bản = revenue - upsale_revenue). Đổi thành true nếu
// muốn cộng thêm upsale_revenue.
export const ADD_UPSALE = false;
export const revenueOf = (a) => Number(a.revenue || 0) + (ADD_UPSALE ? Number(a.upsale_revenue || 0) : 0);

// ---------- Ngày dạng chuỗi 'YYYY-MM-DD' (tính theo UTC để không lệch múi giờ máy) ----------
const D = (s) => new Date(`${s}T00:00:00Z`);
const S = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return S(d); };
export const diffDays = (a, b) => Math.round((D(b) - D(a)) / 864e5); // b - a
const pad = (n) => String(n).padStart(2, '0');
const monthFirst = (y, m) => S(new Date(Date.UTC(y, m, 1)));     // m: 0-11, tự tràn năm
const monthLast = (y, m) => S(new Date(Date.UTC(y, m + 1, 0)));
export const fmtDay = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
export const fmtDayShort = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');

export const PERIODS = [
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'this_quarter', label: 'Quý này' },
  { value: 'last_6m', label: '6 tháng' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'custom', label: 'Tuỳ chọn' },
];
export const periodLabel = (v) => PERIODS.find(p => p.value === v)?.label || v;

// Kỳ hiện tại + kỳ trước cùng độ dài. Các kỳ "đang chạy" tính đến HÔM NAY để so sánh công bằng.
export function computeRange(period, customFrom, customTo, today = vnToday()) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  let from;
  let to = today;
  switch (period) {
    case 'last_month': from = monthFirst(y, m - 1); to = monthLast(y, m - 1); break;
    case 'this_quarter': from = monthFirst(y, Math.floor(m / 3) * 3); break;
    case 'last_6m': from = monthFirst(y, m - 5); break;
    case 'this_year': from = `${y}-01-01`; break;
    case 'custom': {
      from = customFrom || monthFirst(y, m);
      to = customTo || today;
      if (from > to) [from, to] = [to, from];
      break;
    }
    default: from = monthFirst(y, m);
  }
  const len = diffDays(from, to) + 1;
  return {
    from, to, len,
    prevFrom: addDays(from, -len), prevTo: addDays(from, -1),
    gran: len <= 62 ? 'day' : 'month',
  };
}

// Các ô thời gian của biểu đồ (theo ngày hoặc theo tháng)
export function buildBuckets(range) {
  const out = [];
  if (range.gran === 'day') {
    for (let i = 0; i < range.len; i++) {
      const ds = addDays(range.from, i);
      out.push({ key: ds, label: fmtDayShort(ds) });
    }
    return out;
  }
  const multiYear = range.from.slice(0, 4) !== range.to.slice(0, 4);
  let y = Number(range.from.slice(0, 4));
  let mo = Number(range.from.slice(5, 7));
  const endKey = range.to.slice(0, 7);
  for (let guard = 0; guard < 240; guard++) {
    const key = `${y}-${pad(mo)}`;
    out.push({ key, label: multiYear ? `T${mo}/${String(y).slice(2)}` : `T${mo}` });
    if (key >= endKey) break;
    mo += 1; if (mo > 12) { mo = 1; y += 1; }
  }
  return out;
}
// Khoá ô cho 1 ngày; kỳ trước được DỜI sang trục kỳ này (cộng len ngày) để vẽ chồng
export const bucketKey = (range, ds, isPrev = false) => {
  const d = isPrev ? addDays(ds, range.len) : ds;
  return range.gran === 'day' ? d : d.slice(0, 7);
};

// ---------- Tải dữ liệu ----------
const PAGE = 1000;
const MAX_PAGES = 20; // tối đa 20.000 dòng / truy vấn
async function fetchAll(build) {
  const out = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await build().range(p * PAGE, p * PAGE + PAGE - 1);
    if (error) return { data: out, error, capped: false };
    out.push(...(data || []));
    if (!data || data.length < PAGE) return { data: out, error: null, capped: false };
  }
  return { data: out, error: null, capped: true };
}

const isMissingColumn = (e) => !!e && (e.code === '42703' || /column .* does not exist|getfly_created_at|schema cache/i.test(e.message || ''));
export const isPermissionError = (e) => !!e && (e.code === '42501' || /permission denied|row-level security/i.test(e.message || ''));

// Khách mới (Data KH): ưu tiên ngày tạo bên GetFly (giống trang Data khách hàng — arrivedAt)
async function fetchLeads(fromDay, toDay) {
  const lo = `${fromDay}T00:00:00+07:00`;
  const hi = `${addDays(toDay, 1)}T00:00:00+07:00`;
  const [a, b] = await Promise.all([
    fetchAll(() => supabase.from('marketing_data').select('id, getfly_created_at, created_at, source')
      .gte('getfly_created_at', lo).lt('getfly_created_at', hi).order('id')),
    fetchAll(() => supabase.from('marketing_data').select('id, getfly_created_at, created_at, source')
      .is('getfly_created_at', null).gte('created_at', lo).lt('created_at', hi).order('id')),
  ]);
  const err = a.error || b.error;
  if (err && isMissingColumn(err)) {
    // Chưa chạy marketing_data_getfly_full.sql -> chỉ có created_at, không có nguồn
    const c = await fetchAll(() => supabase.from('marketing_data').select('id, created_at')
      .gte('created_at', lo).lt('created_at', hi).order('id'));
    return { rows: c.data, error: c.error, capped: c.capped, hasSource: false };
  }
  return { rows: [...a.data, ...b.data], error: err, capped: a.capped || b.capped, hasSource: true };
}

export async function loadReportData(range) {
  const lo = range.prevFrom;
  const hi = range.to;
  const [appts, surg, deps, leads, prof] = await Promise.all([
    fetchAll(() => supabase.from('customer_appointments')
      .select('id, appointment_date, status, service, sale_id, telesale_id, telesale_id_2, customer_source')
      .gte('appointment_date', lo).lte('appointment_date', hi).order('id')),
    fetchAll(() => supabase.from('customer_appointments')
      .select('id, surgery_date, revenue, upsale_revenue, service, customer_source, sale_id, telesale_id, telesale_id_2')
      .eq('status', 'phau_thuat').gte('surgery_date', lo).lte('surgery_date', hi).order('id')),
    fetchAll(() => supabase.from('customer_appointments')
      .select('id, deposit_date, deposit_amount, service, sale_id, telesale_id, telesale_id_2')
      .gte('deposit_date', lo).lte('deposit_date', hi).order('id')),
    fetchLeads(lo, hi),
    supabase.from('profiles').select('id, full_name, employee_id, role, role_2, avatar_url').limit(2000),
  ]);
  const error = appts.error || surg.error || deps.error;
  return {
    error,
    capped: appts.capped || surg.capped || deps.capped || leads.capped,
    appts: (appts.data || []).filter(a => !isRecheck(a)),
    surgeries: (surg.data || []).filter(a => !isRecheck(a)),
    deposits: (deps.data || []).filter(a => !isRecheck(a)),
    leads: (leads.rows || []).map(r => ({ day: vnToday(new Date(r.getfly_created_at || r.created_at)), source: r.source })),
    leadsError: leads.error,
    leadsHasSource: leads.hasSource && !leads.error,
    profiles: prof.data || [],
  };
}

// ---------- Gộp số liệu ----------
const inRange = (ds, from, to) => !!ds && ds >= from && ds <= to;

export function summarize(data, from, to) {
  const ap = data.appts.filter(a => inRange(a.appointment_date, from, to));
  const su = data.surgeries.filter(a => inRange(a.surgery_date, from, to));
  const de = data.deposits.filter(a => inRange(a.deposit_date, from, to));
  const le = data.leads.filter(l => inRange(l.day, from, to));
  const revenue = su.reduce((s, a) => s + revenueOf(a), 0);
  return {
    revenue,
    upsale: su.reduce((s, a) => s + Number(a.upsale_revenue || 0), 0),
    surgeries: su.length,
    appts: ap.length,
    deposits: de.length,
    depositAmount: de.reduce((s, a) => s + Number(a.deposit_amount || 0), 0),
    leads: le.length,
    closeRate: ap.length ? (su.length / ap.length) * 100 : null,
  };
}

export const METRICS = [
  { value: 'revenue', label: 'Doanh thu', unit: 'đ' },
  { value: 'leads', label: 'Khách mới', unit: 'khách' },
  { value: 'appts', label: 'Lịch hẹn', unit: 'lịch' },
  { value: 'surgeries', label: 'Ca phẫu thuật', unit: 'ca' },
];

export function buildSeries(data, range, metric) {
  const buckets = buildBuckets(range);
  const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
  const rows = buckets.map(b => ({ ...b, cur: 0, prev: 0 }));
  const add = (ds, v) => {
    if (!ds) return;
    let field = null;
    let key = null;
    if (inRange(ds, range.from, range.to)) { field = 'cur'; key = bucketKey(range, ds); }
    else if (inRange(ds, range.prevFrom, range.prevTo)) { field = 'prev'; key = bucketKey(range, ds, true); }
    if (field && idx[key] !== undefined) rows[idx[key]][field] += v;
  };
  if (metric === 'revenue') data.surgeries.forEach(a => add(a.surgery_date, revenueOf(a)));
  else if (metric === 'surgeries') data.surgeries.forEach(a => add(a.surgery_date, 1));
  else if (metric === 'appts') data.appts.forEach(a => add(a.appointment_date, 1));
  else if (metric === 'leads') data.leads.forEach(l => add(l.day, 1));
  return rows;
}

const clean = (s, fallback) => String(s || '').trim() || fallback;

export function topServices(data, from, to) {
  const map = {};
  data.surgeries.filter(a => inRange(a.surgery_date, from, to)).forEach(a => {
    const name = clean(a.service, 'Chưa ghi dịch vụ');
    map[name] = map[name] || { name, revenue: 0, count: 0 };
    map[name].revenue += revenueOf(a);
    map[name].count += 1;
  });
  return Object.values(map);
}

export function sourceBreakdown(data, from, to, mode) {
  const map = {};
  if (mode === 'leads') {
    data.leads.filter(l => inRange(l.day, from, to)).forEach(l => {
      const name = clean(l.source, 'Chưa rõ nguồn');
      map[name] = map[name] || { name, count: 0, revenue: 0 };
      map[name].count += 1;
    });
  } else {
    data.surgeries.filter(a => inRange(a.surgery_date, from, to)).forEach(a => {
      const name = clean(a.customer_source, 'Chưa rõ nguồn');
      map[name] = map[name] || { name, count: 0, revenue: 0 };
      map[name].count += 1;
      map[name].revenue += revenueOf(a);
    });
  }
  return Object.values(map).sort((x, y) => y.count - x.count || y.revenue - x.revenue);
}

const peopleOf = (a) => [...new Set([a.sale_id, a.telesale_id, a.telesale_id_2].filter(Boolean))];
export const STAFF_ROLE = {
  sale_offline: { label: 'Sale Offline', tone: 'e-tone-info' },
  telesale: { label: 'Telesale', tone: 'e-tone-lavender' },
};
// Vai trò bán hàng của 1 nhân sự (role chính trước, rồi role_2)
const salesRoleOf = (p) => [p?.role, p?.role_2].find(r => STAFF_ROLE[r]) || null;

// Hiệu suất từng sale / telesale: lịch hẹn, cọc, phẫu thuật, doanh thu, tỷ lệ chốt.
// Một khách có cả sale + telesale thì ghi nhận cho CẢ HAI người.
export function staffPerformance(data, from, to) {
  const prof = Object.fromEntries(data.profiles.map(p => [p.id, p]));
  const map = {};
  const row = (id) => {
    if (!map[id]) {
      const p = prof[id];
      map[id] = {
        id, name: p?.full_name || 'Nhân sự (không xem được tên)', employeeId: p?.employee_id || '',
        avatar: p?.avatar_url || null, role: salesRoleOf(p),
        appts: 0, deposits: 0, depositAmount: 0, surgeries: 0, revenue: 0,
      };
    }
    return map[id];
  };
  data.appts.filter(a => inRange(a.appointment_date, from, to)).forEach(a => peopleOf(a).forEach(id => { row(id).appts += 1; }));
  data.deposits.filter(a => inRange(a.deposit_date, from, to)).forEach(a => peopleOf(a).forEach(id => {
    const r = row(id); r.deposits += 1; r.depositAmount += Number(a.deposit_amount || 0);
  }));
  data.surgeries.filter(a => inRange(a.surgery_date, from, to)).forEach(a => peopleOf(a).forEach(id => {
    const r = row(id); r.surgeries += 1; r.revenue += revenueOf(a);
  }));
  return Object.values(map).map(r => ({ ...r, closeRate: r.appts ? (r.surgeries / r.appts) * 100 : null }));
}
