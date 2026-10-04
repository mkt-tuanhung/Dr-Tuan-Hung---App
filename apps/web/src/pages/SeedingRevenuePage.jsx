import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { DollarSign, Banknote, Percent, Search, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const RATE = 0.2; // 20%
const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';           // số ĐẦY ĐỦ, không làm tròn
const axisFmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'T' : n >= 1e6 ? Math.round(n / 1e6) + 'Tr' : n; // chỉ dùng cho trục biểu đồ
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const commOf = (r) => Math.max(0, Number(r.revenue || 0) - Number(r.hospital_fee || 0)) * RATE;
const pad = (n) => String(n).padStart(2, '0');

export default function SeedingRevenuePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const load = useCallback(async () => {
    const { data } = await supabase.from('customer_appointments')
      .select('id, customer_name, phone, service, revenue, hospital_fee, surgery_date, customer_source, status')
      .eq('customer_source', 'Seeding').eq('status', 'phau_thuat')
      .order('surgery_date', { ascending: false }).limit(2000);
    setRows(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('customer_appointments', load);

  const monthKey = `${year}-${pad(month)}`;
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const ql = q.trim().toLowerCase();
  const visible = rows.filter(r => (r.surgery_date || '').slice(0, 7) === monthKey
    && (!ql || (r.customer_name || '').toLowerCase().includes(ql) || (r.phone || '').includes(ql)));
  const totalRev = visible.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalFee = visible.reduce((s, r) => s + Number(r.hospital_fee || 0), 0);
  const totalComm = visible.reduce((s, r) => s + commOf(r), 0);

  // Biểu đồ 6 tháng gần đây (theo tháng đang chọn)
  const chart = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(year, month - 6 + i, 1);
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
    const rs = rows.filter(r => (r.surgery_date || '').slice(0, 7) === key);
    return {
      month: `T${dt.getMonth() + 1}`,
      key,
      hoahong: rs.reduce((s, r) => s + commOf(r), 0),
      doanhthu: rs.reduce((s, r) => s + Number(r.revenue || 0), 0),
      ca: rs.length,
    };
  });

  const stats = [
    { icon: DollarSign, color: '#067B7F', label: `Doanh thu seeding Th${month}/${year}`, value: fmt(totalRev) },
    { icon: Banknote, color: '#3CA7A9', label: 'Viện phí', value: fmt(totalFee) },
    { icon: Percent, color: '#06686C', label: 'Hoa hồng (20%)', value: fmt(totalComm) },
  ];

  return (
    <div className="space-y-4">
      {/* Thanh công cụ: mô tả + chọn tháng */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="e-page-desc">Khách nguồn Seeding đã phẫu thuật · hoa hồng chung cả team</p>
        <div className="e-seg gap-0.5">
          <button onClick={prevMonth} title="Tháng trước" className="e-seg-item px-2"><ChevronLeft /></button>
          <span className="e-seg-item e-seg-active min-w-[84px] tabular-nums cursor-default">Th{month}/{year}</span>
          <button onClick={nextMonth} title="Tháng sau" className="e-seg-item px-2"><ChevronRight /></button>
        </div>
      </div>

      {/* Thẻ số liệu (MetricCard Ethics) — số ĐẦY ĐỦ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((c, i) => (
          <div key={i} className="e-metric grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5">
            <span className="e-metric-icon row-span-2"><c.icon style={{ color: c.color }} /></span>
            <div className="e-metric-value col-start-2 row-start-2">{c.value}</div>
            <div className="e-metric-label col-start-2 row-start-1 self-end">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        {/* Biểu đồ hoa hồng theo tháng */}
        <div className="e-card e-card-pad min-w-0">
          <div className="e-card-header">
            <div>
              <h3 className="e-card-title">Hoa hồng Seeding theo tháng</h3>
              <p className="e-card-sub">6 tháng gần nhất</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#EAF4F4" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A3ABAA' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#A3ABAA' }} width={44} tickFormatter={axisFmt} />
              <Tooltip
                cursor={{ fill: '#F3F9F9' }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v, name) => [fmt(v), name === 'hoahong' ? 'Hoa hồng' : 'Doanh thu']}
                labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.ca || 0} ca`}
              />
              <Bar dataKey="hoahong" radius={[6, 6, 0, 0]} barSize={30}>
                {chart.map((c, i) => <Cell key={i} fill={c.key === monthKey ? '#067B7F' : '#CAE8E9'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4 min-w-0">
          {/* TỔNG hoa hồng — thẻ tổng kết kiểu Ethics (nền trắng, nhấn teal) */}
          <div className="e-card e-card-pad flex items-center gap-4">
            <span className="e-metric-icon e-tone-brand"><Percent /></span>
            <div className="min-w-0 flex-1">
              <div className="e-metric-label">Tổng hoa hồng Seeding Th{month}/{year}</div>
              <div className="text-[26px] lg:text-[30px] font-bold text-teal-700 leading-tight tabular-nums truncate">{fmt(totalComm)}</div>
              <div className="text-[12px] text-slate-500 mt-0.5 tabular-nums">{visible.length} ca · Doanh thu {fmt(totalRev)} − Viện phí {fmt(totalFee)}</div>
            </div>
          </div>
          {/* Công thức */}
          <div className="e-subtle p-3.5 text-[12.5px] leading-relaxed text-slate-500">
            <b className="text-slate-700">Cách tính hoa hồng:</b> Hoa hồng = 20% × (Doanh thu − Viện phí) cho mỗi ca mổ nguồn Seeding.
            VD: mổ 100.000.000đ, viện phí 21.000.000đ → hoa hồng = (100.000.000 − 21.000.000) × 20% = <b className="text-teal-700">15.800.000đ</b>.
          </div>
        </div>
      </div>

      {/* Tìm kiếm */}
      <div className="e-toolbar">
        <div className="e-search flex-1 min-w-[220px]">
          <Search />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên khách / SĐT…" />
        </div>
      </div>

      {loading ? (
        <div className="e-card flex justify-center h-40 items-center"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="e-card e-empty"><div className="e-empty-icon"><Percent /></div><div className="e-empty-title">Chưa có khách nguồn Seeding mổ trong tháng này.</div></div>
      ) : (
        <div className="e-card divide-y divide-slate-100 overflow-hidden">
          {visible.map(r => (
            <div key={r.id} className="px-4 lg:px-5 py-3 min-h-[68px] flex items-center gap-3 hover:bg-teal-50/30 transition">
              <span className="e-avatar w-11 h-11 text-[13px]">{initials(r.customer_name)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold text-slate-900 truncate">{r.customer_name}</div>
                <div className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1 min-w-0 truncate"><Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" /> {r.phone || '—'} · {r.service || '—'}</div>
                <div className="text-[12px] text-slate-400 mt-0.5 tabular-nums truncate">DT {fmt(r.revenue)} · Viện phí {fmt(r.hospital_fee)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="e-kv-label">Hoa hồng</div>
                <div className="text-[15px] font-bold text-teal-700 tabular-nums">{fmt(commOf(r))}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
