import React, { useState } from 'react';
import KhachCocPage from './KhachCocPage.jsx';
import KhachBongPage from './KhachBongPage.jsx';

export default function DepositManagementPage() {
  const [activeTab, setActiveTab] = useState('khach_coc'); // 'khach_coc', 'khach_bong'

  const Tabs = ({ dark }) => (
    <div className={`flex gap-1.5 rounded-2xl p-1.5 ${dark ? 'bg-white/10 border border-white/15' : 'bg-white border border-slate-200 shadow-sm lg:w-fit'}`}>
      <button onClick={() => setActiveTab('khach_coc')}
        className={`flex-1 lg:flex-none lg:px-8 px-3 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'khach_coc' ? (dark ? 'bg-emerald-500 text-white shadow' : 'bg-teal-600 text-white shadow') : (dark ? 'text-white/70' : 'text-slate-500 hover:bg-slate-50')}`}>
        Giữ cọc
      </button>
      <button onClick={() => setActiveTab('khach_bong')}
        className={`flex-1 lg:flex-none lg:px-8 px-3 py-2 rounded-xl text-sm font-semibold transition ${activeTab === 'khach_bong' ? (dark ? 'bg-emerald-500 text-white shadow' : 'bg-rose-500 text-white shadow') : (dark ? 'text-white/70' : 'text-slate-500 hover:bg-slate-50')}`}>
        Bong / Hủy
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header — MOBILE */}
      <div className="lg:hidden rounded-2xl bg-white shadow-card border border-slate-200/70 p-4">
        <p className="text-[13px] text-slate-500 mb-3">Theo dõi và quản lý thông tin đặt cọc khách hàng</p>
        <Tabs />
      </div>

      {/* Header — DESKTOP */}
      <div className="hidden lg:block">
        <p className="text-[13px] text-slate-500 mb-4">Theo dõi khách hàng chờ phẫu thuật và xử lý khách rớt</p>
        <Tabs />
      </div>

      {/* Nội dung */}
      <div>
        {activeTab === 'khach_coc' && <KhachCocPage isNested={true} />}
        {activeTab === 'khach_bong' && <KhachBongPage isNested={true} />}
      </div>
    </div>
  );
}
