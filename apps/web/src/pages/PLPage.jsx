import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, DollarSign, Megaphone, Banknote, Package, Users, PieChart, Wallet, Shield, Plus, Trash2, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { vnToday } from '@/lib/vnTime';

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
  const [d, setD] = useState({ revenue: 0, ads: 0, hospitalFee: 0, expenses: 0, materials: 0, labor: 0, cases: 0, cocRev: 0, cocCount: 0, cocOffset: 0, cocOffsetCount: 0 });
  // Quỹ rủi ro: trích từ dòng tiền để dự phòng — P&L và dòng tiền tự trừ khoản trích
  const [risk, setRisk] = useState({ entries: [], monthDep: 0, monthWit: 0, totalFund: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = lastDay(year, month);
    const [apptRes, feeRes, adsRes, expRes, prRes, partnerRes, matRes, riskRes, cocRes] = await Promise.all([
      // Doanh thu ca mổ: chỉ khách đã phẫu thuật (kèm cọc để đối trừ chéo tháng)
      supabase.from('customer_appointments').select('revenue, surgery_date, deposit_amount, deposit_date').eq('status', 'phau_thuat'),
      // Viện phí: MỌI khách có viện phí trong tháng (bất kể trạng thái) — khớp module Viện phí
      supabase.from('customer_appointments').select('hospital_fee, hospital_fee_date').not('hospital_fee', 'is', null).gte('hospital_fee_date', startDate).lte('hospital_fee_date', endDate + 'T23:59:59'),
      supabase.from('marketing_ads_performance').select('amount_spent, date').gte('date', startDate).lte('date', endDate),
      supabase.from('expenses').select('amount, date, status').eq('status', 'paid').gte('date', startDate).lte('date', endDate),
      supabase.from('payroll').select('net_salary, unpaid_advance').eq('month', month).eq('year', year),
      supabase.from('partner_surgeries').select('partner_fee, surgery_date').eq('partner_paid', true).gte('surgery_date', startDate).lte('surgery_date', endDate),
      // Vật tư nhập mới trong tháng = khoản chi (phiếu nhập kho)
      supabase.from('inventory_transactions').select('amount, date').eq('type', 'import').gte('date', startDate).lte('date', endDate),
      supabase.from('risk_fund').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      // DT CỌC thu trong tháng: mọi khoản cọc có deposit_date trong tháng, KHÔNG lọc status
      // (khách lên ca mổ thì status thành phau_thuat nhưng tiền cọc vẫn tính ở tháng đã cọc)
      supabase.from('customer_appointments').select('deposit_amount').gt('deposit_amount', 0).gte('deposit_date', startDate).lte('deposit_date', endDate),
    ]);
    let revenue = 0, hospitalFee = 0, cases = 0, cocOffset = 0, cocOffsetCount = 0;
    (apptRes.data || []).forEach(a => {
      if (a.surgery_date && a.surgery_date >= startDate && a.surgery_date <= endDate) {
        revenue += Number(a.revenue || 0); cases++;
        // Ca mổ tháng này đã cọc từ trước (kể cả cọc tháng trước) -> đối trừ khỏi thực thu tháng này
        if (Number(a.deposit_amount || 0) > 0) { cocOffset += Number(a.deposit_amount || 0); cocOffsetCount++; }
      }
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
    setD({ revenue, ads, hospitalFee, expenses, materials, labor, cases, cocRev, cocCount: (cocRes.data || []).length, cocOffset, cocOffsetCount });
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

  const shiftMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; } else if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  };

  const riskNet = risk.monthDep - risk.monthWit; // trích ròng trong tháng
  const totalCost = d.ads + d.hospitalFee + d.expenses + d.materials + d.labor + riskNet;
  const profit = d.revenue - totalCost;
  const margin = d.revenue > 0 ? (profit / d.revenue * 100) : 0;
  const perCase = d.cases > 0 ? profit / d.cases : 0;

  const costRows = [
    { label: 'Chi phí quảng cáo', value: d.ads, icon: Megaphone, cls: 'e-tone-peach' },
    { label: 'Viện phí', value: d.hospitalFee, icon: Banknote, cls: 'e-tone-info' },
    { label: 'Vật tư nhập kho', value: d.materials, icon: Package, cls: 'e-tone-success' },
    { label: 'Chi khác (phiếu chi)', value: d.expenses, icon: Wallet, cls: 'e-tone-lavender' },
    { label: 'Lương + hoa hồng', value: d.labor, icon: Users, cls: 'e-tone-brand' },
    { label: 'Trích quỹ rủi ro', value: riskNet, icon: Shield, cls: 'e-tone-neutral' },
  ];
  const pct = (v) => totalCost > 0 ? Math.round(Math.max(0, v) / totalCost * 100) : 0;

  // ----- Form Quỹ rủi ro -----
  const [rf, setRf] = useState({ date: vnToday(), amount: '', kind: 'deposit', note: '' });
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
    <div className="space-y-4">
      {/* Thanh công cụ: mô tả + chọn kỳ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="e-page-desc">Lợi nhuận thực theo tháng · doanh thu trừ mọi chi phí &amp; quỹ rủi ro</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => shiftMonth(-1)} title="Tháng trước" className="e-icon-btn"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-1 h-10 px-3 rounded-xl border border-slate-200 bg-white">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-transparent text-[14px] font-semibold text-slate-800 outline-none cursor-pointer">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}</select>
            <span className="text-slate-300">/</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent text-[14px] font-semibold text-slate-800 outline-none cursor-pointer">{[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}</select>
          </div>
          <button type="button" onClick={() => shiftMonth(1)} title="Tháng sau" className="e-icon-btn"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Tab: Lãi/Lỗ · Quỹ rủi ro (gạch chân teal kiểu Ethics) */}
      <div className="e-tabs">
        <button onClick={() => setTab('pl')} className={`e-tab ${tab === 'pl' ? 'e-tab-active' : ''}`}><PieChart />Lãi / Lỗ</button>
        <button onClick={() => setTab('risk')} className={`e-tab ${tab === 'risk' ? 'e-tab-active' : ''}`}><Shield />Quỹ rủi ro<span className="e-tab-count tabular-nums">{fmt(risk.totalFund)}</span></button>
      </div>

      {loading ? (
        <div className="e-card flex justify-center h-40 items-center"><div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : tab === 'pl' ? (
        <>
          {/* Thẻ lợi nhuận — thẻ tổng kết trắng, số lớn đổi tông theo lãi/lỗ */}
          <div className={`e-card e-card-pad relative overflow-hidden ${profit >= 0 ? 'text-teal-700' : 'text-danger-600'}`}>
            <div className="hidden" />
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-slate-500 flex items-center gap-2">{profit >= 0 ? <TrendingUp className="w-4 h-4 text-success-600" /> : <TrendingDown className="w-4 h-4 text-danger-600" />} Lợi nhuận tháng {month}/{year}</div>
                <div className="text-[30px] lg:text-[34px] font-bold leading-tight mt-1 tabular-nums">{fmt(profit)}</div>
                <div className="text-[12.5px] text-slate-500 mt-1.5">Biên lợi nhuận <b className="text-slate-800">{margin.toFixed(1)}%</b> · {d.cases} ca mổ · TB <b className="text-slate-800">{fmt(perCase)}</b>/ca</div>
              </div>
              <div className="e-subtle px-4 py-3 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5 sm:grid-flow-col sm:grid-rows-2 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-0.5 lg:min-w-[520px]">
                <div className="e-kv-label">Doanh thu</div>
                <div className="text-[15px] lg:text-[16px] font-bold text-slate-900 tabular-nums text-right sm:text-left">{fmt(d.revenue)}</div>
                <div className="e-kv-label">Tổng chi phí (gồm trích quỹ)</div>
                <div className="text-[15px] lg:text-[16px] font-bold text-slate-900 tabular-nums text-right sm:text-left">{fmt(totalCost)}</div>
                <div className="e-kv-label">Tiền thực về trong tháng</div>
                <div className="text-[15px] lg:text-[16px] font-bold text-teal-700 tabular-nums text-right sm:text-left">{fmt(d.revenue - d.cocOffset + d.cocRev)}</div>
              </div>
            </div>
          </div>

          {/* Dòng tiền tháng: sổ phép tính gọn (kiểu bảng P&L Ethics) */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 grid place-items-center shrink-0"><Banknote className="w-[18px] h-[18px]" /></span>
              <h3 className="e-card-title">Dòng tiền tháng {month}/{year}</h3>
            </div>
            <div className="divide-y divide-slate-100 text-[14px]">
              <div className="px-4 lg:px-5 py-3 flex items-center gap-3">
                <span className="w-5 text-center font-bold text-slate-300"> </span>
                <div className="flex-1 min-w-0"><span className="font-semibold text-slate-800">Doanh thu ca mổ</span> <span className="text-[12px] text-slate-400">· {d.cases} ca</span></div>
                <div className="font-semibold text-slate-900 tabular-nums">{fmt(d.revenue)}</div>
              </div>
              <div className="px-4 lg:px-5 py-3 flex items-center gap-3">
                <span className="w-5 text-center font-bold text-warning-600">−</span>
                <div className="flex-1 min-w-0"><span className="text-slate-600 pl-0">Cọc đã thu trước</span> <span className="text-[12px] text-slate-400">· {d.cocOffsetCount} ca đã cọc (kể cả tháng trước)</span></div>
                <div className="font-semibold text-warning-600 tabular-nums">− {fmt(d.cocOffset)}</div>
              </div>
              <div className="px-4 lg:px-5 py-3 flex items-center gap-3 bg-teal-50/70">
                <span className="w-5 text-center font-bold text-teal-700">=</span>
                <div className="flex-1 min-w-0"><span className="font-bold text-teal-800">Thực thu từ ca mổ</span></div>
                <div className="font-bold text-teal-800 tabular-nums">{fmt(d.revenue - d.cocOffset)}</div>
              </div>
              <div className="px-4 lg:px-5 py-3 flex items-center gap-3">
                <span className="w-5 text-center font-bold text-info-600">+</span>
                <div className="flex-1 min-w-0"><span className="text-slate-600">Cọc thu trong tháng</span> <span className="text-[12px] text-slate-400">· {d.cocCount} khách — đối trừ khi lên ca mổ</span></div>
                <div className="font-semibold text-info-600 tabular-nums">+ {fmt(d.cocRev)}</div>
              </div>
            </div>
            <div className="px-4 lg:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-[13px] lg:text-[14px] font-bold text-teal-900">Tổng tiền thực về trong tháng</div>
              <div className="text-[18px] lg:text-[20px] font-bold text-teal-900 tabular-nums">{fmt(d.revenue - d.cocOffset + d.cocRev)}</div>
            </div>
          </div>

          {/* Chi phí */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3"><h3 className="e-card-title">Chi phí</h3><span className="e-badge e-tone-danger tabular-nums">− {fmt(totalCost)}</span></div>
            <div className="divide-y divide-slate-100">
              {costRows.map(r => (
                <div key={r.label} className="px-4 lg:px-5 py-3 min-h-[64px] flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${r.cls}`}><r.icon className="w-[18px] h-[18px]" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-slate-700">{r.label}</div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${pct(r.value)}%` }} /></div>
                  </div>
                  <div className="text-right shrink-0 min-w-[96px]"><div className="text-[14px] font-semibold text-slate-900 tabular-nums">{fmt(r.value)}</div><div className="text-[12px] text-slate-400 tabular-nums">{pct(r.value)}%</div></div>
                </div>
              ))}
            </div>
          </div>

          <p className="e-subtle p-3.5 text-[12.5px] text-slate-500 leading-relaxed">
            <b>Cách tính:</b> Doanh thu = tổng doanh thu các ca đã mổ trong tháng (đã gồm upsale). Chi phí gồm: quảng cáo (đã tiêu) + viện phí + <b>vật tư nhập kho</b> + chi khác (phiếu chi đã duyệt) + lương &amp; hoa hồng + <b>trích quỹ rủi ro</b> (trích − rút trong tháng). <b>Lợi nhuận = Doanh thu − Tổng chi phí.</b> Tạm ứng chi hộ &amp; ứng lương (khoản cho vay) không tính là chi phí. <b>Tiền cọc (dòng tiền):</b> DT cọc thu trong tháng = mọi khoản cọc thu về theo ngày cọc (kể cả khách sau này đã mổ). Khi khách lên ca mổ, doanh thu ca mổ ghi ĐỦ giá dịch vụ, nên <b>Thực thu ca mổ = Doanh thu ca mổ − phần cọc đã thu trước của chính các ca đó</b> (VD: cọc 20tr tháng 6, mổ 80tr tháng 7 → tháng 6 thực về 20tr, tháng 7 thực về 60tr). Lợi nhuận vẫn tính trên Doanh thu ca mổ (giá trị dịch vụ), không tính trên dòng tiền.
          </p>
        </>
      ) : (
        <>
          {/* ===== TAB QUỸ RỦI RO ===== */}
          <div className="e-card e-card-pad relative overflow-hidden">
            <div className="hidden" />
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-slate-500 flex items-center gap-2"><Shield className="w-4 h-4 text-teal-600" /> Tổng quỹ rủi ro (tích lũy)</div>
                <div className="text-[30px] lg:text-[34px] font-bold text-teal-700 leading-tight mt-1 tabular-nums">{fmt(risk.totalFund)}</div>
                <div className="text-[12.5px] text-slate-500 mt-1.5">Tiền trích từ dòng tiền để dự phòng — lợi nhuận &amp; dòng tiền tự trừ khoản trích</div>
              </div>
              <div className="e-subtle px-4 py-3 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5 sm:grid-flow-col sm:grid-rows-2 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0.5 lg:min-w-[340px]">
                <div className="e-kv-label">Trích tháng {month}</div>
                <div className="text-[15px] lg:text-[16px] font-bold text-teal-700 tabular-nums text-right sm:text-left">+{fmt(risk.monthDep)}</div>
                <div className="e-kv-label">Rút tháng {month}</div>
                <div className="text-[15px] lg:text-[16px] font-bold text-peach-600 tabular-nums text-right sm:text-left">−{fmt(risk.monthWit)}</div>
              </div>
            </div>
          </div>

          {/* Form trích / rút */}
          {canWrite && (
            <form onSubmit={addRisk} className="e-card e-card-pad grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="e-label">Ngày</label>
                <input type="date" value={rf.date} onChange={e => setRf({ ...rf, date: e.target.value })} className="e-input" />
              </div>
              <div>
                <label className="e-label">Loại</label>
                <select value={rf.kind} onChange={e => setRf({ ...rf, kind: e.target.value })} className="e-input cursor-pointer">
                  <option value="deposit">Trích vào quỹ (dòng tiền −)</option>
                  <option value="withdraw">Rút khỏi quỹ (dòng tiền +)</option>
                </select>
              </div>
              <div>
                <label className="e-label">Số tiền (VND)</label>
                <input inputMode="numeric" value={fmtInput(rf.amount)} onChange={e => setRf({ ...rf, amount: e.target.value.replace(/\D/g, '') })} placeholder="VD: 50.000.000" className="e-input font-semibold tabular-nums" />
              </div>
              <div>
                <label className="e-label">Ghi chú</label>
                <input value={rf.note} onChange={e => setRf({ ...rf, note: e.target.value })} placeholder="VD: trích quỹ tháng 8" className="e-input" />
              </div>
              <button type="submit" disabled={savingRf} className="e-btn e-btn-primary w-full"><Plus className="w-4 h-4" />{rf.kind === 'withdraw' ? 'Rút quỹ' : 'Trích quỹ'}</button>
            </form>
          )}

          {/* Danh sách bút toán tháng */}
          <div className="e-card overflow-hidden">
            <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="e-card-title">Lịch sử bút toán (toàn bộ)</h3>
              <span className="e-badge e-tone-brand tabular-nums">Trích ròng tháng {month}/{year}: {fmt(riskNet)}</span>
            </div>
            {risk.entries.length === 0 ? (
              <div className="e-empty text-[13px] text-slate-400">Chưa có bút toán nào</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {risk.entries.map(r => (
                  <div key={r.id} className="px-4 lg:px-5 py-3 min-h-[64px] flex items-center gap-3 hover:bg-teal-50/30 transition">
                    <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${r.kind === 'withdraw' ? 'e-tone-peach' : 'e-tone-brand'}`}>
                      {r.kind === 'withdraw' ? <ArrowUpRight className="w-[18px] h-[18px]" /> : <ArrowDownLeft className="w-[18px] h-[18px]" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-slate-800">{r.kind === 'withdraw' ? 'Rút khỏi quỹ' : 'Trích vào quỹ'}</div>
                      <div className="text-[12px] text-slate-500 truncate">{new Date(r.date).toLocaleDateString('vi-VN')}{r.note ? ` · ${r.note}` : ''}</div>
                    </div>
                    <div className={`text-[14px] font-bold tabular-nums shrink-0 ${r.kind === 'withdraw' ? 'text-peach-600' : 'text-teal-700'}`}>{r.kind === 'withdraw' ? '−' : '+'}{fmt(r.amount)}</div>
                    {canWrite && <button onClick={() => delRisk(r.id)} title="Xoá" className="e-icon-btn w-9 h-9 shrink-0 hover:!text-danger-600 hover:!border-danger-200 hover:bg-danger-50"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="e-subtle p-3.5 text-[12.5px] text-slate-500 leading-relaxed">
            <b>Cơ chế:</b> Mỗi lần <b>trích vào quỹ</b>, khoản đó tự động bị trừ khỏi <b>Lợi nhuận tháng</b> (tab Lãi/Lỗ) và <b>Vốn lưu động</b> (Kế toán dòng tiền). <b>Rút khỏi quỹ</b> thì cộng ngược lại. Tổng quỹ tích lũy = tổng trích − tổng rút từ trước đến nay.
          </p>
        </>
      )}
    </div>
  );
}
