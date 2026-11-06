import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';

import LoginPage from '@/pages/LoginPage.jsx';
import AdminDashboard from '@/pages/AdminDashboard.jsx';
import StaffDashboard from '@/pages/StaffDashboard.jsx';
import PayslipViewPage from '@/pages/PayslipViewPage.jsx';
import ServiceReviewPublicPage from '@/pages/ServiceReviewPublicPage.jsx';
import DailyReportPublicPage from '@/pages/DailyReportPublicPage.jsx';

// Trang xem thử thiết kế: CHỈ có khi build với VITE_DESIGN_PREVIEW=1.
// Bản production: điều kiện là hằng false -> Vite loại bỏ cả route lẫn chunk.
const DesignPreview = import.meta.env.VITE_DESIGN_PREVIEW === '1'
  ? React.lazy(() => import('@/dev/DesignPreview.jsx'))
  : null;

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/quan-tri" element={<LoginPage adminMode />} />
          <Route path="/phieu-luong" element={<PayslipViewPage />} />
          <Route path="/danh-gia/:token" element={<ServiceReviewPublicPage />} />
          <Route path="/bao-cao/:slug" element={<DailyReportPublicPage />} />
          {DesignPreview && (
            <Route path="/__preview" element={<React.Suspense fallback={null}><DesignPreview /></React.Suspense>} />
          )}

          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff-dashboard"
            element={
              <ProtectedRoute>
                <StaffDashboard />
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
