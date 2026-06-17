import React from 'react';
import { TrendingUp } from 'lucide-react';

const FinanceAdsSummary = ({ stats, month, onViewDetail }) => {
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  const costPerLead = stats.adsCustomers > 0 ? Math.round(stats.adsSpent / stats.adsCustomers) : 0;
  const ratio = stats.adsRevenue > 0 ? ((stats.adsSpent / stats.adsRevenue) * 100).toFixed(0) : 0;

  return (
    <div className="bg-slate-900 rounded-2xl p-5 md:p-6 shadow-lg text-white border border-slate-800 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
      <div className="relative z-10 w-full md:w-auto flex-1">
        <h3 className="font-bold text-lg text-blue-400 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Tóm tắt Hiệu quả Ads Tháng {month}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          <div>
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Chi phí Ads</div>
            <div className="text-xl font-bold">{fmt(stats.adsSpent)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Doanh thu Ads</div>
            <div className="text-xl font-bold text-emerald-400">{fmt(stats.adsRevenue)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Chi phí / Lead</div>
            <div className="text-xl font-bold">{fmt(costPerLead)}</div>
          < /div>
          <div>
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Tỷ lệ Chi phí / Doanh thu</div>
            <div className={`text-xl font-bold ${ratio >= 100 ? 'text-red-400' : 'text-emerald-400'}`}> {ratio}% </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 w-full md:w-auto shrink-0 flex justify-end">
        <button
          onClick={onViewDetail}
          className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-md flex justify-center items-center gap-2"
        >
          Xem chi tiết <TrendingUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FinanceAdsSummary;
