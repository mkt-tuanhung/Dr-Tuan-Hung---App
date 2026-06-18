import React, { useState } from 'react';
import KhachCocPage from './KhachCocPage.jsx';
import KhachBongPage from './KhachBongPage.jsx';
import { ClipboardList, UserX } from 'lucide-react';

export default function DepositManagementPage() {
  const [activeTab, setActiveTab] = useState('khach_coc'); // 'khach_coc', 'khach_bong'

  return (
    <div className="space-y-6">
      {/* Header Wrapper */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Quản lý Đặt cọc (Mini-CRM)</h2>
        <p className="text-slate-400 text-sm mt-0.5">Theo dõi khách hàng chờ phẫu thuật và xử lý khách rớt</p>
      </div>

      {/* Main Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex bg-slate-50 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('khach_coc')}
            className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'khach_coc' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Khách đang giữ cọc
          </button>
          <button
            onClick={() => setActiveTab('khach_bong')}
            className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'khach_bong' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <UserX className="w-4 h-4" /> Khách Bong / Hủy
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 bg-slate-50/50 min-h-[60vh]">
          {activeTab === 'khach_coc' && <KhachCocPage isNested={true} />}
          {activeTab === 'khach_bong' && <KhachBongPage isNested={true} />}
        </div>
      </div>
    </div>
  );
}
