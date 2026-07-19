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
      {/* Header — MOBILE (xanh tối) */}
      <div className="lg:hidden relative overflow-hidden rounded-3xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(160deg,#0b3b34 0%,#0f5148 55%,#136b5e 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 grid place-items-center text-[10px] font-bold">DT</span>
            <div className="leading-tight"><div className="text-xs font-bold">DR TUẤN HƯNG</div><div className="text-[8px] tracking-[0.2em] text-white/60">INTERNAL SYSTEM</div></div>
          </div>
          <h2 className="text-2xl font-bold">Quản lý Đặt cọc</h2>
          <p className="text-white/70 text-sm mt-0.5 mb-4">Theo dõi và quản lý thông tin đặt cọc khách hàng</p>
          <Tabs dark />
        </div>
      </div>

      {/* Header — DESKTOP */}
      <div className="hidden lg:block">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý Đặt cọc (Mini-CRM)</h2>
        <p className="text-slate-400 text-sm mt-0.5 mb-4">Theo dõi khách hàng chờ phẫu thuật và xử lý khách rớt</p>
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
