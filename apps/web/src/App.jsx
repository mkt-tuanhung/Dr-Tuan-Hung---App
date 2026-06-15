
import React, { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import ProtectedModuleRoute from '@/components/ProtectedModuleRoute.jsx';
import { initializeUsers, normalizeKpiTargets } from '@/utils/userStorage.js';
import { startRealtimeSync, stopRealtimeSync } from '@/services/realtimeSyncService.js';
import { syncApprovalNotificationsWithSupabase } from '@/utils/ApprovalNotificationHelper.js';

import MobileBottomNav from '@/components/MobileBottomNav.jsx';
import MobilePageContainer from '@/components/MobilePageContainer.jsx';

import LoginPage from '@/pages/LoginPage.jsx';
import AdminDashboard from '@/pages/AdminDashboard.jsx';
import StaffDashboard from '@/pages/StaffDashboard.jsx';
import AccountantDashboard from '@/pages/AccountantDashboard.jsx';
import ShareholderDashboard from '@/pages/ShareholderDashboard.jsx';
import StaffManagementPage from '@/pages/StaffManagementPage.jsx';

import AttendanceEmployeePage from '@/pages/AttendanceEmployeePage.jsx';
import AttendanceAdminPage from '@/pages/AttendanceAdminPage.jsx';
import AttendanceModule from '@/pages/AttendanceModule.jsx';
import AdminAttendanceModule from '@/pages/AdminAttendanceModule.jsx';

import KPIPersonalPage from '@/pages/KPIPersonalPage.jsx';
import KpiCommissionAdminPage from '@/pages/KpiCommissionAdminPage.jsx';
import AdminRevenueManagementPage from '@/pages/AdminRevenueManagementPage.jsx';
import CustomerAppointmentPage from '@/pages/CustomerAppointmentPage.jsx';
import BongCustomerModule from '@/pages/BongCustomerModule.jsx';
import DepositCustomerModule from '@/pages/DepositCustomerModule.jsx';
import SurgicalCustomerModule from '@/pages/SurgicalCustomerModule.jsx';
import PayrollAdminPage from '@/pages/PayrollAdminPage.jsx';
import PayrollEmployeePage from '@/pages/PayrollEmployeePage.jsx';
import StaffExpenseClaimsPage from '@/pages/StaffExpenseClaimsPage.jsx';
import ApprovalNotificationsPage from '@/pages/ApprovalNotificationsPage.jsx';
import PermissionSettingsPage from '@/pages/PermissionSettingsPage.jsx';

const AuthenticatedAppLayout = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return (
    <>
      <MobilePageContainer>
        {children}
      </MobilePageContainer>
      {isLoggedIn && <MobileBottomNav />}
    </>
  );
};

const RealtimeSyncManager = () => {
  const { isLoggedIn } = useAuth();
  
  useEffect(() => {
    if (isLoggedIn) {
      syncApprovalNotificationsWithSupabase().then(() => {
        startRealtimeSync();
      });
    } else {
      stopRealtimeSync();
    }
    
    return () => {
      stopRealtimeSync();
    };
  }, [isLoggedIn]);
  
  return null;
};

function App() {
  useEffect(() => {
    initializeUsers();
    normalizeKpiTargets();
  }, []);

  return (
    <AuthProvider>
      <RealtimeSyncManager />
      <div className="min-h-screen bg-gradient-to-br from-background via-white to-primary/5 flex flex-col">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Tổng quan">
                    <AdminDashboard />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/staff-management" 
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Nhân sự">
                    <StaffManagementPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/attendance-admin" 
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Chấm công">
                    <AttendanceAdminPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/admin/attendance" 
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Chấm công">
                    <AdminAttendanceModule />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/kpi-admin" 
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="KPI">
                    <KpiCommissionAdminPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/admin/revenue-management" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Nhân viên']}>
                <AuthenticatedAppLayout>
                  <AdminRevenueManagementPage />
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/appointments" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Nhân viên', 'Kế toán', 'Cổ đông']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Lịch hẹn">
                    <CustomerAppointmentPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/bong-customers" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Khách Bong">
                    <BongCustomerModule />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/deposit-customers" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Khách Cọc">
                    <DepositCustomerModule />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/surgical-customers" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Khách phẫu thuật">
                    <SurgicalCustomerModule />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/payroll" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Kế toán', 'Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Bảng lương">
                    <PayrollAdminPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/payroll/employee" 
            element={
              <ProtectedRoute allowedRoles={['Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Bảng lương">
                    <PayrollEmployeePage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/staff-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Tổng quan">
                    <StaffDashboard />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/attendance-employee" 
            element={
              <ProtectedRoute allowedRoles={['Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Chấm công">
                    <AttendanceModule />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/attendance" 
            element={
              <ProtectedRoute allowedRoles={['Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Chấm công">
                    <AttendanceModule />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/kpi-personal" 
            element={
              <ProtectedRoute allowedRoles={['Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="KPI">
                    <KPIPersonalPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/accountant-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['Kế toán']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Tổng quan">
                    <AccountantDashboard />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/shareholder-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['Cổ đông']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Tổng quan">
                    <ShareholderDashboard />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/staff-expense-claims" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Kế toán', 'Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Tạm ứng chi">
                    <StaffExpenseClaimsPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/approval-notifications" 
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Kế toán', 'Nhân viên']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Thông báo">
                    <ApprovalNotificationsPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/permission-settings" 
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuthenticatedAppLayout>
                  <ProtectedModuleRoute module="Cài đặt phân quyền">
                    <PermissionSettingsPage />
                  </ProtectedModuleRoute>
                </AuthenticatedAppLayout>
              </ProtectedRoute>
            } 
          />

          <Route path="*" element={<LoginPage />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </div>
    </AuthProvider>
  );
}

export default App;
