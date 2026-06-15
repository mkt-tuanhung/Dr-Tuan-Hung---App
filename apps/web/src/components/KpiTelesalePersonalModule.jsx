
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { getPagePhoneAssignments } from '@/utils/userStorage.js';
import { getCustomerAppointments } from '@/utils/telesaleKpiUtils.js';
import { getKpiTargetsFromSupabase, syncRevenueRecordsWithSupabase } from '@/services/dataService.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { PhoneCall, Target, Coins, CalendarCheck, Banknote, Percent, AlertCircle } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const STATUS_COLORS = {
  'surgery': '#10b981', 'phẫu thuật': '#10b981',
  'deposit': '#3b82f6', 'cọc': '#3b82f6',
  'bong': '#f97316', 'bỏng': '#f97316',
  'pending': '#64748b', 'chờ tư vấn': '#64748b'
};

const getStatusColor = (status) => STATUS_COLORS[(status || '').toLowerCase()] || '#94a3b8';

const getStatusLabel = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'surgery' || s === 'phẫu thuật') return 'Phẫu thuật';
  if (s === 'deposit' || s === 'cọc') return 'Cọc';
  if (s === 'bong' || s === 'bỏng') return 'Bong';
  if (s === 'pending' || s === 'chờ tư vấn') return 'Chờ tư vấn';
  return status || 'Khác';
};

const KpiTelesalePersonalModule = () => {
  const { user: currentUser } = useAuth();
  const position = currentUser?.departmentPosition?.trim().toLowerCase();
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [allKpis, setAllKpis] = useState([]);
  const [revenueRecords, setRevenueRecords] = useState([]);

  const loadData = useCallback(async () => {
    const targets = await getKpiTargetsFromSupabase();
    setAllKpis(targets);
    const revs = await syncRevenueRecordsWithSupabase();
    setRevenueRecords(revs);
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('supabase-data-updated', loadData);
    return () => window.removeEventListener('supabase-data-updated', loadData);
  }, [loadData]);

  if (position !== "telesale") {
    return <div className="p-6 text-center text-rose-500 font-medium">Không có quyền truy cập</div>;
  }

  const currentEmployeeId = currentUser?.employeeId?.trim().toLowerCase() || '';

  const assignedKpi = allKpis.find(kpi =>
    (kpi.targetType?.trim().toLowerCase() === "telesale" || kpi.targetType?.trim().toLowerCase() === "tele") &&
    kpi.employeeId?.trim().toLowerCase() === currentEmployeeId &&
    kpi.month === selectedMonth
  );

  const phoneAssignments = getPagePhoneAssignments().filter(assignment =>
    assignment.telesaleEmployeeId?.trim().toLowerCase() === currentEmployeeId &&
    assignment.month === selectedMonth
  ).sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
  
  const totalPhones = phoneAssignments.reduce((sum, assignment) => sum + (Number(assignment.phoneCount) || 0), 0);

  const myAppointments = getCustomerAppointments().filter(appointment =>
    appointment.telesaleEmployeeId?.trim().toLowerCase() === currentEmployeeId &&
    appointment.month === selectedMonth
  ).sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
  
  const totalAppointments = myAppointments.length;

  const appointmentsByStatus = {
    pending: myAppointments.filter(a => { const s = (a.status||'').toLowerCase(); return s === "pending" || s === "chờ tư vấn"; }).length,
    deposit: myAppointments.filter(a => { const s = (a.status||'').toLowerCase(); return s === "deposit" || s === "cọc"; }).length,
    bong: myAppointments.filter(a => { const s = (a.status||'').toLowerCase(); return s === "bong" || s === "bỏng"; }).length,
    surgery: myAppointments.filter(a => { const s = (a.status||'').toLowerCase(); return s === "surgery" || s === "phẫu thuật"; }).length
  };

  const myRevenues = revenueRecords.filter(record =>
    record.telesaleEmployeeId?.trim().toLowerCase() === currentEmployeeId &&
    record.month === selectedMonth
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const totalRevenue = myRevenues.reduce((sum, record) => sum + (Number(record.revenueAmount || record.amount) || 0), 0);

  const targetAppointments = Number(assignedKpi?.targetAppointments) || 0;
  const targetRevenue = Number(assignedKpi?.targetRevenue) || 0;
  const targetCloseRate = Number(assignedKpi?.targetCloseRate) || 0;

  const closeRate = totalPhones > 0 ? (totalAppointments / totalPhones) * 100 : 0;
  const appointmentProgress = targetAppointments > 0 ? (totalAppointments / targetAppointments) * 100 : 0;
  const revenueProgress = targetRevenue > 0 ? (totalRevenue / targetRevenue) * 100 : 0;

  const missingAppointments = Math.max(0, targetAppointments - totalAppointments);
  const missingRevenue = Math.max(0, targetRevenue - totalRevenue);

  const surgeryCommission = 500000 * appointmentsByStatus.surgery;
  const depositCommission = 250000 * appointmentsByStatus.deposit;
  const bongCommission = 250000 * appointmentsByStatus.bong;
  const appointmentCommission = surgeryCommission + depositCommission + bongCommission;

  let revenueCommissionRate = 0;
  if (totalRevenue >= 1500000000) revenueCommissionRate = 0.015;
  else if (totalRevenue >= 1000000000) revenueCommissionRate = 0.015;
  else if (totalRevenue >= 500000000) revenueCommissionRate = 0.01;
  else if (totalRevenue > 0) revenueCommissionRate = 0.005;

  const revenueCommission = totalRevenue * revenueCommissionRate;
  const totalCommission = appointmentCommission + revenueCommission;

  const barChartData = [{
    name: `Tháng ${selectedMonth.split('-')[1]}`,
    'SĐT nhận': totalPhones,
    'Lịch hẹn': totalAppointments
  }];

  const pieChartData = Object.entries(appointmentsByStatus)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({ name: getStatusLabel(key), value }));

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> 
            KPI cá nhân - Telesale
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Theo dõi hiệu suất và hoa hồng của bạn</p>
        </div>
        <div className="flex items-center gap-3 bg-card p-2 rounded-xl shadow-sm border border-border">
          <Input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-[160px] bg-background"
          />
        </div>
      </div>

      <Card className="shadow-sm border-border bg-card">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">KPI tháng được giao</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {assignedKpi ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground mb-1">KPI Lịch hẹn</span>
                <span className="text-2xl font-bold text-emerald-600">{targetAppointments}</span>
              </div>
              <div className="flex flex-col border-l pl-6">
                <span className="text-sm text-muted-foreground mb-1">KPI Doanh thu</span>
                <span className="text-2xl font-bold text-purple-600">{formatVND(targetRevenue)}</span>
              </div>
              <div className="flex flex-col border-l pl-6">
                <span className="text-sm text-muted-foreground mb-1">KPI Tỷ lệ chốt hẹn</span>
                <span className="text-2xl font-bold text-amber-600">{targetCloseRate}%</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 opacity-50" />
              <p>Bạn chưa được giao KPI cho tháng này.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PhoneCall className="w-4 h-4" /></div>
              <p className="text-sm text-muted-foreground font-medium uppercase">Số điện thoại nhận</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-blue-600">{totalPhones}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CalendarCheck className="w-4 h-4" /></div>
              <p className="text-sm text-muted-foreground font-medium uppercase">Tổng lịch hẹn</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-emerald-600">{totalAppointments}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Percent className="w-4 h-4" /></div>
              <p className="text-sm text-muted-foreground font-medium uppercase">Tỷ lệ chốt hẹn</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-amber-600">{closeRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-muted/10">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground font-medium uppercase mb-2">KPI lịch hẹn</p>
            <p className="text-2xl font-bold tabular-nums">{targetAppointments}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-muted/10">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground font-medium uppercase mb-2">KPI doanh thu</p>
            <p className="text-2xl font-bold tabular-nums truncate" title={formatVND(targetRevenue)}>{formatVND(targetRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-muted/10">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground font-medium uppercase mb-2">KPI tỷ lệ chốt hẹn</p>
            <p className="text-2xl font-bold tabular-nums">{targetCloseRate}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground font-medium uppercase mb-2">Lịch hẹn còn thiếu</p>
            <p className={`text-2xl font-bold tabular-nums ${missingAppointments > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {missingAppointments}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground font-medium uppercase mb-2">Doanh thu còn thiếu</p>
            <p className={`text-2xl font-bold tabular-nums truncate ${missingRevenue > 0 ? 'text-rose-500' : 'text-emerald-500'}`} title={formatVND(missingRevenue)}>
              {formatVND(missingRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-none bg-gradient-to-br from-indigo-500 to-purple-600 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Coins className="w-24 h-24" /></div>
          <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
            <p className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Tổng hoa hồng</p>
            <p className="text-4xl font-extrabold tabular-nums tracking-tight">{formatVND(totalCommission)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-1 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tiến độ hoàn thành KPI</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="font-semibold text-sm">Tiến độ KPI lịch hẹn</span>
                <span className="text-lg font-bold tabular-nums">{appointmentProgress.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(100, appointmentProgress)} className="h-2.5" indicatorColor={appointmentProgress >= 100 ? 'bg-emerald-500' : appointmentProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'} />
              <div className="text-xs text-muted-foreground text-right">{totalAppointments} / {targetAppointments}</div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="font-semibold text-sm">Tiến độ KPI doanh thu</span>
                <span className="text-lg font-bold tabular-nums">{revenueProgress.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(100, revenueProgress)} className="h-2.5" indicatorColor={revenueProgress >= 100 ? 'bg-emerald-500' : revenueProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'} />
              <div className="text-xs text-muted-foreground text-right">{formatVND(totalRevenue)} / {formatVND(targetRevenue)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-1 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">SĐT vs Lịch hẹn</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="SĐT nhận" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="Lịch hẹn" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-1 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Trạng thái lịch hẹn</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[250px] flex items-center justify-center">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground">Chưa có dữ liệu lịch hẹn</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8 pt-4">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-500" /> Số điện thoại nhận từ Trực page
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Ngày giao</TableHead>
                  <TableHead className="text-center">Số lượng</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneAssignments.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Chưa có số điện thoại được phân bổ.</TableCell></TableRow>
                ) : (
                  phoneAssignments.map((a, idx) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{format(parseISO(a.date || a.createdAt), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-center font-bold tabular-nums text-blue-600">{a.phoneCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={a.note}>{a.note || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-500" /> Lịch hẹn của tôi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Ngày hẹn</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myAppointments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chưa có lịch hẹn.</TableCell></TableRow>
                ) : (
                  myAppointments.map((a, idx) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{format(parseISO(a.appointmentDate), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-semibold">{a.customerName}</TableCell>
                      <TableCell className="text-center"><Badge style={{ backgroundColor: getStatusColor(a.status), color: '#fff' }} className="border-transparent font-medium">{getStatusLabel(a.status)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={a.note}>{a.note || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Banknote className="w-4 h-4 text-purple-500" /> Doanh thu được gán
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Loại doanh thu</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRevenues.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chưa có doanh thu được gán.</TableCell></TableRow>
                ) : (
                  myRevenues.map((r, idx) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{format(new Date(r.createdAt), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{r.serviceNeed || r.service || r.type || '-'}</TableCell>
                      <TableCell className="text-right font-bold text-purple-600 tabular-nums">{formatVND(r.revenueAmount || r.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={r.note}>{r.note || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiTelesalePersonalModule;
