// ============================================================
// BÁO CÁO & PHÂN TÍCH (Ethics D11 "Báo cáo / BI")
// - Bộ lọc kỳ (so với kỳ liền trước cùng số ngày) + chọn chỉ số cho biểu đồ chính
// - 4 chỉ số: Doanh thu · Khách mới · Lịch hẹn · Tỷ lệ chốt (▲/▼ so với kỳ trước)
// - Biểu đồ theo ngày (≤ 62 ngày) hoặc theo tháng, cột = kỳ này, đường = kỳ trước
// - Top dịch vụ · Nguồn khách · Hiệu suất nhân sự (sale / telesale)
// - Góc nhìn đã lưu (localStorage 'th_reports_views') + Xuất CSV (ghi nhật ký)
// Dữ liệu: customer_appointments, marketing_data, profiles (RLS tự giới hạn).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleDollarSign, UserPlus, CalendarCheck, Target, Download, RotateCw, Bookmark, BookmarkPlus,
  Trash2, BarChart3, Stethoscope, PieChart as PieIcon, Users, ChevronRight, Check,
} from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { downloadCsv } from '@/lib/csv';
import { vnToday } from '@/lib/vnTime';
import { logAuditEvent } from '@/lib/audit';
import { DataTable, FilterBar, FilterSelect, AlertStrip, Drawer, EmptyState, ErrorState, usePageTitle } from '@/components/ds';
import {
  PERIODS, METRICS, STAFF_ROLE, ADD_UPSALE, computeRange, loadReportData, summarize, buildSeries, topServices,
  sourceBreakdown, staffPerformance, fmtDay, periodLabel, isPermissionError,
} from './reportsData';

// Màu biểu đồ Ethics (giống Tổng quan Admin)
const COLORS = ['#067B7F', '#3CA7A9', '#5B8DD6', '#8B7BD8', '#E5A13C', '#CAD3D3'];
const TICK = { fontSize: 11, fill: '#A3ABAA' };
const TOOLTIP_STYLE = { borderRadius: 12, border: 'none', boxShadow: '0 12px 40px rgba(7,95,99,0.14)', fontSize: 12 };

const VIEWS_KEY = 'th_reports_views';
const readViews = () => {
  try { const v = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const writeViews = (v) => { try { localStorage.setItem(VIEWS_KEY, JSON.stringify(v)); } catch { /* chế độ ẩn danh: bỏ qua */ } };

const nf = new Intl.NumberFormat('vi-VN');
const fmtNum = (v) => nf.format(Math.round(Number(v) || 0));
const fmtVND = (v) => `${fmtNum(v)}đ`;
const fmtCompact = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} tỷ`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',')} tr`;
  return fmtNum(n);
};
const fmtAxis = (v) => (v >= 1e9 ? `${(v / 1e9).toFixed(1).replace(/\.0$/, '')} Tỷ` : v >= 1e6 ? `${Math.round(v / 1e6)} Tr` : v);
const fmtPct = (v) => (v == null ? '—' : `${(Math.round(v * 10) / 10).toString().replace('.', ',')}%`);
const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

function Delta({ value, unit = '%', note = 'so với kỳ trước' }) {
  if (value == null || Number.isNaN(value)) return <div className="e-metric-hint">Chưa có số kỳ trước</div>;
  const up = value >= 0;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={up ? 'e-delta-up' : 'e-delta-down'}>{up ? '▲' : '▼'} {(Math.round(Math.abs(value) * 10) / 10).toString().replace('.', ',')}{unit}</span>
      <span className="e-metric-hint">{note}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, tone, label, value, title, delta, deltaUnit, hint, loading }) {
  return (
    <div className="e-metric" title={title}>
      <div className={`e-metric-icon ${tone}`}><Icon /></div>
      <div className="min-w-0 flex-1">
        <div className="e-metric-label">{label}</div>
        {loading ? (
          <>
            <div className="h-6 w-24 my-1 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
          </>
        ) : (
          <>
            <div className="e-metric-value">{value}</div>
            <Delta value={delta} unit={deltaUnit} />
            {hint && <div className="e-metric-hint">{hint}</div>}
          </>
        )}
      </div>
    </div>
  );
}

const Skeleton = ({ h = 240 }) => <div className="rounded-xl bg-slate-100/80 animate-pulse" style={{ height: h }} />;

export default function ReportsPage({ onNavigate } = {}) {
  usePageTitle('Báo cáo & Phân tích');
  const today = vnToday();
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 8)}01`);
  const [customTo, setCustomTo] = useState(today);
  const [metric, setMetric] = useState('revenue');
  const [svcMode, setSvcMode] = useState('revenue');
  const [srcMode, setSrcMode] = useState('leads');
  const [roleFilter, setRoleFilter] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [views, setViews] = useState(readViews);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewName, setViewName] = useState('');

  const range = useMemo(() => computeRange(period, customFrom, customTo, today), [period, customFrom, customTo, today]);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const res = await loadReportData(range);
      if (id !== reqId.current) return; // đã đổi bộ lọc -> bỏ kết quả cũ
      if (res.error) { setError(res.error); setData(null); } else setData(res);
    } catch (e) {
      if (id === reqId.current) { setError(e); setData(null); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // Data KH không có cột nguồn / không đọc được -> xem nguồn theo ca phẫu thuật
  const leadsOk = !!data && !data.leadsError;
  const srcModeEff = srcMode === 'leads' && !(data?.leadsHasSource) ? 'surgeries' : srcMode;

  const cur = useMemo(() => (data ? summarize(data, range.from, range.to) : null), [data, range]);
  const prev = useMemo(() => (data ? summarize(data, range.prevFrom, range.prevTo) : null), [data, range]);
  const series = useMemo(() => (data ? buildSeries(data, range, metric) : []), [data, range, metric]);
  const services = useMemo(() => {
    if (!data) return [];
    const list = topServices(data, range.from, range.to);
    return list.sort((a, b) => (svcMode === 'revenue' ? b.revenue - a.revenue || b.count - a.count : b.count - a.count || b.revenue - a.revenue));
  }, [data, range, svcMode]);
  const sources = useMemo(() => (data ? sourceBreakdown(data, range.from, range.to, srcModeEff) : []), [data, range, srcModeEff]);
  const staffAll = useMemo(() => (data ? staffPerformance(data, range.from, range.to) : []), [data, range]);
  const staffRows = useMemo(() => (roleFilter
    ? staffAll.filter(r => (roleFilter === 'other' ? !r.role : r.role === roleFilter))
    : staffAll), [staffAll, roleFilter]);

  const metricMeta = METRICS.find(m => m.value === metric) || METRICS[0];
  const fmtMetric = (v) => (metric === 'revenue' ? fmtVND(v) : `${fmtNum(v)} ${metricMeta.unit}`);
  const seriesTotal = series.reduce((s, x) => s + x.cur, 0);
  const seriesPrevTotal = series.reduce((s, x) => s + x.prev, 0);
  const rangeText = `${fmtDay(range.from)} – ${fmtDay(range.to)}`;
  const prevText = `${fmtDay(range.prevFrom)} – ${fmtDay(range.prevTo)}`;

  // ---------- Góc nhìn đã lưu ----------
  const sameView = (v) => v.period === period && v.metric === metric
    && (period !== 'custom' || (v.from === customFrom && v.to === customTo));
  const activeView = views.find(sameView);
  const applyView = (v) => {
    setPeriod(PERIODS.some(p => p.value === v.period) ? v.period : 'this_month');
    if (v.period === 'custom') { if (v.from) setCustomFrom(v.from); if (v.to) setCustomTo(v.to); }
    if (METRICS.some(m => m.value === v.metric)) setMetric(v.metric);
    setViewsOpen(false);
  };
  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    const v = { id: `${Date.now()}`, name, period, metric, from: period === 'custom' ? customFrom : null, to: period === 'custom' ? customTo : null, createdAt: new Date().toISOString() };
    const next = [...views.filter(x => x.name.toLowerCase() !== name.toLowerCase()), v];
    setViews(next); writeViews(next); setViewName('');
  };
  const deleteView = (id) => { const next = views.filter(v => v.id !== id); setViews(next); writeViews(next); };
  const viewDesc = (v) => `${v.period === 'custom' ? `${fmtDay(v.from)} – ${fmtDay(v.to)}` : periodLabel(v.period)} · ${METRICS.find(m => m.value === v.metric)?.label || ''}`;

  // ---------- Xuất CSV ----------
  const exportCsv = () => {
    if (!cur) return;
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const line = (arr) => arr.map(cell).join(',');
    const pctTxt = (c, p) => { const d = pctChange(c, p); return d == null ? '' : `${Math.round(d * 10) / 10}%`; };
    const rate = (v) => (v == null ? '' : `${Math.round(v * 10) / 10}%`);
    const sorted = [...staffRows].sort((a, b) => b.revenue - a.revenue);
    const out = [
      line(['BÁO CÁO & PHÂN TÍCH', `Kỳ: ${rangeText}`, `So với: ${prevText}`]),
      line(['Chỉ số', 'Kỳ này', 'Kỳ trước', 'Thay đổi']),
      line(['Doanh thu (đ)', Math.round(cur.revenue), Math.round(prev.revenue), pctTxt(cur.revenue, prev.revenue)]),
      line(['Khách mới (Data KH)', leadsOk ? cur.leads : '', leadsOk ? prev.leads : '', leadsOk ? pctTxt(cur.leads, prev.leads) : '']),
      line(['Lịch hẹn', cur.appts, prev.appts, pctTxt(cur.appts, prev.appts)]),
      line(['Khách cọc', cur.deposits, prev.deposits, pctTxt(cur.deposits, prev.deposits)]),
      line(['Ca phẫu thuật', cur.surgeries, prev.surgeries, pctTxt(cur.surgeries, prev.surgeries)]),
      line(['Tỷ lệ chốt (phẫu thuật / lịch hẹn)', rate(cur.closeRate), rate(prev.closeRate),
        cur.closeRate != null && prev.closeRate != null ? `${Math.round((cur.closeRate - prev.closeRate) * 10) / 10} điểm` : '']),
      '',
      line(['HIỆU SUẤT NHÂN SỰ']),
      line(['Nhân sự', 'Mã NV', 'Vai trò', 'Lịch hẹn', 'Khách cọc', 'Tiền cọc (đ)', 'Ca phẫu thuật', 'Doanh thu (đ)', 'Tỷ lệ chốt']),
      ...sorted.map(r => line([r.name, r.employeeId, STAFF_ROLE[r.role]?.label || 'Khác', r.appts, r.deposits, Math.round(r.depositAmount), r.surgeries, Math.round(r.revenue), rate(r.closeRate)])),
    ];
    downloadCsv(`bao-cao-${range.from}_${range.to}.csv`, out.join('\n'));
    logAuditEvent('export', 'reports', {
      details: { rows: sorted.length, from: range.from, to: range.to, period, compare_from: range.prevFrom, compare_to: range.prevTo, role: roleFilter || null, file: 'bao-cao-phan-tich.csv' },
    });
  };

  // ---------- Bảng hiệu suất nhân sự ----------
  const maxRate = Math.max(1, ...staffRows.map(r => r.closeRate || 0));
  const staffColumns = [
    { key: 'name', header: 'Nhân sự', sortValue: r => r.name, cell: r => (
      <div className="flex items-center gap-3 min-w-[180px]">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-teal-50 grid place-items-center shrink-0">
          {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[13px] font-bold text-teal-700">{r.name.charAt(0)}</span>}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-[14px] truncate">{r.name}</div>
          {r.employeeId && <div className="text-[12px] text-slate-500">{r.employeeId}</div>}
        </div>
      </div>
    ) },
    { key: 'role', header: 'Vai trò', sortValue: r => STAFF_ROLE[r.role]?.label || 'zz', cell: r => (STAFF_ROLE[r.role]
      ? <span className={`e-badge e-badge-sm ${STAFF_ROLE[r.role].tone}`}>{STAFF_ROLE[r.role].label}</span>
      : <span className="e-badge e-badge-sm e-tone-neutral">Khác</span>) },
    { key: 'appts', header: 'Lịch hẹn', align: 'right', sortValue: r => r.appts, cell: r => <span className="tabular-nums">{fmtNum(r.appts)}</span> },
    { key: 'deposits', header: 'Cọc', align: 'right', sortValue: r => r.deposits, cell: r => (
      <div className="tabular-nums whitespace-nowrap">
        <div>{fmtNum(r.deposits)}</div>
        {r.depositAmount > 0 && <div className="text-[12px] text-slate-500">{fmtCompact(r.depositAmount)}</div>}
      </div>
    ) },
    { key: 'surgeries', header: 'Phẫu thuật', align: 'right', sortValue: r => r.surgeries, cell: r => <span className="tabular-nums font-medium text-slate-800">{fmtNum(r.surgeries)}</span> },
    { key: 'revenue', header: 'Doanh thu', align: 'right', sortValue: r => r.revenue, cell: r => <span className="tabular-nums font-semibold text-slate-900 whitespace-nowrap" title={fmtVND(r.revenue)}>{fmtCompact(r.revenue)}</span> },
    { key: 'rate', header: 'Tỷ lệ chốt', align: 'right', width: 150, sortValue: r => (r.closeRate == null ? -1 : r.closeRate), cell: r => (r.closeRate == null
      ? <span className="text-slate-300">—</span>
      : (
        <div className="flex items-center justify-end gap-2">
          <div className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, (r.closeRate / maxRate) * 100)}%` }} />
          </div>
          <span className="tabular-nums font-medium text-slate-800 w-12 text-right">{fmtPct(r.closeRate)}</span>
        </div>
      )) },
  ];

  const svcTotal = services.reduce((s, x) => s + (svcMode === 'revenue' ? x.revenue : x.count), 0);
  const svcTop = services.slice(0, 7);
  const svcMax = Math.max(1, ...svcTop.map(x => (svcMode === 'revenue' ? x.revenue : x.count)));
  const srcTop = (() => {
    const head = sources.slice(0, 5);
    const rest = sources.slice(5);
    if (!rest.length) return head;
    return [...head, { name: 'Khác', count: rest.reduce((s, x) => s + x.count, 0), revenue: rest.reduce((s, x) => s + x.revenue, 0) }];
  })();
  const srcTotal = srcTop.reduce((s, x) => s + x.count, 0);

  const permission = isPermissionError(error);

  return (
    <div className="space-y-4">
      <FilterBar
        actions={<>
          <button type="button" onClick={load} className="e-icon-btn" aria-label="Tải lại" title="Tải lại"><RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={() => setViewsOpen(true)} className="e-btn e-btn-secondary">
            <Bookmark /> Góc nhìn{views.length ? ` (${views.length})` : ''}
          </button>
          <button type="button" onClick={exportCsv} disabled={!cur || loading} className="e-btn e-btn-secondary"><Download /> Xuất CSV</button>
        </>}
      >
        <FilterSelect label="Kỳ báo cáo" allLabel="Tháng này" value={period === 'this_month' ? '' : period}
          onChange={v => setPeriod(v || 'this_month')} options={PERIODS.filter(p => p.value !== 'this_month')} className="!min-w-[150px]" />
        {period === 'custom' && (
          <>
            <label className="flex items-center gap-1.5 text-[13px] text-slate-500">
              Từ <input type="date" className="e-input !w-auto" value={customFrom} max={customTo || today} onChange={e => e.target.value && setCustomFrom(e.target.value)} />
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-slate-500">
              đến <input type="date" className="e-input !w-auto" value={customTo} min={customFrom} max={today} onChange={e => e.target.value && setCustomTo(e.target.value)} />
            </label>
          </>
        )}
        <div className="e-seg overflow-x-auto max-w-full" role="tablist" aria-label="Chỉ số biểu đồ">
          {METRICS.map(m => (
            <button key={m.value} type="button" role="tab" aria-selected={metric === m.value} onClick={() => setMetric(m.value)}
              className={`e-seg-item ${metric === m.value ? 'e-seg-active' : ''}`}>{m.label}</button>
          ))}
        </div>
      </FilterBar>

      {views.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="e-caption">Góc nhìn đã lưu</span>
          {views.map(v => (
            <button key={v.id} type="button" onClick={() => applyView(v)} title={viewDesc(v)}
              className={`e-badge ${activeView?.id === v.id ? 'e-tone-brand' : 'e-tone-neutral'} hover:opacity-80 transition`}>
              {activeView?.id === v.id ? <Check /> : <Bookmark />}{v.name}
            </button>
          ))}
        </div>
      )}

      <div className="text-[13px] text-slate-500">
        Kỳ <b className="text-slate-800">{period === 'custom' ? 'tuỳ chọn' : periodLabel(period).toLowerCase()}</b>: {rangeText}
        <span className="text-slate-400"> · so với {prevText} ({range.len} ngày liền trước)</span>
      </div>

      {error ? (
        <div className="e-card">
          <ErrorState
            title={permission ? 'Bạn không có quyền xem dữ liệu báo cáo' : 'Không tải được báo cáo'}
            description={permission ? 'Tài khoản của bạn không được đọc dữ liệu lịch hẹn. Liên hệ Admin nếu cần được cấp quyền.' : (error.message || 'Kiểm tra kết nối mạng rồi thử lại.')}
            onRetry={load}
          />
        </div>
      ) : (
        <>
          {!loading && data?.capped && (
            <AlertStrip tone="warning">Khoảng thời gian quá dài nên chỉ tải được 20.000 dòng đầu mỗi loại — số liệu có thể thiếu. Hãy chọn kỳ ngắn hơn.</AlertStrip>
          )}
          {!loading && data?.leadsError && (
            <AlertStrip tone="info">Không đọc được Data khách hàng nên chỉ số <b>Khách mới</b> tạm để trống.</AlertStrip>
          )}

          {/* 4 chỉ số chính */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
            <MetricCard icon={CircleDollarSign} tone="e-tone-brand" label="Doanh thu" loading={loading}
              value={cur ? fmtCompact(cur.revenue) : '—'} title={cur ? fmtVND(cur.revenue) : undefined}
              delta={cur && pctChange(cur.revenue, prev.revenue)}
              hint={cur && !ADD_UPSALE && cur.upsale > 0 ? `trong đó upsale ${fmtCompact(cur.upsale)}` : `${cur ? fmtNum(cur.surgeries) : 0} ca phẫu thuật`} />
            <MetricCard icon={UserPlus} tone="e-tone-sky" label="Khách mới" loading={loading}
              value={leadsOk ? fmtNum(cur.leads) : '—'} delta={leadsOk ? pctChange(cur.leads, prev.leads) : null}
              hint="data về trong kỳ (theo ngày tạo GetFly)" />
            <MetricCard icon={CalendarCheck} tone="e-tone-lavender" label="Lịch hẹn" loading={loading}
              value={cur ? fmtNum(cur.appts) : '—'} delta={cur && pctChange(cur.appts, prev.appts)}
              hint={cur ? `${fmtNum(cur.deposits)} khách cọc · không tính tái khám` : ''} />
            <MetricCard icon={Target} tone="e-tone-peach" label="Tỷ lệ chốt" loading={loading}
              value={cur ? fmtPct(cur.closeRate) : '—'} deltaUnit=" điểm"
              delta={cur && cur.closeRate != null && prev.closeRate != null ? cur.closeRate - prev.closeRate : null}
              hint="ca phẫu thuật ÷ lịch hẹn trong kỳ" />
          </div>

          {/* Biểu đồ chính */}
          <section className="e-card e-card-pad">
            <div className="e-card-header !items-start flex-wrap">
              <div className="min-w-0">
                <h2 className="e-card-title">{metricMeta.label} theo {range.gran === 'day' ? 'ngày' : 'tháng'}</h2>
                <div className="e-card-sub">
                  Kỳ này: <b className="text-slate-800">{loading ? '…' : fmtMetric(seriesTotal)}</b>
                  <span className="text-slate-400"> · kỳ trước: {loading ? '…' : fmtMetric(seriesPrevTotal)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-gradient-to-b from-[#068A8C] to-[#76C2C3]" />Kỳ này</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#8B7BD8]" />Kỳ trước</span>
              </div>
            </div>
            {loading ? <Skeleton h={280} /> : seriesTotal === 0 && seriesPrevTotal === 0 ? (
              <EmptyState title="Chưa có số liệu trong kỳ" description="Thử chọn kỳ khác hoặc chỉ số khác." icon={BarChart3} />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rpBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#068A8C" />
                        <stop offset="100%" stopColor="#76C2C3" stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#EAF4F4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis tickLine={false} axisLine={false} tick={TICK} width={metric === 'revenue' ? 52 : 36} allowDecimals={false}
                      tickFormatter={metric === 'revenue' ? fmtAxis : undefined} />
                    <Tooltip cursor={{ fill: 'rgba(18,164,165,0.06)' }} contentStyle={TOOLTIP_STYLE}
                      formatter={(v, n) => [fmtMetric(v), n === 'prev' ? 'Kỳ trước (cùng vị trí)' : 'Kỳ này']} />
                    <Bar dataKey="cur" name="cur" fill="url(#rpBar)" radius={[6, 6, 2, 2]} maxBarSize={28} />
                    <Line dataKey="prev" name="prev" type="monotone" stroke="#8B7BD8" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Top dịch vụ */}
            <section className="e-card e-card-pad">
              <div className="e-card-header flex-wrap">
                <div className="min-w-0">
                  <h2 className="e-card-title">Top dịch vụ</h2>
                  <div className="e-card-sub">Theo ca phẫu thuật trong kỳ</div>
                </div>
                <div className="e-seg">
                  {[['revenue', 'Doanh thu'], ['count', 'Số ca']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setSvcMode(k)} className={`e-seg-item ${svcMode === k ? 'e-seg-active' : ''}`}>{l}</button>
                  ))}
                </div>
              </div>
              {loading ? <Skeleton h={260} /> : svcTop.length === 0 ? (
                <EmptyState title="Chưa có ca phẫu thuật" description="Kỳ này chưa có khách phẫu thuật." icon={Stethoscope} />
              ) : (
                <>
                  <ul className="space-y-3.5">
                    {svcTop.map((s, i) => {
                      const v = svcMode === 'revenue' ? s.revenue : s.count;
                      return (
                        <li key={s.name} className="min-w-0">
                          <div className="flex items-center gap-2 text-[13.5px] mb-1.5">
                            <span className="w-5 text-[12px] font-bold text-slate-400 tabular-nums">{i + 1}</span>
                            <span className="flex-1 min-w-0 truncate text-slate-700 font-medium" title={s.name}>{s.name}</span>
                            <span className="text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{svcMode === 'revenue' ? `${fmtNum(s.count)} ca` : fmtCompact(s.revenue)}</span>
                            <span className="font-semibold text-slate-900 tabular-nums whitespace-nowrap w-[84px] text-right">{svcMode === 'revenue' ? fmtCompact(v) : `${fmtNum(v)} ca`}</span>
                            <span className="text-[12px] text-slate-500 tabular-nums w-11 text-right">{svcTotal ? `${Math.round((v / svcTotal) * 100)}%` : ''}</span>
                          </div>
                          <div className="ml-7 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (v / svcMax) * 100)}%`, background: COLORS[i % (COLORS.length - 1)] }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {(services.length > svcTop.length || onNavigate) && (
                    <div className="mt-4 flex items-center justify-between text-[12.5px] text-slate-500">
                      <span>{services.length > svcTop.length ? `+${services.length - svcTop.length} dịch vụ khác` : ''}</span>
                      {onNavigate && (
                        <button type="button" onClick={() => onNavigate('khach_phau_thuat')} className="inline-flex items-center gap-0.5 font-semibold text-teal-700 hover:underline">
                          Khách phẫu thuật <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Nguồn khách */}
            <section className="e-card e-card-pad">
              <div className="e-card-header flex-wrap">
                <div className="min-w-0">
                  <h2 className="e-card-title">Nguồn khách</h2>
                  <div className="e-card-sub">{srcModeEff === 'leads' ? 'Data khách hàng về trong kỳ' : 'Khách phẫu thuật trong kỳ · doanh thu theo nguồn'}</div>
                </div>
                <div className="e-seg">
                  <button type="button" disabled={!data?.leadsHasSource} onClick={() => setSrcMode('leads')}
                    title={data && !data.leadsHasSource ? 'Data khách hàng chưa có cột nguồn' : undefined}
                    className={`e-seg-item disabled:opacity-40 ${srcModeEff === 'leads' ? 'e-seg-active' : ''}`}>Data khách</button>
                  <button type="button" onClick={() => setSrcMode('surgeries')} className={`e-seg-item ${srcModeEff === 'surgeries' ? 'e-seg-active' : ''}`}>Phẫu thuật</button>
                </div>
              </div>
              {loading ? <Skeleton h={260} /> : srcTop.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu nguồn" description="Kỳ này chưa có khách để phân tích nguồn." icon={PieIcon} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(160px,0.8fr)_1fr] items-center gap-6">
                  <div className="relative aspect-square w-full max-w-[210px] justify-self-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={srcTop} dataKey="count" nameKey="name" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} paddingAngle={1.2} stroke="none">
                          {srcTop.map((x, i) => <Cell key={x.name} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${fmtNum(v)} ${srcModeEff === 'leads' ? 'khách' : 'ca'}`, 'Số lượng']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <b className="text-[26px] font-bold text-slate-900 tracking-tight tabular-nums">{fmtNum(srcTotal)}</b>
                      <span className="text-[12px] text-slate-500">{srcModeEff === 'leads' ? 'Khách mới' : 'Ca phẫu thuật'}</span>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {srcTop.map((x, i) => (
                      <li key={x.name} className="flex items-center gap-2.5 text-[13.5px] min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="flex-1 min-w-0 truncate text-slate-700" title={x.name}>{x.name}</span>
                        {srcModeEff === 'surgeries' && <span className="text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{fmtCompact(x.revenue)}</span>}
                        <span className="text-slate-500 tabular-nums w-10 text-right">{fmtNum(x.count)}</span>
                        <span className="font-semibold text-slate-900 tabular-nums w-11 text-right">{srcTotal ? `${Math.round((x.count / srcTotal) * 100)}%` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {/* Hiệu suất nhân sự */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="e-card-title">Hiệu suất nhân sự</h2>
                <div className="e-card-sub">Sale / telesale phụ trách khách trong kỳ · tỷ lệ chốt = ca phẫu thuật ÷ lịch hẹn</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="e-seg">
                  {[['', 'Tất cả'], ['sale_offline', 'Sale Offline'], ['telesale', 'Telesale']].map(([k, l]) => (
                    <button key={k || 'all'} type="button" onClick={() => setRoleFilter(k)} className={`e-seg-item ${roleFilter === k ? 'e-seg-active' : ''}`}>{l}</button>
                  ))}
                </div>
                {onNavigate && (
                  <button type="button" onClick={() => onNavigate('kpi')} className="e-btn e-btn-ghost e-btn-sm">KPI & hoa hồng <ChevronRight /></button>
                )}
              </div>
            </div>
            <DataTable
              rows={staffRows}
              loading={loading}
              columns={staffColumns}
              getRowId={r => r.id}
              initialSort={{ key: 'revenue', dir: 'desc' }}
              pageSize={10}
              minWidth={860}
              empty={{ title: 'Chưa có số liệu nhân sự', description: 'Kỳ này chưa có lịch hẹn, cọc hay ca phẫu thuật gắn với sale / telesale.', icon: Users }}
              footerStart={`${staffRows.length} nhân sự · khách có cả sale và telesale được tính cho cả hai`}
            />
          </section>
        </>
      )}

      <Drawer open={viewsOpen} onClose={() => setViewsOpen(false)} title="Góc nhìn đã lưu"
        description="Lưu bộ lọc hiện tại để mở lại nhanh. Chỉ lưu trên trình duyệt này.">
        <div className="space-y-5">
          <div className="e-subtle p-4 space-y-3">
            <div className="text-[13px] text-slate-600">
              Bộ lọc hiện tại: <b className="text-slate-900">{period === 'custom' ? rangeText : periodLabel(period)}</b> · {metricMeta.label}
            </div>
            <label className="block">
              <span className="e-label">Tên góc nhìn</span>
              <input className="e-input" value={viewName} maxLength={60} onChange={e => setViewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveView(); }} placeholder="VD: Doanh thu quý này" />
            </label>
            <button type="button" onClick={saveView} disabled={!viewName.trim()} className="e-btn e-btn-primary e-btn-sm"><BookmarkPlus /> Lưu góc nhìn</button>
          </div>
          {views.length === 0 ? (
            <EmptyState title="Chưa lưu góc nhìn nào" description="Đặt tên rồi bấm Lưu để giữ bộ lọc này." icon={Bookmark} />
          ) : (
            <ul className="divide-y divide-slate-100 e-card overflow-hidden">
              {views.map(v => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 text-[14px] truncate">{v.name}</div>
                    <div className="text-[12px] text-slate-500 truncate">{viewDesc(v)}</div>
                  </div>
                  <button type="button" onClick={() => applyView(v)} className="e-btn e-btn-secondary e-btn-sm">{activeView?.id === v.id ? 'Đang xem' : 'Áp dụng'}</button>
                  <button type="button" onClick={() => deleteView(v.id)} className="e-icon-btn w-9 h-9 hover:!text-danger-600 hover:!border-danger-200" aria-label={`Xoá ${v.name}`} title="Xoá"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Drawer>
    </div>
  );
}
