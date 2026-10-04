import React, { useState } from 'react';
import VienPhiPage from './VienPhiPage.jsx';
import InventoryManagementPage from './InventoryManagementPage.jsx';
import NhapVatTuMoiPage from './NhapVatTuMoiPage.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Activity, PackageOpen, PackagePlus } from 'lucide-react';

export default function HospitalFeeAndInventoryPage() {
  const { profile } = useAuth();
  // Điều dưỡng chỉ dùng phần Vật tư (không xem Viện phí)
  const showVienPhi = profile?.role !== 'dieu_duong';
  const [activeTab, setActiveTab] = useState(showVienPhi ? 'vien_phi' : 'inventory');

  return (
    <div className="space-y-4">
      <p className="e-page-desc">Quản lý thu viện phí và xuất nhập tồn vật tư y tế</p>

      {/* Tab phân hệ (gạch chân teal kiểu Ethics) */}
      <div className="space-y-4">
        <div className="e-tabs">
          {showVienPhi && (
          <button
            onClick={() => setActiveTab('vien_phi')}
            className={`e-tab shrink-0 ${
              activeTab === 'vien_phi' ? 'e-tab-active' : 'text-slate-500'
            }`}
          >
            <Activity className="w-4 h-4" /> Viện phí
          </button>
          )}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`e-tab shrink-0 ${
              activeTab === 'inventory' ? 'e-tab-active' : 'text-slate-500'
            }`}
          >
            <PackageOpen className="w-4 h-4" /> Vật tư
          </button>
          <button
            onClick={() => setActiveTab('nhap_moi')}
            className={`e-tab shrink-0 ${
              activeTab === 'nhap_moi' ? 'e-tab-active' : 'text-slate-500'
            }`}
          >
            <PackagePlus className="w-4 h-4" /> Vật tư nhập mới
          </button>
        </div>

        {/* Content Area */}
        <div className="min-h-[60vh]">
          {activeTab === 'vien_phi' && showVienPhi && <VienPhiPage isNested={true} />}
          {activeTab === 'inventory' && <InventoryManagementPage isNested={true} />}
          {activeTab === 'nhap_moi' && <NhapVatTuMoiPage />}
        </div>
      </div>
    </div>
  );
}
