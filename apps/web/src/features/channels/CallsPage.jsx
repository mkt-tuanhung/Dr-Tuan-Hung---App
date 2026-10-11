// ============================================================
// X06 TỔNG ĐÀI · NHẬT KÝ CUỘC GỌI (theo Ethics CallsPage)
// Dữ liệu: marketing_activities type = 'call' (supabase/marketing_call_care.sql)
//   outcome, content, phone, next_at, data_id -> marketing_data, created_by -> profiles
// Hệ thống CHƯA lưu thời lượng / ghi âm cuộc gọi -> không hiển thị các cột đó.
// RLS (mact_select) tự giới hạn ai được xem nhật ký gọi.
// Bộ lọc Nhân sự áp dụng cho cả chỉ số + biểu đồ; Kết quả / ô tìm chỉ lọc bảng nhật ký.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PhoneCall, Headphones, CalendarClock, PhoneOff, Users, Download, RotateCw, Database, Info,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import { downloadCsv } from '@/lib/csv';
import { vnToday } from '@/lib/vnTime';
import { logAuditEvent } from '@/lib/audit';
import { phoneView, isTelesale } from '@/lib/phoneMask';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { DataTable, FilterBar, FilterSelect, AlertStrip, Drawer, EmptyState, usePageTitle } from '@/components/ds';
import { Customer360Button } from '@/features/crm/Customer360.jsx';

// Nhãn kết quả gọi — chép từ OUTCOMES của MarketingDataPage (giữ đúng mã lưu trong DB)
const OUTCOMES = {
  nghe_may: { label: 'Nghe máy', tone: 'e-tone-success' },
  khong_nghe: { label: 'Không nghe máy', tone: 'e-tone-neutral' },
  may_ban: { label: 'Máy bận', tone: 'e-tone-warning' },
  hen_goi_lai: { label: 'Hẹn gọi lại', tone: 'e-tone-info' },
  can_nhac: { label: 'Đang cân nhắc', tone: 'e-tone-lavender' },
  tu_choi: { label: 'Từ chối', tone: 'e-tone-danger' },
  sai_so: { label: 'Sai số / không liên lạc', tone: 'e-tone-rose' },
};
// Khách bắt máy (đã kết nối được) — dùng cho tỷ lệ "Nghe máy"
const CONNECTED = ['nghe_may', 'hen_goi_lai', 'can_nhac', 'tu_choi'];
const BAD = ['tu_choi', 'sai_so'];

const PRESETS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'month', label: 'Tháng này' },
  { value: 'custom', label: 'Tuỳ chọn' },
];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7h–21h
const PAGE = 1000;     // PostgREST trả tối đa 1000 dòng / lần
const MAX_ROWS = 10000;

// ---- Ngày theo giờ VN, dạng 'YYYY-MM-DD' ----
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const vnHour = (ts) => new Date(new Date(ts).getTime() + 7 * 3600 * 1000).getUTCHours();
const fmtTime = (s) => (s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fmtDay = (s) => s.split('-').reverse().join('/');
const phoneKey = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('84')) d = `0${d.slice(2)}`; return d.slice(-9); };
const custName = (r) => r.khach?.customer_name || '';
const custPhone = (r) => r.khach?.phone || r.phone || '';
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const isMissing = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205'
  || (/marketing_activities/.test(e.message || '') && /does not exist|could not find|schema cache/i.test(e.message || '')));

function rangeOf(preset, custom) {
  const today = vnToday();
  if (preset === 'today') return { from: today, to: today };
  if (preset === '7d') return { from: addDays(today, -6), to: today };
  if (preset === '30d') return { from: addDays(today, -29), to: today };
  if (preset === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  return custom;
}

// Tải hết các dòng trong khoảng (lật trang 1000 dòng / lần)
async function fetchCalls(select, from, to) {
  const out = [];
  for (let start = 0; start < MAX_ROWS; start += PAGE) {
    const { data, error } = await supabase.from('marketing_activities').select(select)
      .eq('type', 'call')
      .gte('created_at', `${from}T00:00:00+07:00`).lt('created_at', `${addDays(to, 1)}T00:00:00+07:00`)
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1);
    if (error) return { data: out, error };
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { data: out, error: null, capped: out.length >= MAX_ROWS };
}

function summarize(rows) {
  const total = rows.length;
  const connected = rows.filter(r => CONNECTED.includes(r.outcome)).length;
  return {
    total,
    connected,
    rate: pct(connected, total),
    callback: rows.filter(r => r.outcome === 'hen_goi_lai').length,
    bad: rows.filter(r => BAD.includes(r.outcome)).length,
    reached: new Set(rows.map(r => phoneKey(r.khach?.phone || r.phone) || r.data_id).filter(Boolean)).size,
  };
}

// Chênh lệch so với kỳ trước; goodDown = giảm là tốt (VD từ chối / sai số)
function Delta({ now, prev, unit = '', goodDown = false }) {
  if (prev == null) return null;
  const d = now - prev;
  if (d === 0) return <span className="text-[12px] font-medium text-slate-400">= kỳ trước</span>;
  const good = goodDown ? d < 0 : d > 0;
  return <span className={good ? 'e-delta-up' : 'e-delta-down'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{unit}</span>;
}

function Metric({ icon: Icon, tone, label, value, hint, delta }) {
  return (
    <div className="e-metric p-3.5 gap-3">
      <div className={`e-metric-icon w-11 h-11 lg:w-11 lg:h-11 ${tone}`}><Icon className="!w-5 !h-5" /></div>
      <div className="min-w-0">
        <div className="e-metric-label">{label}</div>
        <div className="e-metric-value">{value}</div>
        <div className="flex items-center gap-1.5 min-w-0">{delta}<span className="e-metric-hint">{hint}</span></div>
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }) {
  const o = OUTCOMES[outcome];
  return <span className={`e-badge e-badge-sm whitespace-nowrap ${o?.tone || 'e-tone-neutral'}`}>{o?.label || outcome || 'Gọi'}</span>;
}

export default function CallsPage({ onNavigate } = {}) {
  usePageTitle('Tổng đài · Nhật ký cuộc gọi');
  const { profile } = useAuth();

  const [preset, setPreset] = useState('7d');
  const [custom, setCustom] = useState(() => ({ from: addDays(vnToday(), -6), to: vnToday() }));
  const [staff, setStaff] = useState(() => (isTelesale(profile) && profile?.id ? profile.id : ''));
  const [outcome, setOutcome] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [prevRows, setPrevRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  const [capped, setCapped] = useState(false);
  const [detail, setDetail] = useState(null);

  const { from, to } = rangeOf(preset, custom);
  const span = dayDiff(from, to) + 1;
  const prevFrom = addDays(from, -span);
  const prevTo = addDays(from, -1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [cur, prev] = await Promise.all([
      fetchCalls('id, data_id, phone, outcome, content, next_at, created_by, created_at, author:profiles!created_by(full_name), khach:marketing_data!data_id(customer_name, phone)', from, to),
      fetchCalls('id, data_id, phone, outcome, created_by', prevFrom, prevTo),
    ]);
    if (cur.error) {
      const miss = isMissing(cur.error);
      setMissing(miss);
      setError(miss ? null : cur.error);
      setRows([]); setPrevRows(null); setLoading(false); return;
    }
    setMissing(false);
    setRows(cur.data);
    setCapped(!!cur.capped);
    setPrevRows(prev.error ? null : prev.data);
    setLoading(false);
  }, [from, to, prevFrom, prevTo]);

  useEffect(() => { load(); }, [load]);

  // Nhân sự có gọi trong kỳ (+ người đang chọn nếu kỳ này chưa gọi)
  const staffOptions = useMemo(() => {
    const m = new Map();
    rows.forEach(r => { if (r.created_by) m.set(r.created_by, r.author?.full_name || 'Không rõ'); });
    if (staff && !m.has(staff)) m.set(staff, staff === profile?.id ? (profile?.full_name || 'Tôi') : 'Nhân sự đã chọn');
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [rows, staff, profile]);

  const scoped = useMemo(() => (staff ? rows.filter(r => r.created_by === staff) : rows), [rows, staff]);
  const prevScoped = useMemo(() => (prevRows ? (staff ? prevRows.filter(r => r.created_by === staff) : prevRows) : null), [prevRows, staff]);
  const now = useMemo(() => summarize(scoped), [scoped]);
  const before = useMemo(() => (prevScoped ? summarize(prevScoped) : null), [prevScoped]);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const kwDigits = kw.replace(/\D/g, '');
    return scoped.filter(r => {
      if (outcome && r.outcome !== outcome) return false;
      if (!kw) return true;
      if (kwDigits.length >= 3 && String(custPhone(r)).replace(/\D/g, '').includes(kwDigits)) return true;
      return [custName(r), r.content, r.author?.full_name].some(x => String(x || '').toLowerCase().includes(kw));
    });
  }, [scoped, outcome, q]);

  // Biểu đồ theo giờ (7h–21h)
  const hourly = useMemo(() => {
    const b = Object.fromEntries(HOURS.map(h => [h, { hour: `${h}h`, 'Nghe máy': 0, 'Không kết nối': 0 }]));
    let outside = 0;
    scoped.forEach(r => {
      const h = vnHour(r.created_at);
      if (!b[h]) { outside += 1; return; }
      b[h][CONNECTED.includes(r.outcome) ? 'Nghe máy' : 'Không kết nối'] += 1;
    });
    return { data: HOURS.map(h => b[h]), outside };
  }, [scoped]);

  // Hiệu suất từng nhân sự (theo toàn bộ kỳ, không áp bộ lọc nhân sự)
  const agents = useMemo(() => {
    const m = new Map();
    rows.forEach(r => {
      const id = r.created_by || 'none';
      if (!m.has(id)) m.set(id, { id, name: r.author?.full_name || 'Không rõ', calls: 0, connected: 0, callback: 0, bad: 0, phones: new Set() });
      const a = m.get(id);
      a.calls += 1;
      if (CONNECTED.includes(r.outcome)) a.connected += 1;
      if (r.outcome === 'hen_goi_lai') a.callback += 1;
      if (BAD.includes(r.outcome)) a.bad += 1;
      const k = phoneKey(custPhone(r)) || r.data_id;
      if (k) a.phones.add(k);
    });
    return [...m.values()].map(a => ({ ...a, reached: a.phones.size, rate: pct(a.connected, a.calls) }));
  }, [rows]);

  const exportCsv = () => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Thời gian', 'Khách hàng', 'SĐT', 'Nhân sự', 'Kết quả', 'Nội dung', 'Hẹn liên hệ tiếp'];
    const lines = view.map(r => [fmtTime(r.created_at), custName(r), phoneView(custPhone(r), profile), r.author?.full_name,
      OUTCOMES[r.outcome]?.label || r.outcome, r.content, r.next_at ? fmtTime(r.next_at) : ''].map(cell).join(','));
    downloadCsv(`cuoc-goi-${from}_${to}.csv`, [head.map(cell).join(','), ...lines].join('\n'));
    logAuditEvent('export', 'marketing_activities', { details: { kind: 'call', rows: view.length, from, to, staff_id: staff || null, outcome: outcome || null } });
  };

  const rangeLabel = from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;
  const prevHint = before ? 'so với kỳ trước' : rangeLabel;

  const agentColumns = [
    { key: 'name', header: 'Nhân sự', sortValue: a => a.name, cell: a => (
      <div className="flex items-center gap-2.5 min-w-[150px]">
        <span className="e-avatar w-8 h-8 text-[12px]">{a.name.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() || '?'}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); if (a.id !== 'none') setStaff(s => (s === a.id ? '' : a.id)); }}
          className={`text-left font-semibold text-[14px] hover:text-teal-700 ${staff === a.id ? 'text-teal-700' : 'text-slate-900'}`}
          title="Lọc theo nhân sự này">{a.name}</button>
      </div>
    ) },
    { key: 'calls', header: 'Số cuộc', align: 'right', sortValue: a => a.calls, cell: a => <span className="font-semibold tabular-nums">{a.calls}</span> },
    { key: 'reached', header: 'Khách', align: 'right', sortValue: a => a.reached, cell: a => <span className="tabular-nums">{a.reached}</span> },
    { key: 'rate', header: 'Nghe máy', align: 'right', sortValue: a => a.rate, cell: a => <span className={`tabular-nums font-semibold ${a.rate >= 60 ? 'text-success-600' : a.rate < 35 ? 'text-danger-600' : 'text-slate-700'}`}>{a.rate}%</span> },
    { key: 'callback', header: 'Hẹn gọi lại', align: 'right', sortValue: a => a.callback, cell: a => <span className="tabular-nums">{a.callback}</span> },
    { key: 'bad', header: 'Từ chối / sai số', align: 'right', sortValue: a => a.bad, cell: a => <span className="tabular-nums">{a.bad}</span> },
  ];

  const columns = [
    { key: 'time', header: 'Thời gian', width: 150, sortValue: r => r.created_at, cell: r => <span className="text-slate-600 tabular-nums whitespace-nowrap">{fmtTime(r.created_at)}</span> },
    { key: 'cust', header: 'Khách hàng', sortValue: r => custName(r), cell: r => (
      <div className="min-w-[150px]">
        <div className="font-semibold text-slate-900 text-[14px] leading-tight truncate max-w-[220px]">{custName(r) || <span className="text-slate-400 font-medium">Chưa có tên</span>}</div>
        <div className="text-[12px] text-slate-500 tabular-nums">{phoneView(custPhone(r), profile) || '—'}</div>
      </div>
    ) },
    { key: 'staff', header: 'Nhân sự', sortValue: r => r.author?.full_name || '', cell: r => <span className="text-[13.5px] text-slate-700 whitespace-nowrap">{r.author?.full_name || '—'}</span> },
    { key: 'outcome', header: 'Kết quả', sortValue: r => OUTCOMES[r.outcome]?.label || r.outcome || '', cell: r => <OutcomeBadge outcome={r.outcome} /> },
    { key: 'content', header: 'Nội dung', cell: r => (
      <div className="max-w-[380px]">
        <span className="text-[13px] text-slate-600 line-clamp-2">{r.content || '—'}</span>
        {r.next_at && <span className="text-[12px] text-info-600 inline-flex items-center gap-1 mt-0.5"><CalendarClock className="w-3.5 h-3.5" />Liên hệ lại {fmtTime(r.next_at)}</span>}
      </div>
    ) },
    { key: 'act', header: <span className="sr-only">Hồ sơ</span>, align: 'right', cell: r => <Customer360Button phone={custPhone(r)} name={custName(r)} label="360" /> },
  ];

  if (missing) {
    return (
      <div className="e-card">
        <EmptyState icon={PhoneCall} title="Chưa bật nhật ký cuộc gọi"
          description="Chạy file supabase/marketing_call_care.sql trong Supabase SQL Editor để bắt đầu ghi nhận cuộc gọi từ Data khách hàng." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: 'Tìm khách, SĐT, nội dung…' }}
        actions={<>
          <button type="button" onClick={load} className="e-icon-btn" aria-label="Tải lại" title="Tải lại"><RotateCw className="w-4 h-4" /></button>
          <button type="button" onClick={exportCsv} disabled={!view.length} className="e-btn e-btn-secondary"><Download /> Xuất CSV</button>
        </>}
      >
        <div className="e-seg overflow-x-auto max-w-full" role="tablist" aria-label="Khoảng thời gian">
          {PRESETS.map(p => (
            <button key={p.value} type="button" role="tab" aria-selected={preset === p.value}
              onClick={() => { if (p.value === 'custom') setCustom({ from, to }); setPreset(p.value); }}
              className={`e-seg-item ${preset === p.value ? 'e-seg-active' : ''}`}>{p.label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
            <input type="date" className="e-input !w-auto" value={custom.from} max={custom.to} aria-label="Từ ngày"
              onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} />
            –
            <input type="date" className="e-input !w-auto" value={custom.to} min={custom.from} max={vnToday()} aria-label="Đến ngày"
              onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} />
          </div>
        )}
        <FilterSelect label="Nhân sự" allLabel="Tất cả nhân sự" value={staff} onChange={setStaff} options={staffOptions} />
        <FilterSelect label="Kết quả" allLabel="Mọi kết quả" value={outcome} onChange={setOutcome}
          options={Object.entries(OUTCOMES).map(([value, o]) => ({ value, label: o.label }))} />
      </FilterBar>

      {capped && <AlertStrip tone="info">Kỳ đã chọn có hơn {MAX_ROWS.toLocaleString('vi-VN')} cuộc gọi — chỉ tính {MAX_ROWS.toLocaleString('vi-VN')} cuộc mới nhất. Thu hẹp khoảng ngày để số liệu chính xác.</AlertStrip>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
        <Metric icon={PhoneCall} tone="e-tone-brand" label="Tổng cuộc gọi" value={loading ? '…' : now.total.toLocaleString('vi-VN')}
          hint={prevHint} delta={!loading && before && <Delta now={now.total} prev={before.total} />} />
        <Metric icon={Headphones} tone="e-tone-success" label="Nghe máy" value={loading ? '…' : `${now.rate}%`}
          hint={!loading && !before ? `${now.connected} cuộc` : prevHint} delta={!loading && before && <Delta now={now.rate} prev={before.rate} unit="%" />} />
        <Metric icon={CalendarClock} tone="e-tone-info" label="Hẹn gọi lại" value={loading ? '…' : now.callback}
          hint={prevHint} delta={!loading && before && <Delta now={now.callback} prev={before.callback} />} />
        <Metric icon={PhoneOff} tone="e-tone-danger" label="Từ chối / sai số" value={loading ? '…' : now.bad}
          hint={prevHint} delta={!loading && before && <Delta now={now.bad} prev={before.bad} goodDown />} />
        <Metric icon={Users} tone="e-tone-lavender" label="Khách được gọi" value={loading ? '…' : now.reached}
          hint={prevHint} delta={!loading && before && <Delta now={now.reached} prev={before.reached} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <div className="e-card e-card-pad xl:col-span-2">
          <div className="e-card-header">
            <div>
              <div className="e-card-title">Cuộc gọi theo giờ</div>
              <div className="e-card-sub">{rangeLabel} · 7h–21h{hourly.outside ? ` · ${hourly.outside} cuộc ngoài khung giờ` : ''}</div>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-600" />Nghe máy</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />Không kết nối</span>
            </div>
          </div>
          {loading ? <div className="h-64 rounded-xl bg-slate-50 animate-pulse" /> : scoped.length === 0 ? (
            <EmptyState title="Chưa có cuộc gọi trong kỳ" icon={PhoneCall} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF4F4" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#F1F7F7' }} />
                  <Bar dataKey="Nghe máy" stackId="c" fill="#067B7F" />
                  <Bar dataKey="Không kết nối" stackId="c" fill="#C7D2D9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="e-card e-card-pad xl:col-span-3">
          <div className="e-card-header">
            <div>
              <div className="e-card-title">Hiệu suất nhân sự</div>
              <div className="e-card-sub">{rangeLabel} · bấm tên để lọc theo nhân sự</div>
            </div>
          </div>
          <DataTable
            bare
            rows={agents}
            getRowId={a => a.id}
            loading={loading}
            columns={agentColumns}
            pageSize={6}
            initialSort={{ key: 'calls', dir: 'desc' }}
            minWidth={560}
            empty={{ title: 'Chưa có cuộc gọi trong kỳ', icon: Users }}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 text-[12.5px] text-slate-500 px-1">
        <Info className="w-4 h-4 shrink-0 mt-px text-slate-400" />
        <span>Nhật ký lấy từ các cuộc gọi nhân sự ghi trong Data khách hàng. Tỷ lệ nghe máy tính cả Hẹn gọi lại, Đang cân nhắc, Từ chối. Thời lượng và ghi âm cuộc gọi chưa được lưu.</span>
      </div>

      <DataTable
        rows={view}
        loading={loading}
        error={error}
        onRetry={load}
        columns={columns}
        minWidth={940}
        pageSize={20}
        initialSort={{ key: 'time', dir: 'desc' }}
        onRowClick={setDetail}
        empty={{ title: 'Không có cuộc gọi nào', description: 'Thử đổi khoảng ngày hoặc bộ lọc.', icon: PhoneCall }}
        footerStart={`${view.length.toLocaleString('vi-VN')} cuộc gọi`}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? (custName(detail) || phoneView(custPhone(detail), profile) || 'Cuộc gọi') : ''}
        description={detail ? `${detail.author?.full_name || 'Không rõ'} · ${fmtTime(detail.created_at)}` : ''}
        footer={detail && (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            {onNavigate && (
              <button type="button" className="e-btn e-btn-secondary" onClick={() => { setDetail(null); onNavigate('data_kh'); }}>
                <Database /> Data khách hàng
              </button>
            )}
            {/* đóng ngăn này trước rồi mới mở hồ sơ 360 (tránh 2 ngăn chồng nhau) */}
            <span onClickCapture={() => setDetail(null)}>
              <Customer360Button phone={custPhone(detail)} name={custName(detail)} label="Mở hồ sơ 360" className="!h-10 !px-4" />
            </span>
          </div>
        )}
      >
        {detail && (
          <div className="space-y-4">
            <div className="e-subtle px-4 py-3 grid grid-cols-2 gap-y-3 gap-x-4">
              <div><div className="e-kv-label">Kết quả</div><div className="e-kv-value"><OutcomeBadge outcome={detail.outcome} /></div></div>
              <div><div className="e-kv-label">Số điện thoại</div><div className="e-kv-value tabular-nums">{phoneView(custPhone(detail), profile) || '—'}</div></div>
              <div><div className="e-kv-label">Nhân sự gọi</div><div className="e-kv-value">{detail.author?.full_name || '—'}</div></div>
              <div><div className="e-kv-label">Hẹn liên hệ tiếp</div><div className="e-kv-value">{detail.next_at ? fmtTime(detail.next_at) : '—'}</div></div>
            </div>
            <div>
              <div className="e-kv-label mb-1.5">Nội dung cuộc gọi</div>
              <div className="e-subtle px-4 py-3 text-[14px] text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{detail.content || 'Không có ghi chú'}</div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
