
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getUsers } from '@/utils/userStorage.js';
import { format, parseISO, isValid } from 'date-fns';

const COLORS = { pending: '#f59e0b', bong: '#f43f5e', deposit: '#3b82f6', surgery: '#10b981' };
const STATUS_LABELS = { pending: 'Chờ tư vấn', bong: 'Bong', deposit: 'Cọc', surgery: 'Phẫu thuật' };

const AppointmentCharts = ({ appointments }) => {
  const users = useMemo(() => getUsers(), []);

  const statusData = useMemo(() => {
    const counts = { pending: 0, bong: 0, deposit: 0, surgery: 0 };
    appointments.forEach(app => { 
      if (counts[app.status] !== undefined) {
        counts[app.status]++;
      } else {
        counts['pending'] = (counts['pending'] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ 
        name: STATUS_LABELS[k] || 'Khác', 
        value: v, 
        color: COLORS[k] || COLORS.pending 
      }));
  }, [appointments]);

  const dailyData = useMemo(() => {
    const days = {};
    appointments.forEach(app => {
      if (!app.appointmentDate) return;
      try {
        const parsedDate = parseISO(app.appointmentDate);
        if (!isValid(parsedDate)) return;
        const day = format(parsedDate, 'dd/MM');
        if (!days[day]) days[day] = { name: day, total: 0, surgery: 0 };
        days[day].total++;
        if (app.status === 'surgery') days[day].surgery++;
      } catch (e) {
        // Ignore parsing errors for invalid dates
      }
    });
    return Object.values(days).sort((a, b) => {
      const [d1, m1] = a.name.split('/'); 
      const [d2, m2] = b.name.split('/');
      const year = new Date().getFullYear();
      return new Date(year, m1 - 1, d1) - new Date(year, m2 - 1, d2);
    });
  }, [appointments]);

  const telesaleData = useMemo(() => {
    const telesales = {};
    appointments.forEach(app => {
      if (!app.telesaleEmployeeId) return;
      if (!telesales[app.telesaleEmployeeId]) {
        const user = users.find(u => u.id === app.telesaleEmployeeId || u.employeeId === app.telesaleEmployeeId);
        telesales[app.telesaleEmployeeId] = { 
          name: user ? (user.fullName.split(' ').pop() || user.fullName) : 'Chưa xác định', 
          total: 0, 
          success: 0 
        };
      }
      telesales[app.telesaleEmployeeId].total++;
      if (app.status === 'surgery' || app.status === 'deposit') {
        telesales[app.telesaleEmployeeId].success++;
      }
    });
    return Object.values(telesales).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [appointments, users]);

  if (!appointments || appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] w-full bg-muted/20 border border-dashed border-border rounded-xl">
        <p className="text-muted-foreground font-medium">Chưa có dữ liệu biểu đồ.</p>
        <p className="text-sm text-muted-foreground mt-1">Thêm lịch hẹn để xem thống kê</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="pb-2 bg-muted/30 border-b border-border">
          <CardTitle className="text-base font-semibold">Tỷ lệ trạng thái</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-6">
          <div className="h-[280px] w-full">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={statusData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={65} 
                    outerRadius={95} 
                    paddingAngle={4} 
                    dataKey="value"
                  >
                    {statusData.map((e, i) => <Cell key={`cell-${i}`} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center"><p className="text-sm text-muted-foreground">Chưa có dữ liệu</p></div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm border-border lg:col-span-2 overflow-hidden">
        <CardHeader className="pb-2 bg-muted/30 border-b border-border">
          <CardTitle className="text-base font-semibold">Biểu đồ lịch hẹn theo ngày</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-6">
          <div className="h-[280px] w-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} 
                  />
                  <Line type="monotone" dataKey="total" name="Tổng lịch" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="surgery" name="Phẫu thuật" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center"><p className="text-sm text-muted-foreground">Chưa có dữ liệu</p></div>
            )}
          </div>
        </CardContent>
      </Card>

      {telesaleData.length > 0 && (
        <Card className="shadow-sm border-border lg:col-span-3 overflow-hidden">
          <CardHeader className="pb-2 bg-muted/30 border-b border-border">
            <CardTitle className="text-base font-semibold">Hiệu suất Telesale</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={telesaleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} 
                  />
                  <Bar dataKey="total" name="Tổng hẹn" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="success" name="Thành công (Cọc/PT)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AppointmentCharts;
