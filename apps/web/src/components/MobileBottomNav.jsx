
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CalendarCheck, CalendarDays, 
  Banknote, Bell, Target, Activity, Wallet, 
  UserCheck, Coins, Settings, Receipt, LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { countPendingNotifications } from '@/utils/ApprovalNotificationHelper.js';
import { getAccessibleMenus } from '@/utils/permissionHelper.js';

const ICON_MAP = {
  'Tổng quan': LayoutDashboard,
  'Nhân sự': Users,
  'Chấm công': CalendarCheck,
  'Lịch hẹn': CalendarDays,
  'Khách Bong': UserCheck,
  'Khách Cọc': Coins,
  'Khách phẫu thuật': Activity,
  'KPI': Target,
  'Doanh thu': Banknote,
  'Bảng lương': Wallet,
  'Tạm ứng chi': Receipt,
  'Thông báo': Bell,
  'Cài đặt phân quyền': Settings
};

const MobileBottomNav = () => {
  const { user, logout } = useAuth();
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

  if (!user) return null;

  const handleLogout = (e) => {
    e.preventDefault();
    e.stopPropagation();
    logout();
    navigate('/');
  };

  const rawMenus = getAccessibleMenus(user);
  
  // Filter out strict admin menus for regular staff
  const visibleMenus = rawMenus.filter(m => {
    if (user.role === 'Admin') return true;
    return m.id !== 'Nhân sự' && m.id !== 'Cài đặt phân quyền';
  });

  const scrollableLinks = visibleMenus.map(link => {
    if (link.id === 'Thông báo') {
      return { ...link, badge: unreadCount };
    }
    return link;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-card/95 backdrop-blur shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-50 rounded-t-3xl pb-safe md:hidden border-t border-border/50">
      <div className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-2 snap-x snap-mandatory">
        {scrollableLinks.map((link) => {
          const Icon = ICON_MAP[link.id] || LayoutDashboard;
          // Determine active state manually based on location
          const isActive = location.pathname.includes(link.path) || (link.path === '/' && location.pathname === '/');
          
          return (
            <div
              key={link.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(link.path);
              }}
              className={`cursor-pointer flex flex-col items-center justify-center min-w-[76px] flex-shrink-0 gap-1 p-2 rounded-xl transition-all snap-start ${
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {link.badge > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white ring-2 ring-background">
                    {link.badge > 99 ? '99+' : link.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] text-center font-medium leading-tight ${isActive ? 'font-semibold' : ''}`}>
                {link.label}
              </span>
            </div>
          );
        })}
        
        {/* Logout Button */}
        <div
          onClick={handleLogout}
          className="cursor-pointer flex flex-col items-center justify-center min-w-[76px] flex-shrink-0 gap-1 p-2 rounded-xl transition-all snap-start text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] text-center font-medium leading-tight">Đăng xuất</span>
        </div>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
