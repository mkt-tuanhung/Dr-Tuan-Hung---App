import React from 'react';
import { Banknote, Wallet, Users, ArrowRight } from 'lucide-react';

const FinanceRevenueSummary = ({ stats, month, onViewDetail }) => {
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  return (
    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 md:p-6 shadow-lg text-white border border-blue-800 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/4"></div>
      <div className="relative z-10 flex-1 w-full">
        <h3 className="font-bold text-lg text-blue-300 mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Tóm tắt Doanh thu Tháng {month}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          <div>
            <div className="text-blue-200/70 text-xs uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Doanh thu Phẫu Thuật Tổng</div>
            <div className="text-xl font-black text-white">{fmt(stats.totalRev)}</div>
          </div>
          <div>
            <div className="text-blue-200/70 text-xs uppercase font-bold tracking-wider mb-1">Doanh thu Upsale</div>
            <div className="text-xl font-bold text-purple-300">{fmt(stats.totalUpsale)}</div>
          </div>
          <div>
            <div className="text-blue-200/70 text-xs uppercase font-bold tracking-wider mb-1">Doanh thu Cọc</div>
            <div className="text-xl font-bold text-amber-300">{fmt(stats.totalCocRev || 0)}</div>
          </div>
          <div>
            <div className="text-blue-200/70 text-xs uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Khách PT / Khách Cọc</div>
            <div className="text-xl font-bold text-teal-300">{stats.totalCustomers} <span className="text-sm font-medium text-blue-200/70">/ {stats.totalCocCustomers || 0} Khách</span></div>
          </div>
        </div>
      </div>
      <button
        onClick={onViewDetail}
        className="relative z-10 w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 border border-blue-500 shrink-0"
      >
        Xem chi tiết <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default FinanceRevenueSummary;
