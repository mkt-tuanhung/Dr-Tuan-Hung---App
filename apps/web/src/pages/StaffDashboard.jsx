import React from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Clock, Target, Wallet, CalendarCheck } from 'lucide-react';

const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH',
  truc_page: 'Trực Page', media: 'Media', marketing: 'Marketing',
  dieu_duong: 'Điều dưỡng', accountant: 'Kế toán', shareholder: 'Cổ đông', admin: 'Admin',
};

const StaffDashboard = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const cards = [
    { label: 'Chấm công', sub: 'Xem lịch sử chấm công', icon: CalendarCheck, color: 'from-emerald-400 to-teal-500' },
    { label: 'KPI của tôi', sub: 'Xem tiến độ KPI tháng này', icon: Target, color: 'from-blue-400 to-blue-500' },
    { label: 'Bảng lương', sub: 'Xem bảng lương của tôi', icon: Wallet, color: 'from-violet-400 to-purple-500' },
    { label: 'Lịch làm việc', sub: 'Xem lịch ca làm việc', icon: Clock, color: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)' }}>
      {/* Header */}
      <header className="bg-white border-b border-emerald-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
            DTH
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">Dr Tuấn Hùng</div>
            <div className="text-xs text-emerald-500">Internal System</div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 transition-colors">
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-5 pb-10">
        {/* Profile card */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-lg shadow-emerald-200 mt-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/30 flex items-center justify-center shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <p className="text-emerald-100 text-xs">Xin chào 👋</p>
              <h2 className="text-lg font-bold">{profile?.full_name}</h2>
              <p className="text-emerald-200 text-xs mt-0.5">
                {ROLE_LABELS[profile?.role] || profile?.role} · {profile?.employee_id}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-2xl px-3 py-2">
              <div className="text-xs text-emerald-200">Trạng thái</div>
              <div className="text-sm font-semibold mt-0.5">
                {profile?.employment_status === 'probation' ? '🟡 Thử việc' : '🟢 Chính thức'}
              </div>
            </div>
            <div className="bg-white/15 rounded-2xl px-3 py-2">
              <div className="text-xs text-emerald-200">Vị trí</div>
              <div className="text-sm font-semibold mt-0.5 truncate">{profile?.position || ROLE_LABELS[profile?.role] || '—'}</div>
            </div>
          </div>
        </div>

        {/* Quick access */}
        <div>
          <h3 className="font-semibold text-slate-700 mb-3 px-1">Truy cập nhanh</h3>
          <div className="grid grid-cols-2 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50 space-y-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-md`}>
                  <c.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{c.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coming soon notice */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 text-center shadow-sm">
          <div className="text-2xl mb-2">🚧</div>
          <div className="text-sm font-medium text-slate-600">Các tính năng đang được xây dựng</div>
          <div className="text-xs text-slate-400 mt-1">Sẽ sớm ra mắt trong thời gian tới</div>
        </div>
      </main>
    </div>
  );
};

export default StaffDashboard;
