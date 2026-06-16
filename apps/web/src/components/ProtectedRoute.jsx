import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

const ROLE_DASHBOARD = {
  admin: '/admin-dashboard',
  accountant: '/accountant-dashboard',
  shareholder: '/shareholder-dashboard',
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isLoggedIn, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && profile) {
    if (!allowedRoles.includes(profile.role)) {
      const redirect = ROLE_DASHBOARD[profile.role] || '/staff-dashboard';
      return <Navigate to={redirect} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
