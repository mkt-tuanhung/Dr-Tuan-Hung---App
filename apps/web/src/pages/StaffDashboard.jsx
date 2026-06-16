import React from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, CalendarCheck, Target, Wallet, Clock,
  ChevronRight, Bell, User
} from 'lucide-react';

const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH',
  truc_page: 'Trực Page', media: 'Media', marketing: 'Marketing',
  dieu_duong: 'Điều dưỡng', accountant: 'Kế toán', shareholder: 'Cổ đông', admin: 'Admin',
};

const MODULES = [
  { label: 'Chấm công', sub: 'Điểm danh & lịch sử', icon: CalendarCheck, soon: true },
  { label: 'KPI của tôi', sub: 'Tiến độ tháng này', icon: Target, soon: true },
  { label: 'Bảng lương', sub: 'Xem chi tiết lương', icon: Wallet, soon: true },
  { label: 'Lịch làm việc', sub: 'Ca & lịch ca', icon: Clock, soon: true },
];

const StaffDashboard = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col">

      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">DTH</span>
          </div>
          <span className="text-sm font-semibold text-gray-800">Dr Tuấn Hùng</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">

        {/* Profile section */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">{greeting()}</p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">{profile?.full_name}</h1>
            <p className="text-sm text-emerald-600 font-medium mt-0.5">
              {ROLE_LABELS[profile?.role] || profile?.role}
              {profile?.position ? ` · ${profile.position}` : ''}
            </p>
          </div>
        </div>

        {/* Status card */}
        <div className="bg-emerald-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-200 text-xs font-medium uppercase tracking-wider">Trạng thái hợp đồng</p>
              <p className="text-lg font-bold mt-1">
                {profile?.employment_status === 'probation' ? 'Thử việc · 85%' : 'Nhân viên chính thức'}
              </p>
              <p className="text-emerald-300 text-xs mt-1">{profile?.employee_id}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-emerald-500 grid grid-cols-2 gap-4">
            <div>
              <p className="text-emerald-300 text-xs">Lương cơ bản</p>
              <p className="text-white font-semibold text-sm mt-0.5">
                {profile?.base_salary
                  ? new Intl.NumberFormat('vi-VN').format(profile.base_salary) + 'đ'
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-emerald-300 text-xs">Phụ cấp</p>
              <p className="text-white font-semibold text-sm mt-0.5">
                {profile?.allowance
                  ? new Intl.NumberFormat('vi-VN').format(profile.allowance) + 'đ'
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tính năng</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {MODULES.map((m, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <m.icon className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{m.label}</span>
                    {m.soon && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                        Sắp ra mắt
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <p className="text-center text-xs text-gray-300 pb-2">
          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

      </main>
    </div>
  );
};

export default StaffDashboard;
