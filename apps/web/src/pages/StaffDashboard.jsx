import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, CalendarCheck, Target, Wallet, Clock, Banknote,
  Menu, X, User, LayoutDashboard, Bell, ChevronRight,
  CalendarDays, ClipboardList, Activity, UserX
} from 'lucide-react';
import AttendancePage from '@/pages/AttendancePage.jsx';
import KPIPage from '@/pages/KPIPage.jsx';
import FinanceManagementPage from '@/pages/FinanceManagementPage.jsx';
import AppointmentManagementPage from '@/pages/AppointmentManagementPage.jsx';
import KhachCocPage from '@/pages/KhachCocPage.jsx';
import KhachBongPage from '@/pages/KhachBongPage.jsx';
import KhachPhauThuatPage from '@/pages/KhachPhauThuatPage.jsx';
import HauPhauPage from '@/pages/HauPhauPage.jsx';

const ROLE_LABELS = {
  telesale: 'Telesale', sale_offline: 'Sale Offline', cskh: 'CSKH',
  truc_page: 'Trực Page', media: 'Media', marketing: 'Marketing',
  dieu_duong: 'Điều dưỡng', accountant: 'Kế toán', shareholder: 'Cổ đông', admin: 'Admin',
};

const FULL_MENU = [
  { id: 'overview',   label: 'Tổng quan',      icon: LayoutDashboard, roles: ['all'] },
  { id: 'attendance', label: 'Chấm công',       icon: CalendarCheck, roles: ['all'] },
  { id: 'kpi',        label: 'KPI của tôi',     icon: Target, roles: ['all'] },
  { id: 'advances',   label: 'Tạm ứng chi',     icon: Banknote, roles: ['all'] },

  // MKT / Finance
  { id: 'finance',    label: 'Doanh thu',       icon: Banknote, roles: ['marketing', 'accountant', 'admin', 'shareholder'] },

  // CRM
  { id: 'appointments', label: 'Lịch hẹn',       icon: CalendarDays, roles: ['telesale', 'sale_offline', 'cskh', 'truc_page'] },
  { id: 'khach_coc',    label: 'Khách Cọc',      icon: ClipboardList, roles: ['telesale', 'sale_offline', 'cskh'] },
  { id: 'khach_bong',   label: 'Khách Bong',     icon: UserX, roles: ['telesale', 'sale_offline', 'cskh'] },

  // Phẫu thuật
  { id: 'khach_phau_thuat', label: 'Khách Phẫu thuật', icon: Activity, roles: ['dieu_duong'] },
  { id: 'hau_phau',      label: 'Hậu phẫu',      icon: ClipboardList, roles: ['dieu_duong'] },
];

const Overview = ({ profile }) => {
  const fmt = (n) => n ? new Intl.NumberFormat('vi-VN').format(n) + 'đ' : '—';

  return (
    <div className="space-y-5">
      {/* Greeting banner */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/20 border-2 border-white/30 flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-7 h-7 text-white" />
            )}
          </div>
          <div>
            <p className="text-emerald-100 text-sm">Xin chào 👋</p>
            <h2 className="text-xl font-bold">{profile?.full_name}</h2>
            <p className="text-emerald-200 text-xs mt-0.5">
              {ROLE_LABELS[profile?.role] || profile?.role}
              {profile?.position ? ` · ${profile.position}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-emerald-400/40 grid grid-cols-2 gap-4">
          <div>
            <p className="text-emerald-200 text-xs">Lương cơ bản</p>
            <p className="text-white font-semibold mt-0.5">{fmt(profile?.base_salary)}</p>
          </div>
          <div>
            <p className="text-emerald-200 text-xs">Trạng thái</p>
            <p className="text-white font-semibold mt-0.5">
              {profile?.employment_status === 'probation' ? 'Thử việc (85%)' : 'Chính thức'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick access */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Tính năng</h3>
        </div>
        {FULL_MENU.filter(m => m.roles.includes('all') || m.roles.includes(profile?.role)).filter(m => m.id !== 'overview').map((m, i) => (
          <button key={i} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <m.icon className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-slate-700">{m.label}</div>
            </div>
            <div className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-slate-300">
        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
};

const ComingSoon = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-64 space-y-3">
    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">🚧</div>
    <div className="text-base font-semibold text-slate-700">{label}</div>
    <div className="text-sm text-slate-400">Đang được xây dựng</div>
  </div>
);

const StaffDashboard = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const allowedMenu = FULL_MENU.filter(m => m.roles.includes('all') || m.roles.includes(profile?.role));

  const renderContent = () => {
    if (activeTab === 'overview') return <Overview profile={profile} />;
    if (activeTab === 'attendance') return <AttendancePage />;
    if (activeTab === 'kpi') return <KPIPage />;
    if (activeTab === 'finance') return <FinanceManagementPage />;
    if (activeTab === 'appointments') return <AppointmentManagementPage />;
    if (activeTab === 'khach_coc') return <KhachCocPage />;
    if (activeTab === 'khach_bong') return <KhachBongPage />;
    if (activeTab === 'khach_phau_thuat') return <KhachPhauThuatPage />;
    if (activeTab === 'hau_phau') return <HauPhauPage />;
    if (activeTab === 'advances') return <ComingSoon label="Tạm ứng chi" />;
    return <ComingSoon label={allowedMenu.find(m => m.id === activeTab)?.label || activeTab} />;
  };

  const activeMenu = allowedMenu.find(m => m.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-60 z-30 flex flex-col bg-white border-r border-emerald-100
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-emerald-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-emerald-200">
              DTH
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">Dr Tuấn Hùng</div>
              <div className="text-xs text-emerald-500">Internal System</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {allowedMenu.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                    : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-emerald-50">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-emerald-500">{profile?.full_name?.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-700 truncate">{profile?.full_name}</div>
              <div className="text-xs text-slate-400">{ROLE_LABELS[profile?.role] || profile?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar desktop */}
        <header className="hidden lg:flex items-center gap-3 bg-white border-b border-emerald-100 px-6 py-3 sticky top-0 z-10">
          {activeMenu && <activeMenu.icon className="w-4 h-4 text-emerald-600" />}
          <span className="font-semibold text-slate-700 text-sm">{activeMenu?.label}</span>
        </header>

        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between bg-white border-b border-emerald-100 px-4 py-3 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 p-1">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {activeMenu && <activeMenu.icon className="w-4 h-4 text-emerald-600" />}
            <span className="font-semibold text-slate-700 text-sm">{activeMenu?.label}</span>
          </div>
          <div className="w-7 h-7 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-emerald-500">{profile?.full_name?.charAt(0)}</span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {renderContent()}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-emerald-100 shadow-lg">
        <div className="flex items-stretch">
          {allowedMenu.slice(0, 4).map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-all relative"
              >
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-emerald-500" />}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-emerald-500 shadow-md shadow-emerald-200' : ''}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <span className={`text-[10px] font-medium leading-none ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center">
              <Menu className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-[10px] font-medium leading-none text-slate-400">Thêm</span>
          </button>
        </div>
      </nav>

    </div>
  );
};

export default StaffDashboard;
