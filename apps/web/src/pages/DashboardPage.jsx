
import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge.jsx';
import { useExpenseStats } from '@/hooks/useExpenseStats';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { DollarSign, TrendingUp, FileText, UserCircle, Activity } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { motion } from 'framer-motion';

const DashboardPage = () => {
  const { stats, loading } = useExpenseStats();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // Dark mode optimized teal palette
  const COLORS = ['#10b981', '#14b8a6', '#0ea5e9', '#06b6d4', '#0891b2', '#0d9488'];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
            <p className="text-primary font-medium animate-pulse">Đang tải dữ liệu phân tích...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - MediFinance</title>
        <meta name="description" content="Tổng quan chi phí và thống kê phòng khám" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background relative selection:bg-primary/30">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Hero Section */}
            <motion.div variants={itemVariants} className="relative rounded-3xl overflow-hidden bg-card border border-white/5 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
              <img 
                src="https://images.unsplash.com/photo-1675270714610-11a5cadcc7b3" 
                alt="Medical Background"
                className="absolute inset-0 w-full h-full object-cover object-right opacity-30 mix-blend-luminosity"
              />
              <div className="relative z-20 p-8 md:p-12 lg:p-16 flex flex-col justify-center h-full min-h-[300px]">
                <Badge variant="outline" className="w-fit mb-6 bg-primary/10 text-primary border-primary/30 px-3 py-1">
                  <Activity className="w-3 h-3 mr-2" /> Cập nhật theo thời gian thực
                </Badge>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
                  {isAdmin ? 'Quản trị hệ thống' : 'Không gian cá nhân'}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl font-medium">
                  {isAdmin ? 'Kiểm soát dòng tiền, phê duyệt và phân tích chi phí phòng khám một cách toàn diện.' : `Chào mừng trở lại, ${currentUser?.name || 'Nhân sự'}. Theo dõi ngân sách của bạn.`}
                </p>
              </div>
            </motion.div>

            {/* Metrics */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-background px-2 py-1 rounded-md">Toàn thời gian</span>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    {isAdmin ? 'Tổng mức đầu tư' : 'Đã chi tiêu'}
                  </h3>
                  <div className="text-3xl md:text-4xl font-bold text-foreground">
                    {stats.total.toLocaleString('vi-VN')} <span className="text-xl text-primary font-medium">đ</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-secondary" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-background px-2 py-1 rounded-md">Tháng này</span>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    Biến động ngân sách
                  </h3>
                  <div className="text-3xl md:text-4xl font-bold text-foreground">
                    {stats.thisMonth.toLocaleString('vi-VN')} <span className="text-xl text-secondary font-medium">đ</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-500" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-background px-2 py-1 rounded-md">Giao dịch</span>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    Số lượng chứng từ
                  </h3>
                  <div className="text-3xl md:text-4xl font-bold text-foreground">
                    {stats.transactionCount} <span className="text-xl text-blue-500 font-medium">mục</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Charts Area */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-white/5 shadow-xl">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" /> Phân bổ hạng mục
                  </h3>
                  {stats.byCategory.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.byCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth={2}
                          >
                            {stats.byCategory.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => `${value.toLocaleString('vi-VN')} đ`}
                            contentStyle={{ backgroundColor: '#21252b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center flex-col text-muted-foreground">
                      <PieChart className="w-12 h-12 mb-3 opacity-20" />
                      <p>Chưa có dữ liệu thống kê</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {isAdmin ? (
                <Card className="bg-card border-white/5 shadow-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                      <BarChart className="w-5 h-5 text-primary" /> Dòng tiền theo nhân sự
                    </h3>
                    {stats.byStaff.length > 0 ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.byStaff} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" stroke="#888" fontSize={12} tickFormatter={(value) => `${value / 1000000}M`} />
                            <YAxis dataKey="staffId" type="category" width={80} stroke="#888" fontSize={12} />
                            <Tooltip 
                              formatter={(value) => `${value.toLocaleString('vi-VN')} đ`}
                              contentStyle={{ backgroundColor: '#21252b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                              cursor={{fill: 'rgba(255,255,255,0.05)'}}
                            />
                            <Bar dataKey="value" fill="url(#tealGradient)" name="Số tiền" radius={[0, 4, 4, 0]} barSize={24} />
                            <defs>
                              <linearGradient id="tealGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#0ea5e9" />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center flex-col text-muted-foreground">
                        <BarChart className="w-12 h-12 mb-3 opacity-20" />
                        <p>Chưa có dữ liệu thống kê</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-primary/5 border-primary/20 shadow-xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-8 relative z-10">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      <UserCircle className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">Quyền truy cập cá nhân</h3>
                    <p className="text-muted-foreground max-w-sm leading-relaxed">
                      Bạn đang xem dữ liệu báo cáo riêng tư. Để thao tác thêm chứng từ mới, vui lòng di chuyển sang khu vực Nhập liệu.
                    </p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default DashboardPage;
