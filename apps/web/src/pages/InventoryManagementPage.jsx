import React from 'react';
import { PackageOpen } from 'lucide-react';

export default function InventoryManagementPage({ isNested = false }) {
  return (
    <div className="space-y-6">
      {!isNested && (
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Kế toán Kho / Vật tư</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý nhập xuất tồn vật tư y tế</p>
        </div>
      )}
      
      <div className="flex flex-col items-center justify-center h-64 space-y-3 bg-white rounded-3xl shadow-sm border border-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-500">
          <PackageOpen className="w-8 h-8" />
        </div>
        <div className="text-base font-semibold text-slate-700">Tính năng Kế toán Kho đang được phát triển</div>
        <div className="text-sm text-slate-400">Vui lòng quay lại sau!</div>
      </div>
    </div>
  );
}
