
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile.jsx';

const COLORS = ['#0f766e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#6366f1', '#ec4899'];

const ExpenseStatsCharts = ({ claims, summaries }) => {
  const isMobile = useIsMobile();

  // Filter out deleted claims for charts
  const activeClaims = claims.filter(c => !c.isDeleted);

  // Prepare data for Bar Chart (Top 10 employees by advance)
  const barData = [...summaries]
    .sort((a, b) => b.totalAdvance - a.totalAdvance)
    .slice(0, 10)
    .map(s => ({
      name: s.employeeName.split(' ').pop(), // Just use first name for chart
      fullName: s.employeeName, // Keep full name for tooltip
      'Tạm ứng': s.totalAdvance,
      'Hoàn ứng': s.totalReimbursement
    }));

  // Prepare data for Pie Chart (Expenses by category)
  const categoryData = activeClaims
    .filter(c => c.transactionType === 'advance_expense' && c.status !== 'rejected')
    .reduce((acc, claim) => {
      const existing = acc.find(item => item.name === claim.category);
      if (existing) {
        existing.value += Number(claim.amount);
      } else {
        acc.push({ name: claim.category, value: Number(claim.amount) });
      }
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  // Prepare data for Line Chart (Daily cash flow)
  const dailyDataMap = activeClaims
    .filter(c => c.status !== 'rejected')
    .reduce((acc, claim) => {
      const date = claim.expenseDate;
      if (!acc[date]) {
        acc[date] = { date, 'Tạm ứng': 0, 'Hoàn ứng': 0 };
      }
      if (claim.transactionType === 'advance_expense') {
        acc[date]['Tạm ứng'] += Number(claim.amount);
      } else {
        acc[date]['Hoàn ứng'] += Number(claim.amount);
      }
      return acc;
    }, {});

  const lineData = Object.values(dailyDataMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  const formatCurrency = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-border shadow-lg rounded-xl text-sm">
          <p className="font-medium text-foreground mb-2">{data.fullName || label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="text-muted-foreground">{entry.name}:</span>
              </span>
              <span className="font-semibold" style={{ color: entry.color }}>
                {entry.value.toLocaleString('vi-VN')} đ
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="shadow-sm border-border rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[length:var(--mobile-card-title,16px)] sm:text-base font-semibold">
              Tạm ứng vs Hoàn ứng theo nhân sự
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 sm:pt-0">
            <div className={isMobile ? "h-[450px] w-full" : "h-[300px] w-full"}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={barData} 
                  layout={isMobile ? "vertical" : "horizontal"}
                  margin={{ top: 20, right: isMobile ? 20 : 30, left: isMobile ? 0 : 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={!isMobile} vertical={isMobile} stroke="#e5e7eb" />
                  
                  {isMobile ? (
                    <>
                      <XAxis type="number" tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={75} />
                    </>
                  ) : (
                    <>
                      <XAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis type="number" tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    </>
                  )}
                  
                  <Tooltip cursor={{ fill: '#f3f4f6' }} content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Tạm ứng" fill="#f59e0b" radius={isMobile ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={isMobile ? 20 : 40} />
                  <Bar dataKey="Hoàn ứng" fill="#10b981" radius={isMobile ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={isMobile ? 20 : 40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[length:var(--mobile-card-title,16px)] sm:text-base font-semibold">
              Phân bổ danh mục chi tiêu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 sm:pt-0">
            <div className={isMobile ? "h-[380px] w-full" : "h-[300px] w-full"}>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy={isMobile ? "40%" : "50%"}
                      innerRadius={isMobile ? 55 : 60}
                      outerRadius={isMobile ? 90 : 100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `${value.toLocaleString('vi-VN')} đ`}
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    />
                    <Legend 
                      layout={isMobile ? "horizontal" : "vertical"} 
                      verticalAlign={isMobile ? "bottom" : "middle"} 
                      align={isMobile ? "center" : "right"} 
                      wrapperStyle={{ 
                        fontSize: '12px', 
                        paddingTop: isMobile ? '20px' : '0',
                        width: '100%' 
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Chưa có dữ liệu chi tiêu
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border rounded-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-[length:var(--mobile-card-title,16px)] sm:text-base font-semibold">
            Lưu chuyển dòng tiền theo ngày
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 sm:pt-0">
          <div className="h-[300px] w-full">
            {lineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 20, right: isMobile ? 10 : 30, left: isMobile ? 0 : 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip 
                    formatter={(value) => `${value.toLocaleString('vi-VN')} đ`}
                    labelFormatter={(label) => {
                      const d = new Date(label);
                      return `Ngày ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                    }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="Tạm ứng" stroke="#f59e0b" strokeWidth={3} dot={{ r: isMobile ? 0 : 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Hoàn ứng" stroke="#10b981" strokeWidth={3} dot={{ r: isMobile ? 0 : 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Chưa có dữ liệu giao dịch
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseStatsCharts;
