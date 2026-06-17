import React from 'react';
import { Banknote, TrendingUp } from 'lucide-react';

const FinanceHospitalFeeSummary = ({ stats, month, onViewDetail }) => {
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  const cashRatio = stats.hospitalFee > 0 ? ((stats.hospitalFeeCash / stats.hospitalFee) * 100).toFixed(0) : 0;
  const transferRatio = stats.hospitalFee > 0 ? ((stats.hospitalFeeTransfer / stats.hospitalFee) * 100).toFixed(0) : 0;

  return (
    <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl p-5 md:p-6 shadow-lg text-white border border-emerald-800 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
      <div className="relative z-10 flex-1">
        <h3 className="font-bold text-lg text-emerald-300 mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5" /> Tóm tắt Viện Phí Tháng {month}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          <div>
            <div className="text-emerald-200/70 text-xs uppercase font-bold tracking-wider mb-1">Tổng số lượt thu</div>
            <div className="text-xl font-bold text-emerald-50">{stats.hospitalFeeCount} <span className="text-sm font-medium text-emerald-200/70">lượt</span></div>
          </div>
          <div>
            <div className="text-emerald-200/70 text-xs uppercase font-bold tracking-wider mb-1">Tiền mặt</div>
            <div className="text-xl font-bold text-emerald-400">{fmt(stats.hospitalFeeCash)} <span className="text-sm font-medium ml-1">({cashRatio}%)</span></div>
          </div>
          <div>
            <div className="text-emerald-200/70 text-xs uppercase font-bold tracking-wider mb-1">Chuyển khoản</div>
            <div className="text-xl font-bold text-teal-300">{fmt(stats.hospitalFeeTransfer)} <span className="text-sm font-medium ml-1">({transferRatio}%)</span></div>
          </div>
          <div>
            <div className="text-emerald-200/70 text-xs uppercase font-bold tracking-wider mb-1">Tổng Viện phí</div>
            <div className="text-2xl font-black text-white">{fmt(stats.hospitalFee)}</div>
          </div>
        </div>
      </div>
      <button
        onClick={onViewDetail}
        className="relative z-10 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-md flex items-center gap-2 border border-emerald-500"
      >
        Xem chi tiết <TrendingUp className="w-4 h-4" />
      </button>
    </div>
  );
};

export default FinanceHospitalFeeSummary;
