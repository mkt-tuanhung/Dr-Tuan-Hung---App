import React, { useState } from 'react';
import { Wallet, UserX } from 'lucide-react';
import KhachCocPage from './KhachCocPage.jsx';
import KhachBongPage from './KhachBongPage.jsx';

export default function DepositManagementPage() {
  const [activeTab, setActiveTab] = useState('khach_coc'); // 'khach_coc', 'khach_bong'

  const Tabs = ({ dark }) => (
    <div className={`e-tabs ${dark ? 'border-white/15' : 'border-slate-200'}`}>
      <button onClick={() => setActiveTab('khach_coc')}
        className={`e-tab ${activeTab === 'khach_coc' ? 'e-tab-active' : ''}`}>
        <Wallet /> Giữ cọc
      </button>
      <button onClick={() => setActiveTab('khach_bong')}
        className={`e-tab ${activeTab === 'khach_bong' ? 'e-tab-active' : ''}`}>
        <UserX /> Bong / Hủy
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Đầu màn: mô tả + tab gạch chân (Ethics) */}
      <div className="space-y-2">
        <p className="e-page-desc lg:hidden">Theo dõi và quản lý thông tin đặt cọc khách hàng</p>
        <p className="e-page-desc hidden lg:block">Theo dõi khách hàng chờ phẫu thuật và xử lý khách rớt</p>
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
