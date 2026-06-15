
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { hasPermission } from '@/utils/permissionHelper.js';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

const ProtectedModuleRoute = ({ module, action = 'view', children }) => {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  if (!isLoggedIn || !user) {
    return <Navigate to="/" replace />;
  }

  const isAllowed = hasPermission(user, module, action);

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 w-full">
        <div className="bg-white border border-rose-100 rounded-2xl shadow-sm p-8 max-w-md text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Truy cập bị từ chối</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Bạn không có quyền truy cập chức năng "{module}". Vui lòng liên hệ Quản trị viên nếu bạn cần được cấp quyền.
          </p>
          <Button onClick={() => navigate(-1)} variant="outline" className="w-full h-12 rounded-xl text-base font-medium border-gray-200 hover:bg-gray-50">
            Quay lại trang trước
          </Button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedModuleRoute;
