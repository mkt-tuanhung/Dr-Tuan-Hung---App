
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { motion } from 'framer-motion';
import { Users, Banknote, CalendarDays, Activity, Target, Wallet, Bell, LayoutDashboard, CalendarCheck, ClipboardList, Settings, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { Button } from '@/components/ui/button';

import DashboardStatsCard from '@/components/DashboardStatsCard.jsx';
import DashboardChart from '@/components/DashboardChart.jsx';
import RefreshLocalDataModal from '@/components/RefreshLocalDataModal.jsx';

import { getKpiTargetsByMonth } from '@/utils/userStorage.js';
import { getCustomerAppointments } from '@/utils/appointmentStorage.js';
import { getSurgicalAssignmentsByMonth } from '@/utils/surgicalCareAssignments.js';
import { getClaims } from '@/utils/staffExpenseClaimsStorage.js';
import { countPendingNotifications } from '@/utils/ApprovalNotificationHelper.js';
import { format } from 'date-fns';
import { hasPermission } from '@/utils/permissionHelper.js';

import StaffManagementPage from '@/pages/StaffManagementPage.jsx';
import AttendanceAdminPage from '@/pages/AttendanceAdminPage.jsx';
import CustomerAppointmentPage from '@/pages/CustomerAppointmentPage.jsx';
import BongCustomerModule from '@/pages/BongCustomerModule.jsx';
import DepositCustomerModule from '@/pages/DepositCustomerModule.jsx';
import SurgicalCustomerModule from '@/pages/SurgicalCustomerModule.jsx';
import KpiCommissionAdminPage from '@/pages/KpiCommissionAdminPage.jsx';
import AdminRevenueManagementPage from '@/pages/AdminRevenueManagementPage.jsx';
import PayrollAdminPage from '@/pages/PayrollAdminPage.jsx';
import StaffExpenseClaimsPage from '@/pages/StaffExpenseClaimsPage.jsx';
import ApprovalNotificationsPage from '@/pages/ApprovalNotificationsPage.jsx';
import PermissionSettingsPage from '@/pages/PermissionSettingsPage.jsx';

const formatFullVND = (amount) => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '0đ';
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount))}đ`;
};

const AdminOverview = ({ user, setActiveTab }) => {
  const navigate = useNavigate();
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [stats, setStats] = useState({
    revenue: 0, revenueTrend: null, appointments: 0, surgical: 0, kpi: 0, advances: 0, notifications: 0
  });

  const [charts, setCharts] = useState({
    revenueByDay: [], appointmentsByStatus: [], advancesByDept: []
  });

  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);

  useEffect(() => {
    const loadStats = () => {
      const allRevenues = JSON.parse(localStorage.getItem('revenueRecords') || '[]');
      const currentMonthRevenues = allRevenues.filter(r => {
        const recMonth = r.month || String(r.revenueDate || r.date || r.createdAt || '').slice(0, 7);
        return recMonth === currentMonth;
      });

      const totalRev = currentMonthRevenues.reduce((sum, r) => {
        const amt = Number(r.revenueAmount) || Number(r.surgeryRevenue) || Number(r.amount) || Number(r.revenue) || Number(r.totalRevenue) || 0;
        return sum + amt;
      }, 0);

      const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const prevMonthRevenues = allRevenues.filter(r => {
        const recMonth = r.month || String(r.revenueDate || r.date || r.createdAt || '').slice(0, 7);
        return recMonth === previousMonth;
      });

      const prevMonthRevenue = prevMonthRevenues.reduce((sum, r) => {
        const amt = Number(r.revenueAmount) || Number(r.surgeryRevenue) || Number(r.amount) || Number(r.revenue) || Number(r.totalRevenue) || 0;
        return sum + amt;
      }, 0);

      let revenueTrend = null;
      if (prevMonthRevenue > 0) {
        const growth = ((totalRev - prevMonthRevenue) / prevMonthRevenue) * 100;
        revenueTrend = {
          value: `${Math.abs(growth).toFixed(1)}%`,
          label: 'so với tháng trước',
          isPositive: growth >= 0
        };
      }
      
      const revByDayMap = currentMonthRevenues.reduce((acc, r) => {
        const dateStr = r.revenueDate || r.date || r.createdAt;
        const day = dateStr ? new Date(dateStr).getDate() : new Date().getDate();
        const amt = Number(r.revenueAmount) || Number(r.surgeryRevenue) || Number(r.amount) || Number(r.revenue) || Number(r.totalRevenue) || 0;
        acc[day] = (acc[day] || 0) + amt;
        return acc;
      }, {});
      
      const revenueByDayData = Array.from({ length: 31 }, (_, i) => ({
        name: `${i + 1}`,
        DoanhThu: revByDayMap[i + 1] || 0
      })).filter(d => d.DoanhThu > 0 || d.name === '1' || d.name === '31');

      const allAppointments = getCustomerAppointments();
      const currentMonthAppts = allAppointments.filter(a => a.appointmentDate && a.appointmentDate.startsWith(currentMonth));
      const apptStatusMap = currentMonthAppts.reduce((acc, a) => {
        const s = a.status || 'Khác';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
      const apptsData = Object.keys(apptStatusMap).map(k => ({ name: k, value: apptStatusMap[k] }));

      const surgical = getSurgicalAssignmentsByMonth(currentMonth);

      const kpis = getKpiTargetsByMonth(currentMonth);
      const avgKpi = kpis.length ? Math.round(kpis.reduce((sum, k) => {
        const pct = (Number(k.achieved) || 0) / (Number(k.target) || 1) * 100;
        return sum + Math.min(pct, 100);
      }, 0) / kpis.length) : 0;

      const claims = getClaims().filter(c => !c.isDeleted && c.status !== 'rejected');
      const remainingAdvance = claims.reduce((sum, c) => {
        if (c.transactionType === 'advance_expense') {
          const reimbursements = claims.filter(r => r.transactionType === 'reimbursement' && r.sourceClaimId === c.id);
          const paid = reimbursements.reduce((s, r) => s + (Number(r.amount) || 0), 0);
          return sum + Math.max(0, (Number(c.amount) || 0) - paid);
        }
        return sum;
      }, 0);

      const advancesMap = claims.filter(c => c.transactionType === 'advance_expense').reduce((acc, c) => {
        const name = c.employeeName.split(' ').pop();
        acc[name] = (acc[name] || 0) + Number(c.amount || 0);
        return acc;
      }, {});
      const advData = Object.keys(advancesMap).slice(0, 5).map(k => ({ name: k, 'Tạm ứng': advancesMap[k] }));

      const unreadNotifs = countPendingNotifications(user?.id || user?.employeeId, user?.role);

      setStats({
        revenue: totalRev, revenueTrend, appointments: currentMonthAppts.length, surgical: surgical.length,
        kpi: avgKpi, advances: remainingAdvance, notifications: unreadNotifs
      });

      setCharts({
        revenueByDay: revenueByDayData, appointmentsByStatus: apptsData, advancesByDept: advData
      });
    };

    loadStats();

    const handleSync = (e) => {
      if (!e.detail || ['approval_notifications', 'staff_expense_claims', 'revenue_records', 'customer_appointments'].includes(e.detail.table)) {
        loadStats();
      }
    };

    window.addEventListener('supabase-data-updated', handleSync);
    window.addEventListener('notificationsUpdated', loadStats);
    
    return () => {
      window.removeEventListener('supabase-data-updated', handleSync);
      window.removeEventListener('notificationsUpdated', loadStats);
    };
  }, [currentMonth, user]);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  const formatYAxis = (val) => {
    if (!val || val === 0) return '0';
    if (val >= 1000000) return `${Math.round(val / 1000000)}M`;
    return val.toLocaleString('vi-VN');
  };

  const quickLinks = [
    { label: 'Quản lý Nhân sự', tab: 'Nhân sự', icon: Users, module: 'Nhân sự' },
    { label: 'Duyệt Tạm ứng chi', tab: 'Tạm ứng chi', icon: Wallet, module: 'Tạm ứng chi' },
    { label: 'Duyệt Chấm công', tab: 'Chấm công', icon: CalendarDays, module: 'Chấm công' },
    { label: 'Doanh thu', tab: 'Doanh thu', icon: Banknote, module: 'Doanh thu' },
    { label: 'Bảng lương tổng', tab: 'Bảng lương', icon: Target, module: 'Bảng lương' }
  ].filter(link => hasPermission(user, link.module, 'view'));

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Tổng quan hệ thống</h1>
          <p className="text-muted-foreground mt-2 text-base">Chào mừng {user?.fullName}. Dữ liệu cập nhật tháng {format(today, 'MM/yyyy')}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === 'Admin' && (
            <Button onClick={() => setIsRefreshModalOpen(true)} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors">
              <RefreshCw className="w-4 h-4 mr-2" /> Làm mới dữ liệu từ Supabase
            </Button>
          )}
          {hasPermission(user, 'Thông báo', 'view') && (
            <Button onClick={() => setActiveTab('Thông báo')} className="btn-primary-glass">
              <Bell className="w-4 h-4 mr-2" /> 
              {stats.notifications > 0 ? `${stats.notifications} Việc cần xử lý` : 'Thông báo'}
            </Button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
        <div className="xl:col-span-2">
          <DashboardStatsCard title="Doanh thu tháng" value={formatFullVND(stats.revenue)} icon={Banknote} variant="teal" trend={stats.revenueTrend} />
        </div>
        <DashboardStatsCard title="Lịch hẹn" value={stats.appointments} icon={CalendarDays} delay={0.1} />
        <DashboardStatsCard title="Phẫu thuật" value={stats.surgical} icon={Activity} delay={0.15} />
        <DashboardStatsCard title="KPI Trung bình" value={stats.kpi} suffix="%" icon={Target} delay={0.2} />
        <DashboardStatsCard title="Tạm ứng tồn" value={formatFullVND(stats.advances)} icon={Wallet} variant="accent" delay={0.25} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardChart title="Doanh thu theo ngày (Tháng này)" delay={0.3}>
            {charts.revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.revenueByDay} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickFormatter={formatYAxis} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <RechartsTooltip formatter={(value) => formatFullVND(value)} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="DoanhThu" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Chưa có dữ liệu doanh thu</div>}
          </DashboardChart>
        </div>
        <div className="flex flex-col gap-6">
          <DashboardChart title="Trạng thái Lịch hẹn" delay={0.4}>
            {charts.appointmentsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.appointmentsByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                    {charts.appointmentsByStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Chưa có lịch hẹn</div>}
          </DashboardChart>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardChart title="Top tạm ứng chi" delay={0.5}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.advancesByDept} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={formatYAxis} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={70} />
              <RechartsTooltip formatter={(value) => formatFullVND(value)} cursor={{ fill: 'hsl(var(--muted)/0.5)' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="Tạm ứng" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </DashboardChart>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="glass-panel p-6 flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Chuyển hướng nhanh</h3>
          </div>
          {quickLinks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickLinks.map((item, i) => (
                <Button key={i} variant="outline" className="h-14 justify-start bg-white/40 hover:bg-white/70 border-white/50" onClick={() => setActiveTab(item.tab)}>
                  <item.icon className="w-5 h-5 mr-3 text-primary" />
                  {item.label}
                </Button>
              ))}
            </div>
          ) : (
             <div className="flex h-full items-center justify-center text-muted-foreground">Bạn không có quyền xem các liên kết nhanh.</div>
          )}
        </motion.div>
      </div>
      <RefreshLocalDataModal isOpen={isRefreshModalOpen} onClose={() => setIsRefreshModalOpen(false)} />
    </div>
  );
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Tổng quan');
  const [permissionsUpdateKey, setPermissionsUpdateKey] = useState(0);

  useEffect(() => {
    const handlePermissionsUpdate = () => setPermissionsUpdateKey(k => k + 1);
    window.addEventListener('permissionsUpdated', handlePermissionsUpdate);
    return () => window.removeEventListener('permissionsUpdated', handlePermissionsUpdate);
  }, []);

  const allMenuItems = [
    { id: 'Tổng quan', icon: LayoutDashboard, component: <AdminOverview user={user} setActiveTab={setActiveTab} />, module: 'Tổng quan' },
    { id: 'Nhân sự', icon: Users, component: <StaffManagementPage />, module: 'Nhân sự' },
    { id: 'Chấm công', icon: CalendarCheck, component: <AttendanceAdminPage />, module: 'Chấm công' },
    { id: 'Lịch hẹn', icon: CalendarDays, component: <CustomerAppointmentPage />, module: 'Lịch hẹn' },
    { id: 'Khách Bong', icon: ClipboardList, component: <BongCustomerModule />, module: 'Khách Bong' },
    { id: 'Khách Cọc', icon: Banknote, component: <DepositCustomerModule />, module: 'Khách Cọc' },
    { id: 'Khách phẫu thuật', icon: Activity, component: <SurgicalCustomerModule />, module: 'Khách phẫu thuật' },
    { id: 'KPI', icon: Target, component: <KpiCommissionAdminPage />, module: 'KPI' },
    { id: 'Doanh thu', icon: Banknote, component: <AdminRevenueManagementPage />, module: 'Doanh thu' },
    { id: 'Bảng lương', icon: Wallet, component: <PayrollAdminPage />, module: 'Bảng lương' },
    { id: 'Tạm ứng chi', icon: Banknote, component: <StaffExpenseClaimsPage />, module: 'Tạm ứng chi' },
    { id: 'Thông báo', icon: Bell, component: <ApprovalNotificationsPage />, module: 'Thông báo' },
    { id: 'Cài đặt phân quyền', icon: ShieldCheck, component: <PermissionSettingsPage hideLayout />, module: 'Cài đặt phân quyền' }
  ];

  const menuItems = allMenuItems.filter(item => hasPermission(user, item.module, 'view'));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const activeItem = menuItems.find(m => m.id === activeTab) || menuItems[0];

  return (
    <>
      <Helmet>
        <title>Dashboard - Dr Tuấn Hùng</title>
      </Helmet>
      
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col z-20 flex-shrink-0">
          <div className="p-6 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
            <h2 className="text-2xl font-bold text-primary tracking-tight">Dr Tuấn Hùng</h2>
            <p className="text-xs text-muted-foreground mt-1">Management Panel</p>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeItem?.id === item.id 
                    ? 'bg-primary text-primary-foreground shadow-[0_4px_14px_0_hsl(var(--primary)/0.3)]' 
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="font-medium text-sm text-left">{item.id}</span>
              </button>
            ))}
          </nav>
          
          <div className="p-4 border-t border-border bg-muted/20">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-sm">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate text-foreground">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Đăng xuất</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 h-screen overflow-y-auto relative pb-24 md:pb-0 bg-background/50">
          {activeItem ? activeItem.component : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Không có quyền truy cập module nào.</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default AdminDashboard;
