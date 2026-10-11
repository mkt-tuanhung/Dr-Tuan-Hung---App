import React, { useState, useEffect } from 'react';
import StaffManagementPage from './StaffManagementPage.jsx';
import AttendanceManagementPage from './AttendanceManagementPage.jsx';
import { Users, CalendarCheck, FileText } from 'lucide-react';
import { usePageTitle } from '@/components/ds';

export default function HRManagementPage({ initialTab = 'staff' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // staff, attendance, leave
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  usePageTitle('HRM - Quản lý nhân sự');

  return (
    <div className="space-y-4">
      {/* Tab khu vực (riêng Tuấn Hùng — gạch chân teal kiểu Ethics) */}
      <div className="e-tabs">
        <button
          onClick={() => setActiveTab('staff')}
          className={`e-tab ${activeTab === 'staff' ? 'e-tab-active' : ''}`}
        >
          <Users /> Danh sách nhân sự
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`e-tab ${activeTab === 'attendance' ? 'e-tab-active' : ''}`}
        >
          <CalendarCheck /> Bảng chấm công
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`e-tab ${activeTab === 'leave' ? 'e-tab-active' : ''}`}
        >
          <FileText /> Duyệt đơn
        </button>
      </div>

      {/* Nội dung */}
      <div className="min-h-[60vh]">
        {activeTab === 'staff' && <StaffManagementPage isNested={true} />}
        {activeTab === 'attendance' && <AttendanceManagementPage isNested={true} defaultTab="attendance" />}
        {activeTab === 'leave' && <AttendanceManagementPage isNested={true} defaultTab="leave" />}
      </div>
    </div>
  );
}
