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
  phau_thuat: 'e-tone-success',
  coc: 'e-tone-info',
  bong: 'e-tone-danger',
  scheduled: 'e-tone-neutral',
  cancelled: 'e-tone-neutral',
};

// Map class tĩnh (Tailwind không hỗ trợ class động dạng template literal)
const ACCENTS = {
  emerald: { chip: 'bg-teal-50 text-teal-700', value: 'text-slate-900' },
  blue:    { chip: 'bg-info-50 text-info-600',       value: 'text-slate-900' },
  violet:  { chip: 'bg-lavender-50 text-lavender-600',   value: 'text-slate-900' },
  orange:  { chip: 'bg-peach-50 text-peach-600',   value: 'text-slate-900' },
};

const StatCard = ({ icon: Icon, label, value, sub, accent = 'emerald' }) => {
  const c = ACCENTS[accent] || ACCENTS.emerald;
  return (
    <div className="e-metric flex-col lg:flex-row items-start p-3.5 lg:p-4 gap-2.5 lg:gap-3">
      <span className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full ${c.chip} grid place-items-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0 w-full lg:w-auto">
        <div className="e-metric-label whitespace-normal text-[12.5px] lg:text-[13px]">{label}</div>
        <div className={`text-[18px] lg:text-[20px] font-bold leading-tight tabular-nums break-words mt-0.5 ${c.value}`}>{value}</div>
        {sub && <div className="text-[11.5px] text-slate-400 mt-1">{sub}</div>}
      </div>
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
        <div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + month nav (điện thoại: chỉ còn bộ chuyển tháng to, dễ bấm) */}
      <div className="e-toolbar justify-between pl-2.5 lg:pl-4">
        <div className="hidden lg:block">
          <h2 className="text-[15px] font-semibold text-slate-900">KPI của tôi · Sale Offline</h2>
          <p className="e-page-desc">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
          <button onClick={prevMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng trước">
            <ChevronLeft className="w-5 h-5 lg:w-4 lg:h-4" />
          </button>
          <span className="flex flex-col items-center lg:block min-w-[104px] text-center">
            <span className="block text-[15px] lg:text-[13.5px] font-semibold text-slate-800 tabular-nums">{MONTHS[month - 1]} {year}</span>
            <span className="lg:hidden text-[12px] text-slate-500 mt-0.5">KPI Sale Offline</span>
          </span>
          <button onClick={nextMonth} className="e-icon-btn w-11 h-11 lg:w-9 lg:h-9" aria-label="Tháng sau">
            <ChevronRight className="w-5 h-5 lg:w-4 lg:h-4" />
          </button>
        </div>
      </div>

      {/* Chỉ tiêu KPI được giao */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><Target className="w-4 h-4 text-teal-700 lg:text-current" /> Chỉ tiêu KPI được giao</h3>
          <p className="text-xs text-slate-400 mt-0.5">Mục tiêu thực hiện trong tháng {year}-{String(month).padStart(2, '0')}</p>
        </div>
        <div className="p-4 lg:p-5">
          {!kpi || (!kpi.target_revenue && !kpi.target_close_rate) ? (
            <div className="e-subtle e-empty">
              <div className="e-empty-icon bg-warning-50 text-warning-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="e-empty-title">Chưa có KPI được giao cho tháng này.</div>
              <div className="e-empty-desc">Vui lòng liên hệ quản lý để được thiết lập chỉ tiêu.</div>
            </div>
          ) : (
            <>
              {/* Điện thoại: vòng KPI to + dòng tiến độ (kiểu Ethics M15) */}
              <div className="lg:hidden">
                <div className="relative w-[200px] h-[200px] mx-auto mt-1 rounded-full"
                  style={{ background: `conic-gradient(#3CA7A9 0%, #067B7F ${revProgress}%, #EAF4F4 ${revProgress}% 100%)` }}>
                  <div className="absolute inset-[22px] rounded-full bg-white grid place-items-center text-center">
                    <div>
                      <div className="text-[44px] font-bold text-slate-900 leading-none tabular-nums">{revProgress}%</div>
                      <div className="text-[13px] text-slate-500 mt-1.5">KPI Doanh thu</div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-medium text-slate-700">KPI Doanh thu</span>
                      <span className="text-[13.5px] font-bold text-teal-700 tabular-nums">{revProgress}%</span>
                    </div>
                    <div className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums"><b className="font-semibold text-slate-900">{fmtM(doanhThu)}</b> / {fmtM(kpi.target_revenue)}</div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-gradient-to-r from-[#067B7F] to-[#3CA7A9]" style={{ width: `${revProgress}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-medium text-slate-700">KPI Tỷ lệ chốt</span>
                      <span className="text-[13.5px] font-bold text-teal-700 tabular-nums">{rateProgress}%</span>
                    </div>
                    <div className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums"><b className="font-semibold text-slate-900">{closeRate.toFixed(1)}%</b> / {Number(kpi.target_close_rate || 0).toFixed(1)}%</div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-gradient-to-r from-[#067B7F] to-[#3CA7A9]" style={{ width: `${rateProgress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Máy tính: giữ nguyên */}
              <div className="hidden lg:grid sm:grid-cols-2 gap-4">
                <div className="e-subtle p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">KPI Doanh thu</span>
                    <span className="font-bold text-slate-800">{revProgress}%</span>
                  </div>
                  <div className="text-[20px] font-bold text-slate-900 mt-1 tabular-nums">{fmtM(doanhThu)}</div>
                  <div className="text-xs text-slate-400">Mục tiêu: {fmtM(kpi.target_revenue)}</div>
                  <div className="w-full bg-white rounded-full h-2 mt-3 overflow-hidden">
                    <div className="h-2 rounded-full bg-teal-500" style={{ width: `${revProgress}%` }} />
                  </div>
                </div>
                <div className="e-subtle p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">KPI Tỷ lệ chốt</span>
                    <span className="font-bold text-slate-800">{rateProgress}%</span>
                  </div>
                  <div className="text-[20px] font-bold text-slate-900 mt-1 tabular-nums">{closeRate.toFixed(1)}%</div>
                  <div className="text-xs text-slate-400">Mục tiêu: {Number(kpi.target_close_rate || 0).toFixed(1)}%</div>
                  <div className="w-full bg-white rounded-full h-2 mt-3 overflow-hidden">
                    <div className="h-2 rounded-full bg-teal-700" style={{ width: `${rateProgress}%` }} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Doanh thu & Hoa hồng */}
      <div>
        <h3 className="text-[18px] lg:text-[16px] font-bold lg:font-[650] text-slate-900 mt-1 lg:mt-0 mb-3">Doanh thu & Hoa hồng</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={CalendarCheck} label="Tổng lịch hẹn" value={fmt(total)}
            sub={`Không tính tái khám · PT: ${cntPT} · Cọc: ${cntCoc} · Bong: ${cntBong}`} accent="blue" />
          <StatCard icon={Percent} label="Tỷ lệ chốt thực tế" value={`${closeRate.toFixed(1)}%`}
            sub="Khách phẫu thuật / Tổng lịch hẹn" accent="emerald" />
          <StatCard icon={Wallet} label="Doanh thu chốt được" value={fmtM(doanhThu)} accent="violet" />
          <StatCard icon={ArrowUpRight} label="Doanh thu Upsale" value={fmtM(upsale)} accent="orange" />
          <StatCard icon={Coins} label="Hoa hồng doanh thu" value={fmtM(hhDoanhThu)} sub={`(Doanh thu − Upsale) × ${dtRate.toFixed(1)}%`} accent="emerald" />
          <StatCard icon={TrendingUp} label="Hoa hồng Upsale" value={fmtM(hhUpsale)} sub="3–5% / khách (theo bậc upsale)" accent="blue" />
          <div className="col-span-2 -order-1 lg:order-none e-card e-card-pad bg-teal-50 border-teal-100 flex flex-col justify-center">
            <div className="e-caption text-teal-700">Tổng hoa hồng ước tính</div>
            <div className="text-[28px] font-bold text-teal-800 mt-1 tabular-nums">{fmtM(tongHH)}</div>
            <div className="text-[12px] text-slate-600 mt-1">HH doanh thu {fmtM(hhDoanhThu)} + HH upsale {fmtM(hhUpsale)}</div>
          </div>
        </div>
        {/* Ghi chú cách tính */}
        <div className="mt-3 e-subtle p-4 text-[12.5px] text-slate-500 space-y-1">
          <div className="font-semibold text-slate-600">Cách tính hoa hồng:</div>
          <div>• <b>HH doanh thu</b> = (Doanh thu − Upsale) × A%. Bậc A theo tổng doanh thu: &lt;500tr = 1% · 500tr–&lt;1 tỷ = 1.5% · ≥1 tỷ = 2%.</div>
          <div>• <b>HH upsale</b> = Σ (upsale từng khách × B%). Bậc B theo upsale mỗi khách: &lt;50tr = 3% · 50tr–&lt;100tr = 4% · ≥100tr = 5%.</div>
          <div>• <b>Tổng hoa hồng</b> = HH doanh thu + HH upsale.</div>
        </div>
      </div>

      {/* Lịch hẹn khách hàng của tôi */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-teal-600" /> Lịch hẹn khách hàng của tôi</h3>
        </div>
        {/* Điện thoại: danh sách thẻ */}
        <div className="lg:hidden divide-y divide-slate-100">
          {appts.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-slate-400">Chưa có lịch hẹn khách hàng nào.</div>
          ) : appts.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 grid place-items-center text-[13px] font-semibold shrink-0 tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold text-slate-900 truncate">{a.customer_name}</div>
                <div className="text-[12.5px] text-slate-500 mt-0.5 truncate"><span className="tabular-nums">{a.appointment_date}</span> · {a.notes || '—'}</div>
              </div>
              <span className={`e-badge e-badge-sm shrink-0 ${STATUS_COLOR[a.status] || 'e-tone-neutral'}`}>
                {STATUS_LABEL[a.status] || a.status}
              </span>
            </div>
          ))}
        </div>
        <div className="hidden lg:block overflow-x-auto">
          <table className="e-table">
            <thead>
              <tr>
                <th className="text-left">STT</th>
                <th className="text-left">Ngày hẹn</th>
                <th className="text-left">Khách hàng</th>
                <th className="text-left">Trạng thái</th>
                <th className="text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {appts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có lịch hẹn khách hàng nào.</td></tr>
              ) : appts.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="text-slate-600">{a.appointment_date}</td>
                  <td className="font-semibold text-slate-900">{a.customer_name}</td>
                  <td className="align-middle">
                    <span className={`e-badge e-badge-sm ${STATUS_COLOR[a.status] || 'e-tone-neutral'}`}>
                      {STATUS_LABEL[a.status] || a.status}
                    </span>
                  </td>
                  <td className="text-slate-400">{a.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doanh thu được gán */}
      <div className="e-card overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-[16px] font-[650] text-slate-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-teal-600" /> Doanh thu được gán</h3>
        </div>
        {/* Điện thoại: danh sách thẻ */}
        <div className="lg:hidden divide-y divide-slate-100">
          {ptList.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-slate-400">Chưa có doanh thu được gán.</div>
          ) : ptList.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 grid place-items-center text-[13px] font-semibold shrink-0 tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold text-slate-900 truncate">{a.customer_name}</div>
                <div className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums">{a.surgery_date || a.appointment_date}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14.5px] font-bold text-teal-700 tabular-nums">{fmtM(a.revenue)}</div>
                <div className="text-[12px] text-peach-600 mt-0.5 tabular-nums">Upsale {fmtM(a.upsale_revenue)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block overflow-x-auto">
          <table className="e-table">
            <thead>
              <tr>
                <th className="text-left">STT</th>
                <th className="text-left">Ngày</th>
                <th className="text-left">Khách hàng</th>
                <th className="text-right">Doanh thu</th>
                <th className="text-right">Upsale</th>
              </tr>
            </thead>
            <tbody>
              {ptList.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Chưa có doanh thu được gán.</td></tr>
              ) : ptList.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="text-slate-600">{a.surgery_date || a.appointment_date}</td>
                  <td className="font-semibold text-slate-900">{a.customer_name}</td>
                  <td className="text-right font-semibold text-teal-700">{fmtM(a.revenue)}</td>
                  <td className="text-right text-peach-600">{fmtM(a.upsale_revenue)}</td>
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
