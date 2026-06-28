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
  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm py-16 flex flex-col items-center text-center">
    <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
      <Construction className="w-7 h-7 text-teal-500" />
    </div>
    <div className="font-semibold text-slate-700">KPI {label}</div>
    <div className="text-sm text-slate-400 mt-1">Đang được xây dựng</div>
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
    <div className="space-y-5">
      {/* Header + month nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">KPI & Hoa hồng</h2>
          <p className="text-slate-400 text-sm mt-0.5">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Department tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DEPARTMENTS.map(d => (
          <button key={d.id} onClick={() => setDept(d.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              dept === d.id ? 'bg-gradient-to-r from-teal-500 to-teal-500 text-white shadow-md shadow-teal-200' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700'
            }`}>
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
