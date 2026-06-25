import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient';
import StaffManagementPage from '@/pages/StaffManagementPage.jsx';
import AttendanceManagementPage from '@/pages/AttendanceManagementPage.jsx';
import KPIManagementPage from '@/pages/KPIManagementPage.jsx';
import PayrollPage from '@/pages/PayrollPage.jsx';
import CommunityPage from '@/pages/CommunityPage.jsx';
import NotificationsPage from '@/pages/NotificationsPage.jsx';
import AppointmentManagementPage from '@/pages/AppointmentManagementPage.jsx';
import KhachCocPage from '@/pages/KhachCocPage.jsx';
import KhachPhauThuatPage from '@/pages/KhachPhauThuatPage.jsx';
import KhachBongPage from '@/pages/KhachBongPage.jsx';
import HauPhauPage from '@/pages/HauPhauPage.jsx';
import FinanceManagementPage from '@/pages/FinanceManagementPage.jsx';
import AdvanceExpensePage from '@/pages/AdvanceExpensePage.jsx';
import AdsReportPage from '@/pages/AdsReportPage.jsx';
import VienPhiPage from '@/pages/VienPhiPage.jsx';
import CashFlowPage from '@/pages/CashFlowPage.jsx';
import HRManagementPage from '@/pages/HRManagementPage.jsx';
import HospitalFeeAndInventoryPage from '@/pages/HospitalFeeAndInventoryPage.jsx';
import DepositManagementPage from '@/pages/DepositManagementPage.jsx';
import ProfileMenu from '@/components/ProfileMenu.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, ClipboardList,
  Banknote, Activity, Target, Wallet, Bell, ShieldCheck, LogOut,
  Menu, X, AlertCircle, ChevronRight, CheckCircle2, CircleDollarSign,
  Briefcase, Plus, Search, UserX, DollarSign, UserCheck, TrendingUp, BarChart2, MessagesSquare
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MENU_GROUPS = [
  { title: null, items: [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  ]},
  { title: 'KHÁCH HÀNG', color: 'blue', items: [
    { id: 'deposit_management', label: 'Quản lý Đặt cọc', icon: ClipboardList },
    { id: 'appointments', label: 'Lịch hẹn', icon: CalendarDays },
    { id: 'khach_phau_thuat', label: 'Khách Phẫu thuật', icon: Activity },
    { id: 'hau_phau', label: 'Hậu phẫu / CSKH', icon: ClipboardList },
  ]},
  { title: 'NHÂN SỰ', color: 'violet', items: [
    { id: 'hr', label: 'Quản lý Nhân sự', icon: Users },
    { id: 'kpi', label: 'KPI & Hoa hồng', icon: Target },
    { id: 'payroll', label: 'Bảng lương', icon: Wallet },
  ]},
  { title: 'TÀI CHÍNH', color: 'amber', items: [
    { id: 'finance', label: 'Doanh thu / Tài chính', icon: Banknote },
    { id: 'cashflow', label: 'Kế toán dòng tiền', icon: BarChart2 },
    { id: 'advances', label: 'Tạm ứng chi', icon: Wallet },
    { id: 'hospital_fee_inventory', label: 'Viện phí / Vật tư', icon: Activity },
    { id: 'marketing', label: 'Marketing / Ads', icon: Target },
  ]},
  { title: 'VẬN HÀNH', color: 'rose', items: [
    { id: 'community', label: 'Cộng đồng', icon: MessagesSquare },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'permissions', label: 'Phân quyền', icon: ShieldCheck },
  ]},
];
const MENU = MENU_GROUPS.flatMap(g => g.items);

// Màu nền/nhãn nhẹ theo nhóm (class tĩnh để Tailwind không purge)
const GROUP_STYLE = {
  blue:   { box: 'bg-blue-50/50',   label: 'text-blue-500',   bar: 'bg-blue-400' },
  violet: { box: 'bg-violet-50/50', label: 'text-violet-500', bar: 'bg-violet-400' },
  amber:  { box: 'bg-amber-50/50',  label: 'text-amber-600',  bar: 'bg-amber-400' },
  rose:   { box: 'bg-rose-50/50',   label: 'text-rose-500',   bar: 'bg-rose-400' },
};

const BOTTOM_NAV = ['overview', 'hr', 'appointments', 'kpi'];

// Mock chart data - sẽ thay bằng Supabase sau
const MOCK_REVENUE = [
  { month: 'T1', revenue: 120 }, { month: 'T2', revenue: 180 },
  { month: 'T3', revenue: 150 }, { month: 'T4', revenue: 210 },
  { month: 'T5', revenue: 190 }, { month: 'T6', revenue: 240 },
];

const CustomBar = (props) => {
  const { x, y, width, height } = props;
  const radius = 8;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height}
        rx={radius} ry={radius}
        fill="url(#greenGrad)" />
    </g>
  );
};

const Overview = ({ profile, setActiveTab }) => {
  const [stats, setStats] = useState({ totalStaff: 0, presentToday: 0, pendingExpenses: 0, monthRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const [s1, s2, s3, s4] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('attendance').select('id', { count: 'exact' }).eq('date', today).eq('status', 'present'),
        supabase.from('expenses').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('customer_appointments').select('revenue').eq('status', 'phau_thuat')
          .gte('surgery_date', `${year}-${String(month).padStart(2,'0')}-01`),
      ]);
      setStats({
        totalStaff: s1.count || 0,
        presentToday: s2.count || 0,
        pendingExpenses: s3.count || 0,
        monthRevenue: (s4.data || []).reduce((acc, r) => acc + (r.revenue || 0), 0),
      });
      setLoading(false);
    };
    load();
  }, []);

  const fmt = (n) => {
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + ' tỷ';
    if (n >= 1000000) return (n / 1000000).toFixed(0) + ' tr';
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  };

  const cards = [
    { label: 'Nhân sự', value: stats.totalStaff, icon: Users, tab: 'hr', color: '#10b981' },
    { label: 'Có mặt', value: stats.presentToday, icon: UserCheck, tab: 'hr', color: '#3b82f6' },
    { label: 'Chờ duyệt', value: stats.pendingExpenses, icon: AlertCircle, tab: 'advances', color: '#f59e0b' },
    { label: 'Doanh thu', value: fmt(stats.monthRevenue), icon: TrendingUp, tab: 'finance', color: '#8b5cf6' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-lg shadow-emerald-200">
        <p className="text-emerald-100 text-sm">Xin chào 👋</p>
        <h2 className="text-xl font-bold mt-0.5">{profile?.full_name || 'Admin'}</h2>
        <p className="text-emerald-200 text-xs mt-1">
          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div className="mt-4 flex items-center gap-2 bg-white/15 rounded-2xl px-4 py-2.5 w-fit">
          <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          <span className="text-sm font-medium">Hệ thống đang hoạt động</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => setActiveTab(c.tab)}
            className="bg-white rounded-2xl p-4 text-left shadow-sm border border-slate-100 active:scale-95 transition-transform"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: c.color + '18' }}>
              <c.icon className="w-4.5 h-4.5" style={{ color: c.color }} />
            </div>
            <div className="text-xl font-bold text-slate-800">{c.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">Doanh thu</h3>
            <p className="text-xs text-slate-400">6 tháng gần nhất</p>
          </div>
          <button className="text-xs text-emerald-600 font-medium flex items-center gap-1" onClick={() => setActiveTab('finance')}>
            Xem thêm <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={MOCK_REVENUE} barSize={28}>
            <defs>
              <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(v) => [`${v}tr đ`, 'Doanh thu']}
            />
            <Bar dataKey="revenue" shape={<CustomBar />} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-3">Truy cập nhanh</h3>
        <div className="space-y-2">
          {[
            { label: 'Quản lý nhân sự', sub: `${stats.totalStaff} nhân sự`, tab: 'hr', icon: Users },
            { label: 'Chấm công hôm nay', sub: `${stats.presentToday} có mặt`, tab: 'hr', icon: CalendarCheck },
            { label: 'KPI & Hoa hồng', sub: 'Xem báo cáo', tab: 'kpi', icon: Target },
          ].map(item => (
            <button key={item.tab} onClick={() => setActiveTab(item.tab)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{item.label}</div>
                <div className="text-xs text-slate-400">{item.sub}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ComingSoon = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-64 space-y-3">
    <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center text-2xl">🚧</div>
    <div className="text-base font-semibold text-slate-700">{label}</div>
    <div className="text-sm text-slate-400">Module đang được xây dựng</div>
  </div>
);

const AdminDashboard = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('admin_active_tab') || 'overview');
  const [hrInitialTab, setHrInitialTab] = useState('staff');

  useEffect(() => { localStorage.setItem('admin_active_tab', activeTab); }, [activeTab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState(0);

  useEffect(() => {
    // Fetch initial count
    const fetchPendingLeaves = async () => {
      const { count } = await supabase.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending');
      setPendingLeaves(count || 0);
    };
    fetchPendingLeaves();

    // Subscribe to real-time changes
    const sub = supabase.channel('leave_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchPendingLeaves();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const handleNav = (e) => {
      const [tab, sub] = String(e.detail).split('#');
      setActiveTab(tab);
      if (sub) setHrInitialTab(sub);
    };
    window.addEventListener('NAVIGATE', handleNav);
    return () => window.removeEventListener('NAVIGATE', handleNav);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <Overview profile={profile} setActiveTab={setActiveTab} />;
      case 'hr': return <HRManagementPage initialTab={hrInitialTab} />;
      case 'deposit_management': return <DepositManagementPage />;
      case 'appointments': return <AppointmentManagementPage />;
      case 'khach_phau_thuat': return <KhachPhauThuatPage setActiveTab={setActiveTab} />;
      case 'hau_phau': return <HauPhauPage />;
      case 'advances': return <AdvanceExpensePage />;
      case 'finance': return <FinanceManagementPage />;
      case 'kpi': return <KPIManagementPage />;
      case 'payroll': return <PayrollPage />;
      case 'community': return <CommunityPage />;
      case 'notifications': return <NotificationsPage />;
      case 'ads_report': return <AdsReportPage />;
      case 'hospital_fee_inventory': return <HospitalFeeAndInventoryPage />;
      case 'cashflow': return <CashFlowPage />;
      default: return <ComingSoon label={MENU.find(m => m.id === activeTab)?.label || activeTab} />;
    }
  };

  const activeMenu = MENU.find(m => m.id === activeTab);

  return (
    <div className="min-h-screen flex" style={{ background: '#f0fdf4' }}>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar desktop */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 z-30 flex flex-col
        bg-white border-r border-emerald-100 shadow-xl
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-5 border-b border-emerald-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md overflow-hidden p-1">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Dr Tuấn Hùng</div>
                <div className="text-xs text-emerald-500">Internal System</div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-2">
          {MENU_GROUPS.map((group, gi) => {
            const gs = GROUP_STYLE[group.color] || {};
            return (
            <div key={group.title || `g${gi}`} className={group.title ? `rounded-2xl p-1.5 ${gs.box}` : ''}>
              {group.title && (
                <div className={`flex items-center gap-1.5 px-2.5 pt-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${gs.label}`}>
                  <span className={`w-1 h-3 rounded-full ${gs.bar}`} />
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-medium transition-all
                        ${active
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                          : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </div>
                      {item.id === 'hr' && pendingLeaves > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {pendingLeaves}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar - chỉ desktop */}
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-emerald-100 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {activeMenu && <activeMenu.icon className="w-4 h-4 text-emerald-600" />}
            <span className="font-semibold text-slate-700 text-sm">{activeMenu?.label}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu mobile={false}>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {profile?.full_name?.charAt(0) || 'A'}
                </div>
                <span className="text-sm font-semibold text-slate-700">{profile?.full_name}</span>
              </div>
            </ProfileMenu>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between bg-white border-b border-emerald-100 px-4 py-3 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 p-1">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {activeMenu && <activeMenu.icon className="w-4 h-4 text-emerald-600" />}
            <span className="font-semibold text-slate-700 text-sm">{activeMenu?.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu mobile={true}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white text-xs font-bold hover:shadow-md transition-shadow cursor-pointer">
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
            </ProfileMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {renderContent()}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-emerald-100 shadow-lg">
        <div className="flex items-stretch safe-pb">
          {MENU.filter(m => BOTTOM_NAV.includes(m.id)).map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-all relative"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  active ? 'bg-emerald-500 shadow-md shadow-emerald-200' : ''
                }`}>
                  <Icon className={`w-4 h-4 transition-colors ${active ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <span className={`text-[10px] font-medium leading-none transition-colors ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {item.shortLabel}
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

export default AdminDashboard;
