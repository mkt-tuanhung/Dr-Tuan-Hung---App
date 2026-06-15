
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, Home, Target, Banknote, CalendarDays, Activity, Bell } from 'lucide-react';
import { countPendingNotifications } from '@/utils/ApprovalNotificationHelper.js';
import { hasPermission, isTelesale, isSaleOffline } from '@/utils/permissionHelper.js';

const Header = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionsUpdateKey, setPermissionsUpdateKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    const loadNotifications = () => {
      const count = countPendingNotifications(user.id || user.employeeId, user.role);
      setUnreadCount(count);
    };
    
    const handleSync = (e) => {
      if (e.detail?.table === 'approval_notifications') {
        loadNotifications();
      }
    };
    
    const handlePermissionsUpdate = () => setPermissionsUpdateKey(k => k + 1);
    
    loadNotifications();
    window.addEventListener('notificationsUpdated', loadNotifications);
    window.addEventListener('supabase-data-updated', handleSync);
    window.addEventListener('permissionsUpdated', handlePermissionsUpdate);
    
    return () => {
      window.removeEventListener('notificationsUpdated', loadNotifications);
      window.removeEventListener('supabase-data-updated', handleSync);
      window.removeEventListener('permissionsUpdated', handlePermissionsUpdate);
    };
  }, [user]);

  if (!isLoggedIn || !user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getHomePath = () => {
    switch(user.role) {
      case 'Admin': return '/admin-dashboard';
      case 'Nhân viên': return '/staff-dashboard';
      case 'Kế toán': return '/accountant-dashboard';
      case 'Cổ đông': return '/shareholder-dashboard';
      default: return '/';
    }
  };

  const canViewDashboard = hasPermission(user, 'Tổng quan', 'view');
  const canViewAttendance = hasPermission(user, 'Chấm công', 'view');
  const canViewAppointments = hasPermission(user, 'Lịch hẹn', 'view');
  const canViewSurgical = hasPermission(user, 'Khách phẫu thuật', 'view');
  const canViewKpi = hasPermission(user, 'KPI', 'view');
  const canViewNotifications = hasPermission(user, 'Thông báo', 'view');

  const showRevenue = user.role === 'Admin' || isTelesale(user) || isSaleOffline(user);

  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <Link to={to}>
        <Button variant={isActive ? "secondary" : "ghost"} className={`text-sm font-medium rounded-xl transition-all ${isActive ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/50'}`}>
          <Icon className="w-4 h-4 mr-2" /> {label}
        </Button>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b-0 rounded-none shadow-sm pt-safe">
      <div className="container mx-auto max-w-[1400px] flex h-16 items-center justify-between px-4 sm:px-6">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link to={canViewDashboard ? getHomePath() : '#'} className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            Dr Tuấn Hùng
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex gap-1 items-center">
            {canViewDashboard && <NavItem to={getHomePath()} icon={Home} label="Trang chủ" />}
            
            {canViewAttendance && (
              <NavItem to={user.role === 'Admin' ? '/attendance-admin' : '/attendance-employee'} icon={Calendar} label="Chấm công" />
            )}

            {canViewAppointments && (
              <NavItem to="/appointments" icon={CalendarDays} label="Lịch hẹn" />
            )}

            {canViewSurgical && (
              <NavItem to="/surgical-customers" icon={Activity} label="Phẫu thuật" />
            )}

            {canViewKpi && (
              <NavItem to={user.role === 'Admin' ? "/kpi-admin" : "/kpi-personal"} icon={Target} label="KPI" />
            )}
            
            {showRevenue && (
              <NavItem to="/admin/revenue-management" icon={Banknote} label="Doanh thu" />
            )}
          </nav>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {canViewNotifications && (
            <Link to="/approval-notifications" className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          <div className="hidden sm:block text-right pr-2 border-r border-border/50 mr-2">
            <p className="text-sm font-semibold leading-none text-foreground">{user.fullName}</p>
            <p className="text-xs text-muted-foreground mt-1">{user.role}</p>
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl">
            <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
          </Button>

          <button 
            onClick={handleLogout}
            className="sm:hidden w-10 h-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
