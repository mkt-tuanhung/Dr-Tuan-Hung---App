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
  const color = value >= 100 ? '#10b981' : value >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  );
};

const ProgressBar = ({ value }) => (
  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
    <div className={`h-1.5 rounded-full transition-all ${value >= 100 ? 'bg-emerald-500' : value >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">KPI của tôi</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month-1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month-1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : !kpi ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-sm">
          <div className="text-3xl mb-3">📊</div>
          <div className="text-sm font-medium text-slate-600">Chưa có KPI tháng này</div>
          <div className="text-xs text-slate-400 mt-1">Admin sẽ cập nhật KPI cho bạn</div>
        </div>
      ) : (
        <>
          {/* Overall progress */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <ProgressRing value={overallPct} size={88} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center rotate-90" style={{transform:'rotate(90deg)'}}>
                    <div className="text-lg font-bold">{overallPct}%</div>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-emerald-100 text-xs font-medium">Hoàn thành KPI tổng</div>
                <div className="text-2xl font-bold mt-1">{MONTHS[month-1]} {year}</div>
                <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                  ${overallPct >= 100 ? 'bg-white/25 text-white' : overallPct >= 70 ? 'bg-yellow-400/30 text-yellow-100' : 'bg-red-400/30 text-red-100'}`}>
                  <Award className="w-3 h-3" />
                  {overallPct >= 100 ? 'Xuất sắc — Đạt KPI' : overallPct >= 70 ? 'Đang tiến đến mục tiêu' : 'Cần cố gắng thêm'}
                </div>
              </div>
            </div>

            {kpi.commission_amount > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-400/40">
                <div className="text-emerald-200 text-xs">Hoa hồng tháng này ({kpi.commission_rate}%)</div>
                <div className="text-2xl font-bold mt-0.5">{fmtM(kpi.commission_amount)}</div>
              </div>
            )}
          </div>

          {/* Detail metrics */}
          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: TrendingUp, label: 'Doanh thu', actual: fmtM(kpi.actual_revenue), target: fmtM(kpi.target_revenue), pct: revPct, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: Users, label: 'Khách hàng', actual: fmt(kpi.actual_customers), target: fmt(kpi.target_customers), pct: custPct, color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: Phone, label: 'Cuộc gọi', actual: fmt(kpi.actual_calls), target: fmt(kpi.target_calls), pct: callPct, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}>
                      <m.icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{m.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${m.pct >= 100 ? 'text-emerald-600' : m.pct >= 70 ? 'text-yellow-500' : 'text-red-400'}`}>
                    {m.pct}%
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xl font-bold text-slate-800">{m.actual}</div>
                    <div className="text-xs text-slate-400">Mục tiêu: {m.target}</div>
                  </div>
                </div>
                <ProgressBar value={m.pct} />
              </div>
            ))}
          </div>

          {kpi.note && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="text-xs font-semibold text-amber-700 mb-1">Ghi chú từ quản lý</div>
              <div className="text-sm text-amber-800">{kpi.note}</div>
            </div>
          )}
        </>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">Lịch sử KPI</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {history.map(h => {
              const p = pct(h.actual_revenue, h.target_revenue);
              return (
                <div key={h.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{MONTHS[h.month-1]} {h.year}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{fmtM(h.actual_revenue)} / {fmtM(h.target_revenue)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {h.commission_amount > 0 && (
                      <div className="text-xs font-medium text-emerald-600">{fmtM(h.commission_amount)}</div>
                    )}
                    <div className={`text-xs font-bold px-2 py-1 rounded-full
                      ${p >= 100 ? 'bg-emerald-100 text-emerald-700' : p >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
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
