import React, { useState } from 'react';
import VienPhiPage from './VienPhiPage.jsx';
import InventoryManagementPage from './InventoryManagementPage.jsx';
import { Activity, PackageOpen } from 'lucide-react';

export default function HospitalFeeAndInventoryPage() {
  const [activeTab, setActiveTab] = useState('vien_phi'); // 'vien_phi', 'inventory'

  return (
    <div className="space-y-6">
      {/* Header Wrapper */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Quản lý Viện phí / Vật tư</h2>
        <p className="text-slate-400 text-sm mt-0.5">Quản lý thu viện phí và xuất nhập tồn vật tư y tế</p>
      </div>

      {/* Main Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex bg-slate-50 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('vien_phi')}
            className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'vien_phi' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" /> Viện phí
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <PackageOpen className="w-4 h-4" /> Vật tư
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 bg-slate-50/50 min-h-[60vh]">
          {activeTab === 'vien_phi' && <VienPhiPage isNested={true} />}
          {activeTab === 'inventory' && <InventoryManagementPage isNested={true} />}
        </div>
      </div>
    </div>
  );
}
