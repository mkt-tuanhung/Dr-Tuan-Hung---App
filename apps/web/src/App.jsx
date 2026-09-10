import React from 'react';
import { Route, Routes, useParams, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';

import LoginPage from '@/pages/LoginPage.jsx';
import AdminDashboard from '@/pages/AdminDashboard.jsx';
import StaffDashboard from '@/pages/StaffDashboard.jsx';
import PayslipViewPage from '@/pages/PayslipViewPage.jsx';
import ServiceReviewPublicPage from '@/pages/ServiceReviewPublicPage.jsx';
import DailyReportPublicPage from '@/pages/DailyReportPublicPage.jsx';
import MatchPredictPage from '@/pages/MatchPredictPage.jsx';
import WerewolfGame from '@/features/werewolf/WerewolfGame.jsx';
import WerewolfGuest from '@/features/werewolf/WerewolfGuest.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

// Vào phòng Ma Sói qua QR/link: /ma-soi/:code
// Đăng nhập -> bản nhân sự; KHÁCH vãng lai (chưa đăng nhập) -> nhập tên & chơi.
const WerewolfEntry = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" /></div>;
  }
  if (isLoggedIn) return <WerewolfGame standalone joinCode={code} onBack={() => navigate('/staff-dashboard')} />;
  return <WerewolfGuest code={code} />;
};

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
          <Route path="/du-doan/:id" element={<ProtectedRoute><MatchPredictPage standalone /></ProtectedRoute>} />
          <Route path="/ma-soi/:code" element={<WerewolfEntry />} />

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
