
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { motion } from 'framer-motion';
import { LayoutDashboard, CalendarDays, Banknote, Wallet, Bell, Target, TrendingUp, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Button } from '@/components/ui/button';

import DashboardStatsCard from '@/components/DashboardStatsCard.jsx';
import DashboardChart from '@/components/DashboardChart.jsx';

import { getRevenueRecordsByMonth } from '@/utils/userStorage.js';
import { getClaims } from '@/utils/staffExpenseClaimsStorage.js';
import { countPendingNotifications } from '@/utils/ApprovalNotificationHelper.js';
import { format } from 'date-fns';

// Module Pages
import CustomerAppointmentPage from '@/pages/CustomerAppointmentPage.jsx';
import AdminRevenueManagementPage from '@/pages/AdminRevenueManagementPage.jsx';
import PayrollAdminPage from '@/pages/PayrollAdminPage.jsx';
import StaffExpenseClaimsPage from '@/pages/StaffExpenseClaimsPage.jsx';
import ApprovalNotificationsPage from '@/pages/ApprovalNotificationsPage.jsx';

// Helper function cho format tiền VND đầy đủ
const formatFullVND = (amount) => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '0đ';
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount))}đ`;
};

const AccountantOverview = ({ user, setActiveTab }) => {
  const navigate = useNavigate();
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [stats, setStats] = useState({ revenue: 0, revenueTrend: null, advances: 0, notifications: 0 });
  const [charts, setCharts] = useState({ advancesByDept: [] });

  useEffect(() => {
    const loadStats = () => {
      // Tính doanh thu tháng hiện tại
      const currentRevenues = getRevenueRecordsByMonth(currentMonth);
      const totalRev = currentRevenues.reduce((sum, r) => sum + (Number(r.revenueAmount) || Number(r.surgeryRevenue) || Number(r.amount) || Number(r.revenue) || Number(r.totalRevenue) || 0), 0);
      
      // Tính doanh thu tháng trước để tính growth
      const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const prevRevenues = getRevenueRecordsByMonth(previousMonth);
      const prevMonthRevenue = prevRevenues.reduce((sum, r) => sum + (Number(r.revenueAmount) || Number(r.surgeryRevenue) || Number(r.amount) || Number(r.revenue) || Number(r.totalRevenue) || 0), 0);

      let revenueTrend = null;
      if (prevMonthRevenue > 0) {
        const growth = ((totalRev - prevMonthRevenue) / prevMonthRevenue) * 100;
        revenueTrend = {
          value: `${Math.abs(growth).toFixed(1)}%`,
          label: 'so với tháng trước',
          isPositive: growth >= 0
        };
      }

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

      setStats({ revenue: totalRev, revenueTrend, advances: remainingAdvance, notifications: unreadNotifs });
      setCharts({ advancesByDept: advData });
    };

    loadStats();

    const handleSync = (e) => {
      if (!e.detail || ['approval_notifications', 'staff_expense_claims', 'revenue_records'].includes(e.detail.table)) {
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

  const formatYAxis = (val) => {
    if (!val || val === 0) return '0';
    if (val >= 1000000) return `${Math.round(val / 1000000)}M`;
    return val.toLocaleString('vi-VN');
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Kế toán - Tài chính</h1>
          <p className="text-muted-foreground mt-2 text-base">Chào mừng {user?.fullName}. Dữ liệu cập nhật tháng {format(today, 'MM/yyyy')}.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <DashboardStatsCard title="Doanh thu ghi nhận" value={formatFullVND(stats.revenue)} icon={TrendingUp} variant="teal" delay={0.1} trend={stats.revenueTrend} />
        <DashboardStatsCard title="Tạm ứng chưa hoàn" value={formatFullVND(stats.advances)} icon={Wallet} variant="accent" delay={0.2} />
        <DashboardStatsCard title="Yêu cầu chờ duyệt" value={stats.notifications} icon={Bell} delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardChart title="Top Tạm ứng chi" delay={0.4}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.advancesByDept} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={formatYAxis} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={70} />
              <RechartsTooltip formatter={(value) => formatFullVND(value)} cursor={{ fill: 'hsl(var(--muted)/0.5)' }} contentStyle={{ borderRadius: '1rem', border: 'none' }} />
              <Bar dataKey="Tạm ứng" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </DashboardChart>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="glass-panel p-6 h-[300px] flex flex-col justify-center">
          <h3 className="text-xl font-semibold mb-6">Nghiệp vụ Kế toán</h3>
          <div className="flex flex-col gap-4">
            <Button variant="outline" className="h-14 justify-start text-base bg-white/40 hover:bg-white/70" onClick={() => setActiveTab('Tạm ứng chi')}>
              <Wallet className="w-5 h-5 mr-3 text-primary" /> Duyệt & Ghi nhận Tạm ứng chi
            </Button>
            <Button variant="outline" className="h-14 justify-start text-base bg-white/40 hover:bg-white/70" onClick={() => setActiveTab('Thông báo phê duyệt')}>
              <Bell className="w-5 h-5 mr-3 text-primary" /> Xem Thông báo yêu cầu
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const AccountantDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Tổng quan');

  const menuItems = [
    { id: 'Tổng quan', icon: LayoutDashboard, component: <AccountantOverview user={user} setActiveTab={setActiveTab} /> },
    { id: 'Lịch hẹn', icon: CalendarDays, component: <CustomerAppointmentPage /> },
    { id: 'Doanh thu', icon: Banknote, component: <AdminRevenueManagementPage /> },
    { id: 'Bảng lương', icon: Wallet, component: <PayrollAdminPage /> },
    { id: 'Tạm ứng chi', icon: Banknote, component: <StaffExpenseClaimsPage /> },
    { id: 'Thông báo phê duyệt', icon: Bell, component: <ApprovalNotificationsPage /> }
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const activeItem = menuItems.find(m => m.id === activeTab);

  return (
    <>
      <Helmet>
        <title>Accountant Dashboard - Dr Tuấn Hùng</title>
      </Helmet>
      
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col z-20 flex-shrink-0">
          <div className="p-6 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
            <h2 className="text-2xl font-bold text-primary tracking-tight">Dr Tuấn Hùng</h2>
            <p className="text-xs text-muted-foreground mt-1">Accountant Panel</p>
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
          {activeItem ? activeItem.component : <AccountantOverview user={user} setActiveTab={setActiveTab} />}
        </main>
      </div>
    </>
  );
};

export default AccountantDashboard;
