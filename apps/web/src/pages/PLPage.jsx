import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { TrendingUp, TrendingDown, DollarSign, Megaphone, Banknote, Package, Users, PieChart } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
const lastDay = (y, m) => `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

export default function PLPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({ revenue: 0, ads: 0, hospitalFee: 0, expenses: 0, labor: 0, cases: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = lastDay(year, month);
    const [apptRes, adsRes, expRes, prRes] = await Promise.all([
      supabase.from('customer_appointments').select('revenue, hospital_fee, surgery_date, hospital_fee_date').eq('status', 'phau_thuat'),
      supabase.from('marketing_ads_performance').select('amount_spent, date').gte('date', startDate).lte('date', endDate),
      supabase.from('expenses').select('amount, date, status').eq('status', 'paid').gte('date', startDate).lte('date', endDate),
      supabase.from('payroll').select('net_salary, unpaid_advance').eq('month', month).eq('year', year),
    ]);
    let revenue = 0, hospitalFee = 0, cases = 0;
    (apptRes.data || []).forEach(a => {
      if (a.surgery_date && a.surgery_date >= startDate && a.surgery_date <= endDate) { revenue += Number(a.revenue || 0); cases++; }
      if (a.hospital_fee_date && a.hospital_fee_date >= startDate && a.hospital_fee_date <= endDate) hospitalFee += Number(a.hospital_fee || 0);
    });
    const ads = (adsRes.data || []).reduce((s, x) => s + Number(x.amount_spent || 0), 0);
    const expenses = (expRes.data || []).reduce((s, x) => s + Number(x.amount || 0), 0);
    const labor = (prRes.data || []).reduce((s, x) => s + (Number(x.net_salary || 0) - Number(x.unpaid_advance || 0)), 0);
    setD({ revenue, ads, hospitalFee, expenses, labor, cases });
    setLoading(false);
  }, [month, year]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('customer_appointments,marketing_ads_performance,expenses,payroll', load);

  const totalCost = d.ads + d.hospitalFee + d.expenses + d.labor;
  const profit = d.revenue - totalCost;
  const margin = d.revenue > 0 ? (profit / d.revenue * 100) : 0;
  const perCase = d.cases > 0 ? profit / d.cases : 0;

  const costRows = [
    { label: 'Chi phí quảng cáo', value: d.ads, icon: Megaphone, cls: 'text-rose-600 bg-rose-50' },
    { label: 'Viện phí', value: d.hospitalFee, icon: Banknote, cls: 'text-orange-600 bg-orange-50' },
    { label: 'Vật tư & chi khác', value: d.expenses, icon: Package, cls: 'text-purple-600 bg-purple-50' },
    { label: 'Lương + hoa hồng', value: d.labor, icon: Users, cls: 'text-blue-600 bg-blue-50' },
  ];
  const pct = (v) => totalCost > 0 ? Math.round(v / totalCost * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20"><PieChart className="w-6 h-6 text-white" /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 leading-tight">Lãi / Lỗ (P&amp;L)</h2>
            <p className="text-slate-400 text-sm">Lợi nhuận thực theo tháng · doanh thu trừ mọi chi phí</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}</select>
          <span className="text-slate-300">/</span>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none">{[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Thẻ lợi nhuận lớn */}
          <div className={`rounded-3xl p-6 text-white shadow-lg relative overflow-hidden ${profit >= 0 ? 'bg-gradient-to-br from-teal-500 to-emerald-700 shadow-emerald-600/20' : 'bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-600/20'}`}>
            <div className="absolute -top-10 -right-8 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-white/80 text-sm flex items-center gap-2">{profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} Lợi nhuận tháng {month}/{year}</div>
                <div className="text-4xl font-black mt-1">{fmt(profit)}</div>
                <div className="text-white/80 text-sm mt-2">Biên lợi nhuận <b>{margin.toFixed(1)}%</b> · {d.cases} ca mổ · TB <b>{fmt(perCase)}</b>/ca</div>
              </div>
              <div className="text-right">
                <div className="text-white/70 text-xs">Doanh thu</div>
                <div className="text-xl font-bold">{fmt(d.revenue)}</div>
                <div className="text-white/70 text-xs mt-2">Tổng chi phí</div>
                <div className="text-xl font-bold">{fmt(totalCost)}</div>
              </div>
            </div>
          </div>

          {/* Doanh thu */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5" /></span>
            <div className="flex-1"><div className="font-bold text-slate-800">Doanh thu (ca mổ)</div><div className="text-xs text-slate-400">{d.cases} ca đã mổ trong tháng</div></div>
            <div className="text-xl font-bold text-teal-600">{fmt(d.revenue)}</div>
          </div>

          {/* Chi phí */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between"><h3 className="font-bold text-slate-700">Chi phí</h3><span className="text-sm font-bold text-rose-600">− {fmt(totalCost)}</span></div>
            <div className="divide-y divide-slate-50">
              {costRows.map(r => (
                <div key={r.label} className="p-4 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.cls}`}><r.icon className="w-5 h-5" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-700">{r.label}</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-slate-300 rounded-full" style={{ width: `${pct(r.value)}%` }} /></div>
                  </div>
                  <div className="text-right shrink-0"><div className="font-bold text-slate-700">{fmt(r.value)}</div><div className="text-[11px] text-slate-400">{pct(r.value)}%</div></div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-50 rounded-xl p-3">
            <b>Cách tính:</b> Doanh thu = tổng doanh thu các ca đã mổ trong tháng (đã gồm upsale). Chi phí gồm: quảng cáo (đã tiêu) + viện phí + vật tư/chi khác (phiếu chi đã duyệt) + lương &amp; hoa hồng (đã trừ phần hoàn tạm ứng chi hộ để không trùng). <b>Lợi nhuận = Doanh thu − Tổng chi phí.</b> Tạm ứng chi hộ &amp; ứng lương (khoản cho vay) không tính là chi phí. Nếu số nào lệch thực tế, báo tôi tinh chỉnh công thức.
          </p>
        </>
      )}
    </div>
  );
}
