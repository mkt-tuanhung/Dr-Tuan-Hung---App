import React, { useState, useEffect } from 'react';
import StaffManagementPage from './StaffManagementPage.jsx';
import AttendanceManagementPage from './AttendanceManagementPage.jsx';
import { Users, CalendarCheck, FileText } from 'lucide-react';

export default function HRManagementPage({ initialTab = 'staff' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // staff, attendance, leave
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  return (
    <div className="space-y-6">
      {/* Header Wrapper */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Quản lý Nhân sự</h2>
        <p className="text-slate-400 text-sm mt-0.5">Danh sách, chấm công và duyệt đơn từ</p>
      </div>

      {/* Main Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex bg-slate-50 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'staff' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" /> Danh sách nhân sự
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'attendance' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <CalendarCheck className="w-4 h-4" /> Bảng chấm công
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`px-6 py-4 font-bold text-sm transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'leave' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" /> Duyệt đơn
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 bg-slate-50/50 min-h-[60vh]">
          {activeTab === 'staff' && <StaffManagementPage isNested={true} />}
          {activeTab === 'attendance' && <AttendanceManagementPage isNested={true} defaultTab="attendance" />}
          {activeTab === 'leave' && <AttendanceManagementPage isNested={true} defaultTab="leave" />}
        </div>
      </div>
    </div>
  );
}
