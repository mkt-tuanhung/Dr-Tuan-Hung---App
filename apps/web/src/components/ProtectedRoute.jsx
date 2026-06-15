
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isLoggedIn, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && user) {
    if (!allowedRoles.includes(user.role)) {
      // Redirect to appropriate dashboard if role doesn't match
      switch (user.role) {
        case 'Admin': return <Navigate to="/admin-dashboard" replace />;
        case 'Nhân viên': return <Navigate to="/staff-dashboard" replace />;
        case 'Kế toán': return <Navigate to="/accountant-dashboard" replace />;
        case 'Cổ đông': return <Navigate to="/shareholder-dashboard" replace />;
        default: return <Navigate to="/" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
