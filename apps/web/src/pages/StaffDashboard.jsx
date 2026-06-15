
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { motion } from 'framer-motion';
import { LayoutDashboard, CalendarCheck, CalendarDays, Activity, Target, Wallet, Bell, LogOut, Banknote, UserCheck, Coins } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';

import DashboardStatsCard from '@/components/DashboardStatsCard.jsx';
import DashboardChart from '@/components/DashboardChart.jsx';

import { getKpiTargetByEmployeeAndMonth } from '@/utils/userStorage.js';
import { getCustomerAppointments } from '@/utils/appointmentStorage.js';
import { getClaims } from '@/utils/staffExpenseClaimsStorage.js';
import { countPendingNotifications } from '@/utils/ApprovalNotificationHelper.js';
import { isTelesale, isSaleOffline } from '@/utils/permissionHelper.js';

import AttendanceEmployeePage from '@/pages/AttendanceEmployeePage.jsx';
import CustomerAppointmentPage from '@/pages/CustomerAppointmentPage.jsx';
import BongCustomerModule from '@/pages/BongCustomerModule.jsx';
import DepositCustomerModule from '@/pages/DepositCustomerModule.jsx';
import SurgicalCustomerModule from '@/pages/SurgicalCustomerModule.jsx';
import KPIPersonalPage from '@/pages/KPIPersonalPage.jsx';
import PayrollEmployeePage from '@/pages/PayrollEmployeePage.jsx';
import StaffExpenseClaimsPage from '@/pages/StaffExpenseClaimsPage.jsx';
import ApprovalNotificationsPage from '@/pages/ApprovalNotificationsPage.jsx';
import AdminRevenueManagementPage from '@/pages/AdminRevenueManagementPage.jsx';

const formatFullVND = (amount) => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '0đ';
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount))}đ`;
};

const StaffOverview = ({ user, setActiveTab }) => {
  const navigate = useNavigate();
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [stats, setStats] = useState({
    appointments: 0, kpiPct: 0, advances: 0, notifications: 0
  });

  const [charts, setCharts] = useState({ kpiProgress: [] });

  useEffect(() => {
    if (!user) return;
    const empId = user.employeeId || user.id;

    const loadStats = () => {
      const allAppointments = getCustomerAppointments();
      const myAppts = allAppointments.filter(a => a.appointmentDate && a.appointmentDate.startsWith(currentMonth));
      
      const kpi = getKpiTargetByEmployeeAndMonth ? getKpiTargetByEmployeeAndMonth(empId, currentMonth) : null;
      let pct = 0;
      if (kpi && Number(kpi.target) > 0) {
        pct = Math.round((Number(kpi.achieved) || 0) / Number(kpi.target) * 100);
      }
      
      const kpiData = [
        { name: 'Đã đạt', value: Math.min(pct, 100) },
        { name: 'Còn lại', value: Math.max(100 - pct, 0) }
      ];

      const claims = getClaims().filter(c => !c.isDeleted && String(c.employeeId) === String(empId) && c.status !== 'rejected');
      const remainingAdvance = claims.reduce((sum, c) => {
        if (c.transactionType === 'advance_expense') {
          const reimbursements = claims.filter(r => r.transactionType === 'reimbursement' && r.sourceClaimId === c.id);
          const paid = reimbursements.reduce((s, r) => s + (Number(r.amount) || 0), 0);
          return sum + Math.max(0, (Number(c.amount) || 0) - paid);
        }
        return sum;
      }, 0);

      const unreadNotifs = countPendingNotifications(empId, user.role);

      setStats({
        appointments: myAppts.length, kpiPct: pct, advances: remainingAdvance, notifications: unreadNotifs
      });

      setCharts({ kpiProgress: kpiData });
    };

    loadStats();

    const handleSync = (e) => {
      if (!e.detail || ['approval_notifications', 'staff_expense_claims', 'customer_appointments', 'kpi_targets'].includes(e.detail.table)) {
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

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--border))'];

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Tổng quan cá nhân</h1>
          <p className="text-muted-foreground mt-2 text-base">Chào mừng {user?.fullName}. {user?.departmentPosition ? `Phòng ban: ${user.departmentPosition}` : ''}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <DashboardStatsCard title="Lịch hẹn tham gia" value={stats.appointments} icon={CalendarDays} delay={0.1} />
        <DashboardStatsCard title="Tiến độ KPI" value={stats.kpiPct} suffix="%" icon={Target} variant="teal" delay={0.2} />
        <DashboardStatsCard title="Tạm ứng chưa hoàn" value={formatFullVND(stats.advances)} icon={Wallet} variant="accent" delay={0.3} />
        <DashboardStatsCard title="Thông báo chờ xử lý" value={stats.notifications} icon={Bell} delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <DashboardChart title="Tiến độ KPI tháng" delay={0.5}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.kpiProgress} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={0} dataKey="value" startAngle={90} endAngle={-270}>
                  {charts.kpiProgress.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />)}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-foreground">{stats.kpiPct}%</text>
              </PieChart>
            </ResponsiveContainer>
          </DashboardChart>
        </div>
        
        <div className="lg:col-span-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="glass-panel p-6 h-full flex flex-col justify-center">
            <h3 className="text-xl font-semibold mb-6">Chức năng thường dùng</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" className="h-16 justify-start text-base bg-white/40 hover:bg-white/70" onClick={() => setActiveTab('Lịch hẹn')}>
                <CalendarDays className="w-6 h-6 mr-4 text-primary" /> Xem Lịch hẹn
              </Button>
              <Button variant="outline" className="h-16 justify-start text-base bg-white/40 hover:bg-white/70" onClick={() => setActiveTab('KPI - Hoa hồng')}>
                <Target className="w-6 h-6 mr-4 text-primary" /> Cập nhật KPI
              </Button>
              <Button variant="outline" className="h-16 justify-start text-base bg-white/40 hover:bg-white/70" onClick={() => setActiveTab('Tạm ứng chi')}>
                <Wallet className="w-6 h-6 mr-4 text-primary" /> Tạo Tạm ứng chi
              </Button>
              <Button variant="outline" className="h-16 justify-start text-base bg-white/40 hover:bg-white/70" onClick={() => setActiveTab('Thông báo phê duyệt')}>
                <Bell className="w-6 h-6 mr-4 text-primary" /> Xem Thông báo
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('Tổng quan');

  useEffect(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('bong')) setActiveTab('Khách Bong');
    else if (path.includes('deposit')) setActiveTab('Khách Cọc');
    else if (path.includes('surgical')) setActiveTab('Khách phẫu thuật');
    else if (path.includes('kpi')) setActiveTab('KPI - Hoa hồng');
    else if (path.includes('revenue')) setActiveTab('Doanh thu');
    else if (path.includes('payroll')) setActiveTab('Bảng lương');
    else if (path.includes('expense')) setActiveTab('Tạm ứng chi');
    else if (path.includes('notification')) setActiveTab('Thông báo phê duyệt');
    else if (path.includes('attendance')) setActiveTab('Chấm công');
    else if (path.includes('appointment')) setActiveTab('Lịch hẹn');
    else if (path.includes('staff-dashboard')) setActiveTab('Tổng quan');
  }, [location.pathname]);

  const menuItems = [
    { id: 'Tổng quan', icon: LayoutDashboard, component: <StaffOverview user={user} setActiveTab={setActiveTab} /> },
    { id: 'Chấm công', icon: CalendarCheck, component: <AttendanceEmployeePage /> },
    { id: 'Lịch hẹn', icon: CalendarDays, component: <CustomerAppointmentPage /> },
    { id: 'Khách Bong', icon: UserCheck, component: <BongCustomerModule /> },
    { id: 'Khách Cọc', icon: Coins, component: <DepositCustomerModule /> },
    { id: 'Khách phẫu thuật', icon: Activity, component: <SurgicalCustomerModule /> },
    { id: 'KPI - Hoa hồng', icon: Target, component: <KPIPersonalPage /> },
    { id: 'Bảng lương', icon: Wallet, component: <PayrollEmployeePage /> },
    { id: 'Tạm ứng chi', icon: Banknote, component: <StaffExpenseClaimsPage /> },
    { id: 'Thông báo phê duyệt', icon: Bell, component: <ApprovalNotificationsPage /> }
  ];

  if (isTelesale(user) || isSaleOffline(user)) {
    menuItems.push({ 
      id: 'Doanh thu', 
      icon: Banknote, 
      component: <AdminRevenueManagementPage isNested={true} /> 
    });
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const activeItem = menuItems.find(m => m.id === activeTab);

  return (
    <>
      <Helmet>
        <title>Staff Dashboard - Dr Tuấn Hùng</title>
      </Helmet>
      
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col z-20 flex-shrink-0">
          <div className="p-6 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
            <h2 className="text-2xl font-bold text-primary tracking-tight">Dr Tuấn Hùng</h2>
            <p className="text-xs text-muted-foreground mt-1">Staff Panel</p>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === item.id 
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
                <p className="text-xs text-muted-foreground truncate">{user?.departmentPosition || user?.role}</p>
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
          {activeItem ? activeItem.component : <StaffOverview user={user} setActiveTab={setActiveTab} />}
        </main>
      </div>
    </>
  );
};

export default StaffDashboard;
