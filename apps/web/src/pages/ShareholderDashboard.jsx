
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, LayoutDashboard, TrendingUp, TrendingDown, Activity, Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';

// Helper function cho format tiền VND đầy đủ
const formatFullVND = (amount) => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '0đ';
  return `${new Intl.NumberFormat('vi-VN').format(Number(amount))}đ`;
};

const ShareholderDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Tổng quan');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { id: 'Tổng quan', icon: LayoutDashboard },
    { id: 'Báo cáo doanh thu', icon: TrendingUp },
    { id: 'Báo cáo chi phí', icon: TrendingDown },
    { id: 'Dòng tiền', icon: Activity },
  ];

  const stats = [
    { title: 'Doanh thu tháng', value: formatFullVND(150000000), desc: 'Tháng hiện tại', icon: TrendingUp, color: 'text-emerald-500' },
    { title: 'Chi phí tháng', value: formatFullVND(50000000), desc: 'Tháng hiện tại', icon: TrendingDown, color: 'text-rose-500' },
    { title: 'Dòng tiền ròng', value: formatFullVND(100000000), desc: 'Tháng hiện tại', icon: Activity, color: 'text-blue-500' },
    { title: 'Vốn lưu động', value: formatFullVND(500000000), desc: 'Tồn quỹ', icon: Activity, color: 'text-purple-500' },
  ];

  return (
    <>
      <Helmet>
        <title>Shareholder Dashboard - Dr Tuấn Hùng</title>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col md:flex-row">
        {/* Mobile Header */}
        <div className="md:hidden bg-white/70 backdrop-blur-xl border-b border-input shadow-[0_10px_30px_rgba(15,118,110,0.08)] p-4 flex items-center justify-between sticky top-0 z-50">
          <span className="font-bold text-primary">Dr Tuấn Hùng</span>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Sidebar */}
        <aside className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-white/70 backdrop-blur-xl border-r border-input rounded-r-3xl shadow-[0_20px_60px_rgba(15,118,110,0.08)] flex-shrink-0 fixed md:sticky top-[73px] md:top-0 h-[calc(100vh-73px)] md:h-screen overflow-y-auto z-40`}>
          <div className="p-6 hidden md:block">
            <h2 className="text-xl font-bold text-primary">Dr Tuấn Hùng</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Shareholder Portal</p>
          </div>
          <nav className="px-4 pb-6 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === item.id 
                    ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-2xl shadow-md shadow-primary/20' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.id}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-background via-white to-accent/5">
          <header className="bg-white/70 backdrop-blur-xl border-b border-input shadow-[0_10px_30px_rgba(15,118,110,0.08)] px-6 py-4 items-center justify-between sticky top-0 z-30 hidden md:flex">
            <h1 className="text-xl font-semibold">{activeTab}</h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">Xin chào, {user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
              </Button>
            </div>
          </header>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* Mobile Welcome */}
            <div className="md:hidden mb-6 flex items-center justify-between bg-white/70 backdrop-blur-xl border border-input shadow-[0_10px_30px_rgba(15,118,110,0.08)] p-4 rounded-xl">
              <div>
                <p className="text-sm font-medium">Xin chào, {user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'Tổng quan' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {stats.map((stat, idx) => (
                    <Card key={idx} className="border-border shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </CardTitle>
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                        <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                    <Activity className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">{activeTab}</h2>
                  <p className="text-muted-foreground">Module này sẽ được xây dựng ở bước sau</p>
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    </>
  );
};

export default ShareholderDashboard;
