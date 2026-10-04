import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Construction } from 'lucide-react';
import SaleOfflineAdmin from '@/components/kpi/SaleOfflineAdmin.jsx';
import TrucPageAdmin from '@/components/kpi/TrucPageAdmin.jsx';
import TelesaleAdmin from '@/components/kpi/TelesaleAdmin.jsx';
import DieuDuongAdmin from '@/components/kpi/DieuDuongAdmin.jsx';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const DEPARTMENTS = [
  { id: 'overview',     label: 'Tổng quan' },
  { id: 'truc_page',    label: 'Trực page' },
  { id: 'telesale',     label: 'Telesale' },
  { id: 'sale_offline', label: 'Sale Offline' },
  { id: 'marketing',    label: 'Marketing' },
  { id: 'cskh',         label: 'CSKH' },
  { id: 'media',        label: 'Media' },
  { id: 'dieu_duong',   label: 'Điều dưỡng' },
];

const ComingSoon = ({ label }) => (
  <div className="e-card e-empty py-16">
    <div className="e-empty-icon">
      <Construction />
    </div>
    <div className="e-empty-title">KPI {label}</div>
    <div className="e-empty-desc">Đang được xây dựng</div>
  </div>
);

const KPIManagementPage = () => {
  const today = new Date();
  const [dept, setDept] = useState('sale_offline');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="space-y-4">
      {/* Thanh lọc: kỳ KPI */}
      <div className="e-toolbar justify-between pl-4">
        <p className="e-page-desc">Giao chỉ tiêu & theo dõi KPI theo bộ phận · {MONTHS[month - 1]} {year}</p>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-slate-200 bg-white">
          <button onClick={prevMonth} className="w-8 h-8 rounded-lg grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng trước">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13.5px] font-semibold text-slate-800 min-w-[110px] text-center tabular-nums">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-lg grid place-items-center text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Tháng sau">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Department tabs (gạch chân teal) */}
      <div className="e-tabs">
        {DEPARTMENTS.map(d => (
          <button key={d.id} onClick={() => setDept(d.id)}
            className={`e-tab ${dept === d.id ? 'e-tab-active' : 'text-slate-500'}`}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {dept === 'sale_offline' ? <SaleOfflineAdmin month={month} year={year} />
        : dept === 'truc_page' ? <TrucPageAdmin month={month} year={year} />
        : dept === 'telesale' ? <TelesaleAdmin month={month} year={year} />
        : dept === 'dieu_duong' ? <DieuDuongAdmin month={month} year={year} />
        : <ComingSoon label={DEPARTMENTS.find(d => d.id === dept)?.label} />}
    </div>
  );
};

export default KPIManagementPage;
