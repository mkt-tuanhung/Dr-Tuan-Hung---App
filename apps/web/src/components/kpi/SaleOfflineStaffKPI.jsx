import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, AlertCircle, CalendarCheck, Percent,
  Wallet, TrendingUp, Coins, ArrowUpRight, Target,
} from 'lucide-react';

import { computeSaleOffline, isRecheck } from '@/lib/kpiCalc';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const fmtM = (n) => (n ? new Intl.NumberFormat('vi-VN').format(n) : '0') + 'đ';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';

const STATUS_LABEL = { phau_thuat: 'Phẫu thuật', coc: 'Cọc', bong: 'Bong', scheduled: 'Đã hẹn', cancelled: 'Huỷ' };
const STATUS_COLOR = {
  phau_thuat: 'bg-teal-100 text-teal-700',
  coc: 'bg-blue-100 text-blue-700',
  bong: 'bg-red-100 text-red-600',
  scheduled: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

// Map class tĩnh (Tailwind không hỗ trợ class động dạng template literal)
const ACCENTS = {
  emerald: { chip: 'bg-teal-50 text-teal-600', value: 'text-teal-700' },
  blue:    { chip: 'bg-blue-50 text-blue-600',       value: 'text-blue-700' },
  violet:  { chip: 'bg-violet-50 text-violet-600',   value: 'text-violet-700' },
  orange:  { chip: 'bg-orange-50 text-orange-600',   value: 'text-orange-700' },
};

const StatCard = ({ icon: Icon, label, value, sub, accent = 'emerald' }) => {
  const c = ACCENTS[accent] || ACCENTS.emerald;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
        <span className={`w-7 h-7 rounded-lg ${c.chip} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {label}
      </div>
      <div className={`text-2xl font-black ${c.value} mt-2`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
};

const SaleOfflineStaffKPI = () => {
  const { profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState(null);
  const [appts, setAppts] = useState([]);       // Lịch hẹn theo appointment_date (đã loại tái khám)
  const [surgeries, setSurgeries] = useState([]); // Khách phẫu thuật theo surgery_date

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const [kpiRes, apptRes, surgRes] = await Promise.all([
      supabase.from('kpi_targets').select('*')
        .eq('staff_id', profile.id).eq('month', month).eq('year', year).maybeSingle(),
      // Tổng lịch hẹn trong tháng (theo appointment_date)
      supabase.from('customer_appointments')
        .select('id, customer_name, appointment_date, surgery_date, status, revenue, upsale_revenue, service, notes')
        .eq('sale_id', profile.id)
        .gte('appointment_date', monthStart).lte('appointment_date', monthEnd)
        .order('appointment_date', { ascending: false }),
      // Khách phẫu thuật trong tháng (theo surgery_date)
      supabase.from('customer_appointments')
        .select('id, customer_name, appointment_date, surgery_date, status, revenue, upsale_revenue, service, customer_source')
        .eq('sale_id', profile.id).eq('status', 'phau_thuat')
        .gte('surgery_date', monthStart).lte('surgery_date', monthEnd)
        .order('surgery_date', { ascending: false }),
    ]);
    if (apptRes.error) toast.error('Không tải được lịch hẹn: ' + apptRes.error.message);
    setKpi(kpiRes.data || null);
    // Loại bỏ lịch tái khám khỏi tổng lịch hẹn
    setAppts((apptRes.data || []).filter(a => !isRecheck(a)));
    setSurgeries((surgRes.data || []).filter(a => !isRecheck(a)));
    setLoading(false);
  }, [profile?.id, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // ---- Tính toán chỉ số (dùng hàm chung với admin) ----
  const ptList = surgeries; // Khách phẫu thuật trong tháng (theo surgery_date)
  const { total, cntPT, cntCoc, cntBong, closeRate, doanhThu, upsale, dtRate, hhDoanhThu, hhUpsale, tongHH }
    = computeSaleOffline(appts, surgeries);

  const revProgress = kpi?.target_revenue > 0 ? Math.min(Math.round(doanhThu / kpi.target_revenue * 100), 100) : 0;
  const rateProgress = kpi?.target_close_rate > 0 ? Math.min(Math.round(closeRate / kpi.target_close_rate * 100), 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-7 h-7 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + month nav */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">KPI của tôi · Sale Offline</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[96px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Chỉ tiêu KPI được giao */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="font-bold text-teal-700 flex items-center gap-2"><Target className="w-4 h-4" /> Chỉ tiêu KPI được giao</h3>
          <p className="text-xs text-slate-400 mt-0.5">Mục tiêu thực hiện trong tháng {year}-{String(month).padStart(2, '0')}</p>
        </div>
        <div className="p-5">
          {!kpi || (!kpi.target_revenue && !kpi.target_close_rate) ? (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl py-8 px-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="font-semibold text-amber-700">Chưa có KPI được giao cho tháng này.</div>
              <div className="text-sm text-amber-600/80 mt-0.5">Vui lòng liên hệ quản lý để được thiết lập chỉ tiêu.</div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">KPI Doanh thu</span>
                  <span className="font-bold text-slate-800">{revProgress}%</span>
                </div>
                <div className="text-lg font-black text-teal-700 mt-1">{fmtM(doanhThu)}</div>
                <div className="text-xs text-slate-400">Mục tiêu: {fmtM(kpi.target_revenue)}</div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${revProgress}%` }} />
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">KPI Tỷ lệ chốt</span>
                  <span className="font-bold text-slate-800">{rateProgress}%</span>
                </div>
                <div className="text-lg font-black text-blue-700 mt-1">{closeRate.toFixed(1)}%</div>
                <div className="text-xs text-slate-400">Mục tiêu: {Number(kpi.target_close_rate || 0).toFixed(1)}%</div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${rateProgress}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Doanh thu & Hoa hồng */}
      <div>
        <h3 className="font-bold text-slate-800 mb-3">Doanh thu & Hoa hồng</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={CalendarCheck} label="Tổng lịch hẹn" value={fmt(total)}
            sub={`Không tính tái khám · PT: ${cntPT} · Cọc: ${cntCoc} · Bong: ${cntBong}`} accent="blue" />
          <StatCard icon={Percent} label="Tỷ lệ chốt thực tế" value={`${closeRate.toFixed(1)}%`}
            sub="Khách phẫu thuật / Tổng lịch hẹn" accent="emerald" />
          <StatCard icon={Wallet} label="Doanh thu chốt được" value={fmtM(doanhThu)} accent="violet" />
          <StatCard icon={ArrowUpRight} label="Doanh thu Upsale" value={fmtM(upsale)} accent="orange" />
          <StatCard icon={Coins} label="Hoa hồng doanh thu" value={fmtM(hhDoanhThu)} sub={`(Doanh thu − Upsale) × ${dtRate.toFixed(1)}%`} accent="emerald" />
          <StatCard icon={TrendingUp} label="Hoa hồng Upsale" value={fmtM(hhUpsale)} sub="3–5% / khách (theo bậc upsale)" accent="blue" />
          <div className="col-span-2 bg-gradient-to-br from-rose-500 to-orange-500 text-white rounded-2xl p-4 shadow-md flex flex-col justify-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/90">Tổng hoa hồng ước tính</div>
            <div className="text-3xl font-black mt-1">{fmtM(tongHH)}</div>
            <div className="text-xs text-white/80 mt-1">HH doanh thu {fmtM(hhDoanhThu)} + HH upsale {fmtM(hhUpsale)}</div>
          </div>
        </div>
        {/* Ghi chú cách tính */}
        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-600">Cách tính hoa hồng:</div>
          <div>• <b>HH doanh thu</b> = (Doanh thu − Upsale) × A%. Bậc A theo tổng doanh thu: &lt;500tr = 1% · 500tr–&lt;1 tỷ = 1.5% · ≥1 tỷ = 2%.</div>
          <div>• <b>HH upsale</b> = Σ (upsale từng khách × B%). Bậc B theo upsale mỗi khách: &lt;50tr = 3% · 50tr–&lt;100tr = 4% · ≥100tr = 5%.</div>
          <div>• <b>Tổng hoa hồng</b> = HH doanh thu + HH upsale.</div>
        </div>
      </div>

      {/* Lịch hẹn khách hàng của tôi */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-teal-500" /> Lịch hẹn khách hàng của tôi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">STT</th>
                <th className="text-left px-4 py-2.5 font-medium">Ngày hẹn</th>
                <th className="text-left px-4 py-2.5 font-medium">Khách hàng</th>
                <th className="text-left px-4 py-2.5 font-medium">Trạng thái</th>
                <th className="text-left px-4 py-2.5 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {appts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có lịch hẹn khách hàng nào.</td></tr>
              ) : appts.map((a, i) => (
                <tr key={a.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2.5 text-slate-600">{a.appointment_date}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{a.customer_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABEL[a.status] || a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{a.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doanh thu được gán */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Wallet className="w-4 h-4 text-violet-500" /> Doanh thu được gán</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">STT</th>
                <th className="text-left px-4 py-2.5 font-medium">Ngày</th>
                <th className="text-left px-4 py-2.5 font-medium">Khách hàng</th>
                <th className="text-right px-4 py-2.5 font-medium">Doanh thu</th>
                <th className="text-right px-4 py-2.5 font-medium">Upsale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ptList.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có doanh thu được gán.</td></tr>
              ) : ptList.map((a, i) => (
                <tr key={a.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2.5 text-slate-600">{a.surgery_date || a.appointment_date}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{a.customer_name}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-teal-700">{fmtM(a.revenue)}</td>
                  <td className="px-4 py-2.5 text-right text-orange-600">{fmtM(a.upsale_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SaleOfflineStaffKPI;
