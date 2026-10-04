import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ChevronLeft, ChevronRight, TrendingUp, Users, Phone, Award } from 'lucide-react';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const fmtM = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) + 'đ' : '—';
const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) : '0';
const pct = (actual, target) => target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;

const ProgressRing = ({ value, size = 80 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 100 ? '#067B7F' : value >= 70 ? '#3CA7A9' : '#F4B183';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EAF4F4" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  );
};

const ProgressBar = ({ value }) => (
  <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
    <div className={`h-2 rounded-full transition-all ${value >= 100 ? 'bg-success-500' : value >= 70 ? 'bg-teal-500' : 'bg-warning-500'}`}
      style={{ width: `${Math.min(value, 100)}%` }} />
  </div>
);

const KPIPage = () => {
  const { profile } = useAuth();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [kpi, setKpi] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [curRes, histRes] = await Promise.all([
      supabase.from('kpi_targets').select('*').eq('staff_id', profile.id).eq('month', month).eq('year', year).single(),
      supabase.from('kpi_targets').select('*').eq('staff_id', profile.id).order('year', { ascending: false }).order('month', { ascending: false }).limit(6),
    ]);
    setKpi(curRes.data || null);
    setHistory(histRes.data || []);
    setLoading(false);
  }, [profile?.id, month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  const revPct = kpi ? pct(kpi.actual_revenue, kpi.target_revenue) : 0;
  const custPct = kpi ? pct(kpi.actual_customers, kpi.target_customers) : 0;
  const callPct = kpi ? pct(kpi.actual_calls, kpi.target_calls) : 0;
  const overallPct = kpi ? Math.round((revPct + custPct + callPct) / 3) : 0;

  return (
    <div className="space-y-4">
      <div className="e-toolbar justify-between pl-2.5 lg:pl-4">
        <p className="e-page-desc hidden lg:block">KPI cá nhân · {MONTHS[month-1]} {year}</p>
        <div className="flex lg:inline-flex items-center justify-between gap-1 w-full lg:w-auto p-0 lg:p-1 rounded-xl border-0 lg:border border-slate-200 bg-white">
          <button onClick={prevMonth} className="w-11 h-11 lg:w-8 lg:h-8 rounded-xl lg:rounded-lg border border-slate-200 lg:border-0 grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng trước">
            <ChevronLeft className="w-5 h-5 lg:w-4 lg:h-4" />
          </button>
          <span className="text-[15px] lg:text-[13.5px] font-semibold text-slate-800 min-w-[110px] text-center tabular-nums">{MONTHS[month-1]} {year}</span>
          <button onClick={nextMonth} className="w-11 h-11 lg:w-8 lg:h-8 rounded-xl lg:rounded-lg border border-slate-200 lg:border-0 grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng sau">
            <ChevronRight className="w-5 h-5 lg:w-4 lg:h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] border-teal-100 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : !kpi ? (
        <div className="e-card e-empty">
          <div className="e-empty-icon text-[22px]">📊</div>
          <div className="e-empty-title">Chưa có KPI tháng này</div>
          <div className="e-empty-desc">Admin sẽ cập nhật KPI cho bạn</div>
        </div>
      ) : (
        <>
          {/* Overall progress (vòng KPI kiểu Ethics M15) */}
          <div className="e-card e-card-pad">
            <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
              {/* Điện thoại: vòng KPI to (kiểu Ethics M15) */}
              <div className="lg:hidden relative w-[200px] h-[200px] rounded-full shrink-0"
                style={{ background: `conic-gradient(#3CA7A9 0%, #067B7F ${Math.min(overallPct, 100)}%, #EAF4F4 ${Math.min(overallPct, 100)}% 100%)` }}>
                <div className="absolute inset-[22px] rounded-full bg-white grid place-items-center text-center">
                  <div>
                    <div className="text-[44px] font-bold text-slate-900 leading-none tabular-nums">{overallPct}%</div>
                    <div className="text-[13px] text-slate-500 mt-1.5">Đạt được</div>
                  </div>
                </div>
              </div>
              <div className="relative shrink-0 hidden lg:block">
                <ProgressRing value={overallPct} size={132} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[28px] font-bold text-slate-900 leading-none tabular-nums">{overallPct}%</div>
                    <div className="text-[11.5px] text-slate-500 mt-1">Đạt được</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="e-caption">Hoàn thành KPI tổng</div>
                <div className="text-[20px] lg:text-[22px] font-bold text-slate-900 mt-1.5">{MONTHS[month-1]} {year}</div>
                <div className={`mt-2 e-badge ${overallPct >= 100 ? 'e-tone-success' : overallPct >= 70 ? 'e-tone-brand' : 'e-tone-warning'}`}>
                  <Award />
                  {overallPct >= 100 ? 'Xuất sắc — Đạt KPI' : overallPct >= 70 ? 'Đang tiến đến mục tiêu' : 'Cần cố gắng thêm'}
                </div>
                {kpi.commission_amount > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-[12.5px] text-slate-500">Hoa hồng tháng này ({kpi.commission_rate}%)</div>
                    <div className="text-[24px] font-bold text-teal-700 mt-0.5 tabular-nums">{fmtM(kpi.commission_amount)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detail metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: TrendingUp, label: 'Doanh thu', actual: fmtM(kpi.actual_revenue), target: fmtM(kpi.target_revenue), pct: revPct, color: 'text-teal-700', bg: 'bg-teal-50' },
              { icon: Users, label: 'Khách hàng', actual: fmt(kpi.actual_customers), target: fmt(kpi.target_customers), pct: custPct, color: 'text-teal-700', bg: 'bg-teal-50' },
              { icon: Phone, label: 'Cuộc gọi', actual: fmt(kpi.actual_calls), target: fmt(kpi.target_calls), pct: callPct, color: 'text-teal-700', bg: 'bg-teal-50' },
            ].map(m => (
              <div key={m.label} className="e-card e-card-pad">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full ${m.bg} grid place-items-center shrink-0`}>
                      <m.icon className={`w-5 h-5 ${m.color}`} />
                    </div>
                    <span className="text-[14px] font-semibold text-slate-700">{m.label}</span>
                  </div>
                  <span className={`e-badge e-badge-sm ${m.pct >= 100 ? 'e-tone-success' : m.pct >= 70 ? 'e-tone-brand' : 'e-tone-warning'}`}>
                    {m.pct}%
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-[22px] font-bold text-slate-900 tabular-nums">{m.actual}</div>
                  <div className="text-[12.5px] text-slate-500">Mục tiêu: {m.target}</div>
                </div>
                <ProgressBar value={m.pct} />
              </div>
            ))}
          </div>

          {kpi.note && (
            <div className="e-card-flat p-4 border-l-4 border-l-teal-500">
              <div className="e-caption mb-1.5">Ghi chú từ quản lý</div>
              <div className="text-[14px] text-slate-700">{kpi.note}</div>
            </div>
          )}
        </>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="e-card overflow-hidden">
          <div className="px-4 lg:px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-[16px] font-[650] text-slate-900">Lịch sử KPI</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {history.map(h => {
              const p = pct(h.actual_revenue, h.target_revenue);
              return (
                <div key={h.id} className="flex items-center justify-between gap-3 px-4 lg:px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-slate-800">{MONTHS[h.month-1]} {h.year}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5 tabular-nums">{fmtM(h.actual_revenue)} / {fmtM(h.target_revenue)}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {h.commission_amount > 0 && (
                      <div className="text-[12.5px] font-semibold text-teal-700 tabular-nums">{fmtM(h.commission_amount)}</div>
                    )}
                    <div className={`e-badge e-badge-sm tabular-nums ${p >= 100 ? 'e-tone-success' : p >= 70 ? 'e-tone-brand' : 'e-tone-warning'}`}>
                      {p}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIPage;
