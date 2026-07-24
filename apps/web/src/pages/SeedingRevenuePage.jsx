import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { Sprout, DollarSign, Banknote, Percent, Search, Phone, ChevronLeft, ChevronRight } from 'lucide-react';

const RATE = 0.2; // 20%
const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
const fmtShort = (n) => n >= 1e9 ? (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' Tỷ' : n >= 1e6 ? Math.round(n / 1e6) + ' Tr' : fmt(n);
const initials = (n) => (n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const commOf = (r) => Math.max(0, Number(r.revenue || 0) - Number(r.hospital_fee || 0)) * RATE;

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

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const ql = q.trim().toLowerCase();
  const visible = rows.filter(r => (r.surgery_date || '').slice(0, 7) === monthKey
    && (!ql || (r.customer_name || '').toLowerCase().includes(ql) || (r.phone || '').includes(ql)));
  const totalRev = visible.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalFee = visible.reduce((s, r) => s + Number(r.hospital_fee || 0), 0);
  const totalComm = visible.reduce((s, r) => s + commOf(r), 0);

  const stats = [
    { icon: DollarSign, color: '#14b8a6', label: `Doanh thu seeding Th${month}`, value: fmtShort(totalRev) },
    { icon: Banknote, color: '#f59e0b', label: 'Viện phí', value: fmtShort(totalFee) },
    { icon: Percent, color: '#8b5cf6', label: 'Hoa hồng (20%)', value: fmtShort(totalComm) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-600 grid place-items-center shrink-0"><Sprout className="w-6 h-6" /></span>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Doanh thu &amp; Hoa hồng Seeding</h2>
            <p className="text-slate-400 text-sm">Khách nguồn Seeding đã phẫu thuật · hoa hồng chung cả team</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 px-1.5 py-1 shadow-sm">
          <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-bold text-slate-700 min-w-[72px] text-center">Th{month}/{year}</span>
          <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Thẻ số liệu */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: c.color + '1a' }}><c.icon className="w-5 h-5" style={{ color: c.color }} /></span>
            <div className="text-xl font-bold text-slate-800">{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Công thức */}
      <div className="text-xs text-slate-500 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
        <b>Cách tính hoa hồng:</b> Hoa hồng = 20% × (Doanh thu − Viện phí) cho mỗi ca mổ nguồn Seeding.
        VD: mổ 100.000.000đ, viện phí 21.000.000đ → hoa hồng = (100.000.000 − 21.000.000) × 20% = <b>15.800.000đ</b>.
      </div>

      {/* Tìm kiếm */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên khách / SĐT…" className="w-full pl-10 pr-3 h-11 rounded-2xl bg-white border border-slate-200 text-sm outline-none focus:border-emerald-400" />
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">Chưa có khách nguồn Seeding mổ trong tháng này.</div>
      ) : (
        <div className="space-y-2.5">
          {visible.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white grid place-items-center text-sm font-bold shrink-0">{initials(r.customer_name)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-800 truncate">{r.customer_name}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {r.phone || '—'} · {r.service || '—'}</div>
                <div className="text-[11px] text-slate-500 mt-1">DT {fmt(r.revenue)} · Viện phí {fmt(r.hospital_fee)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-slate-400">Hoa hồng</div>
                <div className="font-bold text-emerald-600">{fmt(commOf(r))}</div>
              </div>
            </div>
          ))}
          {/* Tổng */}
          <div className="bg-emerald-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-emerald-600/20">
            <div><div className="text-white/80 text-xs">Tổng hoa hồng Seeding Th{month}/{year}</div><div className="text-[11px] text-white/70 mt-0.5">{visible.length} ca · DT {fmtShort(totalRev)} − Viện phí {fmtShort(totalFee)}</div></div>
            <div className="text-2xl font-bold">{fmt(totalComm)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
