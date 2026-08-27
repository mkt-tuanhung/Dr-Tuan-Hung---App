import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, DollarSign, Megaphone, Banknote, Package, Users, PieChart, Wallet, Shield, Plus, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
const lastDay = (y, m) => `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
const fmtInput = (v) => { const n = String(v || '').replace(/\D/g, ''); return n ? new Intl.NumberFormat('vi-VN').format(n) : ''; };

export default function PLPage() {
  const now = new Date();
  const { profile } = useAuth();
  const canWrite = ['admin', 'accountant'].includes(profile?.role);
  const [tab, setTab] = useState('pl'); // 'pl' | 'risk'
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({ revenue: 0, ads: 0, hospitalFee: 0, expenses: 0, materials: 0, labor: 0, cases: 0, cocRev: 0, cocCount: 0 });
  // Quỹ rủi ro: trích từ dòng tiền để dự phòng — P&L và dòng tiền tự trừ khoản trích
  const [risk, setRisk] = useState({ entries: [], monthDep: 0, monthWit: 0, totalFund: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = lastDay(year, month);
    const [apptRes, feeRes, adsRes, expRes, prRes, partnerRes, matRes, riskRes, cocRes] = await Promise.all([
      // Doanh thu ca mổ: chỉ khách đã phẫu thuật
      supabase.from('customer_appointments').select('revenue, surgery_date').eq('status', 'phau_thuat'),
      // Viện phí: MỌI khách có viện phí trong tháng (bất kể trạng thái) — khớp module Viện phí
      supabase.from('customer_appointments').select('hospital_fee, hospital_fee_date').not('hospital_fee', 'is', null).gte('hospital_fee_date', startDate).lte('hospital_fee_date', endDate + 'T23:59:59'),
      supabase.from('marketing_ads_performance').select('amount_spent, date').gte('date', startDate).lte('date', endDate),
      supabase.from('expenses').select('amount, date, status').eq('status', 'paid').gte('date', startDate).lte('date', endDate),
      supabase.from('payroll').select('net_salary, unpaid_advance').eq('month', month).eq('year', year),
      supabase.from('partner_surgeries').select('partner_fee, surgery_date').eq('partner_paid', true).gte('surgery_date', startDate).lte('surgery_date', endDate),
      // Vật tư nhập mới trong tháng = khoản chi (phiếu nhập kho)
      supabase.from('inventory_transactions').select('amount, date').eq('type', 'import').gte('date', startDate).lte('date', endDate),
      supabase.from('risk_fund').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      // Doanh thu CỌC: tiền cọc đã thu trong tháng (khách đang cọc)
      supabase.from('customer_appointments').select('deposit_amount').eq('status', 'coc').gte('deposit_date', startDate).lte('deposit_date', endDate),
    ]);
    let revenue = 0, hospitalFee = 0, cases = 0;
    (apptRes.data || []).forEach(a => {
      if (a.surgery_date && a.surgery_date >= startDate && a.surgery_date <= endDate) { revenue += Number(a.revenue || 0); cases++; }
    });
    // Viện phí = mọi khách có viện phí trong tháng (đã lọc theo hospital_fee_date ở truy vấn)
    (feeRes.data || []).forEach(a => { hospitalFee += Number(a.hospital_fee || 0); });
    // Thu nhập thêm từ mổ đối tác → cộng vào doanh thu (công BS/phụ mổ đã nằm trong chi phí lương)
    (partnerRes.data || []).forEach(p => { revenue += Number(p.partner_fee || 0); cases++; });
    const ads = (adsRes.data || []).reduce((s, x) => s + Number(x.amount_spent || 0), 0);
    const expenses = (expRes.data || []).reduce((s, x) => s + Number(x.amount || 0), 0);
    const materials = (matRes.data || []).reduce((s, x) => s + Number(x.amount || 0), 0);
    const labor = (prRes.data || []).reduce((s, x) => s + (Number(x.net_salary || 0) - Number(x.unpaid_advance || 0)), 0);
    const cocRev = (cocRes.data || []).reduce((s2, c) => s2 + Number(c.deposit_amount || 0), 0);
    setD({ revenue, ads, hospitalFee, expenses, materials, labor, cases, cocRev, cocCount: (cocRes.data || []).length });
    const allRisk = riskRes.data || [];
    const inMonth = allRisk.filter(r => r.date >= startDate && r.date <= endDate);
    setRisk({
      entries: allRisk, // hiển thị TOÀN BỘ lịch sử (không lọc tháng) — tháng chỉ dùng cho số liệu trích/rút
      monthDep: inMonth.filter(r => r.kind !== 'withdraw').reduce((s, r) => s + Number(r.amount || 0), 0),
      monthWit: inMonth.filter(r => r.kind === 'withdraw').reduce((s, r) => s + Number(r.amount || 0), 0),
      totalFund: allRisk.reduce((s, r) => s + (r.kind === 'withdraw' ? -1 : 1) * Number(r.amount || 0), 0),
    });
    setLoading(false);
  }, [month, year]);
  useEffect(() => { load(); }, [load]);
  useRealtimeReload('customer_appointments,marketing_ads_performance,expenses,payroll,inventory_transactions,risk_fund', load);

  const riskNet = risk.monthDep - risk.monthWit; // trích ròng trong tháng
  const totalCost = d.ads + d.hospitalFee + d.expenses + d.materials + d.labor + riskNet;
  const profit = d.revenue - totalCost;
  const margin = d.revenue > 0 ? (profit / d.revenue * 100) : 0;
  const perCase = d.cases > 0 ? profit / d.cases : 0;

  const costRows = [
    { label: 'Chi phí quảng cáo', value: d.ads, icon: Megaphone, cls: 'text-rose-600 bg-rose-50' },
    { label: 'Viện phí', value: d.hospitalFee, icon: Banknote, cls: 'text-orange-600 bg-orange-50' },
    { label: 'Vật tư nhập kho', value: d.materials, icon: Package, cls: 'text-emerald-600 bg-emerald-50' },
    { label: 'Chi khác (phiếu chi)', value: d.expenses, icon: Wallet, cls: 'text-purple-600 bg-purple-50' },
    { label: 'Lương + hoa hồng', value: d.labor, icon: Users, cls: 'text-blue-600 bg-blue-50' },
    { label: 'Trích quỹ rủi ro', value: riskNet, icon: Shield, cls: 'text-indigo-600 bg-indigo-50' },
  ];
  const pct = (v) => totalCost > 0 ? Math.round(Math.max(0, v) / totalCost * 100) : 0;

  // ----- Form Quỹ rủi ro -----
  const [rf, setRf] = useState({ date: new Date().toISOString().split('T')[0], amount: '', kind: 'deposit', note: '' });
  const [savingRf, setSavingRf] = useState(false);
  const addRisk = async (e) => {
    e.preventDefault();
    const amount = Number(String(rf.amount).replace(/\D/g, ''));
    if (!amount) { toast.error('Nhập số tiền'); return; }
    setSavingRf(true);
    const { error } = await supabase.from('risk_fund').insert({ date: rf.date, amount, kind: rf.kind, note: rf.note || null, created_by: profile?.id });
    setSavingRf(false);
    if (error) { toast.error('Lỗi: ' + error.message); return; }
    toast.success(rf.kind === 'withdraw' ? 'Đã rút khỏi quỹ — dòng tiền cộng lại khoản này' : 'Đã trích vào quỹ — dòng tiền & lợi nhuận tự trừ');
    setRf(f => ({ ...f, amount: '', note: '' }));
    const dd = new Date(rf.date); setMonth(dd.getMonth() + 1); setYear(dd.getFullYear());
    load();
  };
  const delRisk = async (id) => {
    if (!confirm('Xoá bút toán quỹ rủi ro này?')) return;
    const { error } = await supabase.from('risk_fund').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Đã xoá'); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20"><PieChart className="w-6 h-6 text-white" /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 leading-tight">Lãi / Lỗ (P&amp;L)</h2>
            <p className="text-slate-400 text-sm">Lợi nhuận thực theo tháng · doanh thu trừ mọi chi phí &amp; quỹ rủi ro</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}</select>
          <span className="text-slate-300">/</span>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold text-slate-700 outline-none">{[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
      </div>

      {/* Tab: Lãi/Lỗ · Quỹ rủi ro */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit">
        <button onClick={() => setTab('pl')} className={`px-4 py-2 rounded-xl text-sm font-bold transition inline-flex items-center gap-1.5 ${tab === 'pl' ? 'bg-white shadow-sm text-teal-600' : 'text-slate-500 hover:text-slate-700'}`}><PieChart className="w-4 h-4" />Lãi / Lỗ</button>
        <button onClick={() => setTab('risk')} className={`px-4 py-2 rounded-xl text-sm font-bold transition inline-flex items-center gap-1.5 ${tab === 'risk' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><Shield className="w-4 h-4" />Quỹ rủi ro<span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{fmt(risk.totalFund)}</span></button>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center"><div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>
      ) : tab === 'pl' ? (
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
                <div className="text-white/70 text-xs mt-2">Tổng chi phí (gồm trích quỹ)</div>
                <div className="text-xl font-bold">{fmt(totalCost)}</div>
              </div>
            </div>
          </div>

          {/* Doanh thu: ca mổ · CỌC · thực thu */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            <div className="p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5" /></span>
              <div className="flex-1"><div className="font-bold text-slate-800">Doanh thu (ca mổ)</div><div className="text-xs text-slate-400">{d.cases} ca đã mổ trong tháng</div></div>
              <div className="text-xl font-bold text-teal-600">{fmt(d.revenue)}</div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5" /></span>
              <div className="flex-1"><div className="font-bold text-slate-800">Doanh thu CỌC</div><div className="text-xs text-slate-400">{d.cocCount} khách cọc trong tháng — đối trừ khi lên ca mổ, KHÔNG cộng vào lợi nhuận</div></div>
              <div className="text-xl font-bold text-violet-600">{fmt(d.cocRev)}</div>
            </div>
            <div className="p-4 flex items-center gap-3 bg-emerald-50/40">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5" /></span>
              <div className="flex-1"><div className="font-bold text-slate-800">Doanh thu thực thu</div><div className="text-xs text-slate-400">= Doanh thu (ca mổ) − Doanh thu cọc</div></div>
              <div className="text-xl font-bold text-emerald-600">{fmt(d.revenue - d.cocRev)}</div>
            </div>
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
            <b>Cách tính:</b> Doanh thu = tổng doanh thu các ca đã mổ trong tháng (đã gồm upsale). Chi phí gồm: quảng cáo (đã tiêu) + viện phí + <b>vật tư nhập kho</b> + chi khác (phiếu chi đã duyệt) + lương &amp; hoa hồng + <b>trích quỹ rủi ro</b> (trích − rút trong tháng). <b>Lợi nhuận = Doanh thu − Tổng chi phí.</b> Tạm ứng chi hộ &amp; ứng lương (khoản cho vay) không tính là chi phí. <b>Doanh thu cọc</b> là tiền cọc đã thu của khách đang cọc trong tháng — hiển thị để theo dõi, không cộng vào lợi nhuận (sẽ nằm trong doanh thu ca mổ khi khách phẫu thuật); <b>Doanh thu thực thu = Doanh thu − DT cọc</b>.
          </p>
        </>
      ) : (
        <>
          {/* ===== TAB QUỸ RỦI RO ===== */}
          <div className="rounded-3xl p-6 text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-700 shadow-indigo-600/20">
            <div className="absolute -top-10 -right-8 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-white/80 text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Tổng quỹ rủi ro (tích lũy)</div>
                <div className="text-4xl font-black mt-1">{fmt(risk.totalFund)}</div>
                <div className="text-white/80 text-sm mt-2">Tiền trích từ dòng tiền để dự phòng — lợi nhuận &amp; dòng tiền tự trừ khoản trích</div>
              </div>
              <div className="text-right">
                <div className="text-white/70 text-xs">Trích tháng {month}</div>
                <div className="text-xl font-bold">+{fmt(risk.monthDep)}</div>
                <div className="text-white/70 text-xs mt-2">Rút tháng {month}</div>
                <div className="text-xl font-bold">−{fmt(risk.monthWit)}</div>
              </div>
            </div>
          </div>

          {/* Form trích / rút */}
          {canWrite && (
            <form onSubmit={addRisk} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Ngày</label>
                <input type="date" value={rf.date} onChange={e => setRf({ ...rf, date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Loại</label>
                <select value={rf.kind} onChange={e => setRf({ ...rf, kind: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white">
                  <option value="deposit">Trích vào quỹ (dòng tiền −)</option>
                  <option value="withdraw">Rút khỏi quỹ (dòng tiền +)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Số tiền (VND)</label>
                <input inputMode="numeric" value={fmtInput(rf.amount)} onChange={e => setRf({ ...rf, amount: e.target.value.replace(/\D/g, '') })} placeholder="VD: 50.000.000" className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Ghi chú</label>
                <input value={rf.note} onChange={e => setRf({ ...rf, note: e.target.value })} placeholder="VD: trích quỹ tháng 8" className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-400 outline-none" />
              </div>
              <button type="submit" disabled={savingRf} className="h-[42px] rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" />{rf.kind === 'withdraw' ? 'Rút quỹ' : 'Trích quỹ'}</button>
            </form>
          )}

          {/* Danh sách bút toán tháng */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-bold text-slate-700">Lịch sử bút toán (toàn bộ)</h3>
              <span className="text-sm font-bold text-indigo-600">Trích ròng tháng {month}/{year}: {fmt(riskNet)}</span>
            </div>
            {risk.entries.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">Chưa có bút toán nào</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {risk.entries.map(r => (
                  <div key={r.id} className="p-4 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.kind === 'withdraw' ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {r.kind === 'withdraw' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700">{r.kind === 'withdraw' ? 'Rút khỏi quỹ' : 'Trích vào quỹ'}</div>
                      <div className="text-xs text-slate-400">{new Date(r.date).toLocaleDateString('vi-VN')}{r.note ? ` · ${r.note}` : ''}</div>
                    </div>
                    <div className={`font-bold shrink-0 ${r.kind === 'withdraw' ? 'text-orange-600' : 'text-indigo-600'}`}>{r.kind === 'withdraw' ? '−' : '+'}{fmt(r.amount)}</div>
                    {canWrite && <button onClick={() => delRisk(r.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-50 rounded-xl p-3">
            <b>Cơ chế:</b> Mỗi lần <b>trích vào quỹ</b>, khoản đó tự động bị trừ khỏi <b>Lợi nhuận tháng</b> (tab Lãi/Lỗ) và <b>Vốn lưu động</b> (Kế toán dòng tiền). <b>Rút khỏi quỹ</b> thì cộng ngược lại. Tổng quỹ tích lũy = tổng trích − tổng rút từ trước đến nay.
          </p>
        </>
      )}
    </div>
  );
}
