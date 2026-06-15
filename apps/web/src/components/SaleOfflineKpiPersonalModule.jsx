
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Target, CalendarCheck, Banknote, Percent, AlertCircle } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { getKpiTargetsFromSupabase, syncRevenueRecordsWithSupabase } from '@/services/dataService.js';
import { calculateSaleOfflineCommission } from '@/utils/PayrollCalculationEngine.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#64748b'];

const STATUS_COLORS = {
  'surgery': '#10b981', 'phẫu thuật': '#10b981',
  'deposit': '#3b82f6', 'cọc': '#3b82f6',
  'bong': '#f97316', 'bỏng': '#f97316',
  'pending': '#64748b', 'chờ tư vấn': '#64748b'
};

const getStatusColor = (s) => STATUS_COLORS[(s || '').toLowerCase()] || '#94a3b8';
const getStatusLabel = (s) => {
  const v = (s || '').toLowerCase();
  if (['surgery', 'phẫu thuật'].includes(v)) return 'Phẫu thuật';
  if (['deposit', 'cọc'].includes(v)) return 'Cọc';
  if (['bong', 'bỏng'].includes(v)) return 'Bong';
  if (['pending', 'chờ tư vấn'].includes(v)) return 'Chờ tư vấn';
  return s || 'Khác';
};

const SaleOfflineKpiPersonalModule = ({ currentUser }) => {
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

  const customerAppointments = getStorageItem('customerAppointments', []);

  const currentEmployeeId = currentUser?.employeeId?.trim().toLowerCase();
  
  const assignedKpi = allKpis.find(kpi => 
    kpi.targetType?.trim().toLowerCase() === 'sale_offline' && 
    kpi.employeeId?.trim().toLowerCase() === currentEmployeeId && 
    kpi.month === selectedMonth
  );

  const commData = calculateSaleOfflineCommission(currentUser, selectedMonth);

  const myAppointments = customerAppointments
    .filter(a => a.saleOfflineEmployeeId?.trim().toLowerCase() === currentEmployeeId && a.month === selectedMonth)
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

  const myRevenues = revenueRecords
    .filter(r => r.saleOfflineEmployeeId?.trim().toLowerCase() === currentEmployeeId && r.month === selectedMonth)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalAppointments = myAppointments.length;
  
  let depositCount = 0, surgeryCount = 0, bongCount = 0, pendingCount = 0;
  myAppointments.forEach(a => {
    const s = (a.status || '').toLowerCase();
    if (['cọc', 'deposit'].includes(s)) depositCount++;
    else if (['phẫu thuật', 'surgery'].includes(s)) surgeryCount++;
    else if (['bỏng', 'bong'].includes(s)) bongCount++;
    else pendingCount++;
  });

  const closedAppointments = depositCount + surgeryCount + bongCount;
  const actualCloseRate = totalAppointments > 0 ? (closedAppointments / totalAppointments) * 100 : 0;

  const targetRevenue = Number(assignedKpi?.targetRevenue) || 0;
  const targetCloseRate = Number(assignedKpi?.targetCloseRate) || 0;

  const revenueProgress = targetRevenue > 0 ? (commData.totalRevenue / targetRevenue) * 100 : 0;
  const closeRateProgress = targetCloseRate > 0 ? (actualCloseRate / targetCloseRate) * 100 : 0;

  const pieData = [
    { name: 'Cọc', value: depositCount },
    { name: 'Phẫu thuật', value: surgeryCount },
    { name: 'Bong', value: bongCount },
    { name: 'Chờ/Khác', value: pendingCount },
  ].filter(d => d.value > 0);

  const revenueChartData = [{
    name: 'Doanh thu',
    actual: commData.totalRevenue,
    target: targetRevenue
  }];

  const rateChartData = [{
    name: 'Tỷ lệ chốt',
    actual: actualCloseRate,
    target: targetCloseRate
  }];

  const CustomRevTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-2 rounded shadow">
          {payload.map(p => <p key={p.name} className="text-sm font-medium" style={{color: p.color}}>{p.name}: {formatVND(p.value)}</p>)}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> 
            KPI cá nhân - Sale Offline
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Theo dõi hiệu suất Sale Offline cá nhân</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-purple-200 bg-purple-50/30 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div><p className="text-xs font-semibold text-purple-600 uppercase mb-1">Doanh thu cá nhân</p><p className="text-2xl font-bold tabular-nums text-purple-700">{formatVND(commData.totalRevenue)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50/30 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div><p className="text-xs font-semibold text-purple-600 uppercase mb-1">Doanh thu upsale</p><p className="text-2xl font-bold tabular-nums text-purple-700">{formatVND(commData.totalUpsale)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div><p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Hoa hồng doanh thu</p><p className="text-2xl font-bold tabular-nums text-emerald-700">{formatVND(commData.saleOfflineRevenueCommission)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div><p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Hoa hồng upsale</p><p className="text-2xl font-bold tabular-nums text-emerald-700">{formatVND(commData.saleOfflineUpsaleCommission)}</p></div>
          </CardContent>
        </Card>
        <Card className="border-primary bg-primary/5 shadow-sm md:col-span-2">
          <CardContent className="p-5 flex justify-between items-center">
            <div><p className="text-sm font-bold text-primary uppercase mb-1">Tổng hoa hồng Sale Offline</p><p className="text-4xl font-extrabold tabular-nums text-primary">{formatVND(commData.saleOfflineCommissionTotal)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border bg-card">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">KPI tháng được giao</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {assignedKpi ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground mb-1">KPI Doanh thu mục tiêu</span>
                <span className="text-3xl font-bold tabular-nums text-emerald-600">{formatVND(targetRevenue)}</span>
              </div>
              <div className="flex flex-col md:border-l md:pl-6">
                <span className="text-sm text-muted-foreground mb-1">KPI Tỷ lệ chốt khách mục tiêu</span>
                <span className="text-3xl font-bold tabular-nums text-amber-600">{targetCloseRate}%</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2 bg-muted/20 rounded-lg border border-dashed">
              <AlertCircle className="w-8 h-8 opacity-50" />
              <p>Bạn chưa được giao KPI cho tháng này.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="shadow-sm border-border bg-card col-span-2 lg:col-span-2">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Banknote className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Doanh thu cá nhân</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-purple-600 truncate">{formatVND(commData.totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card col-span-2 lg:col-span-1">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Percent className="w-4 h-4" /></div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Tỷ lệ chốt</p>
            </div>
            <p className="text-xl font-bold tabular-nums text-amber-600">{actualCloseRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-4 flex flex-col justify-center h-full text-center">
            <p className="text-2xl font-bold text-emerald-600">{surgeryCount}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-1">Phẫu thuật</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-4 flex flex-col justify-center h-full text-center">
            <p className="text-2xl font-bold text-blue-600">{depositCount}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-1">Khách cọc</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-4 flex flex-col justify-center h-full text-center">
            <p className="text-2xl font-bold">{totalAppointments}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-1">Tổng khách</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-border lg:col-span-3">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tiến độ hoàn thành KPI</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="font-semibold text-sm">Doanh thu</span>
                  <span className="text-lg font-bold tabular-nums">{revenueProgress.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, revenueProgress)} className="h-2.5" indicatorColor={revenueProgress >= 100 ? 'bg-emerald-500' : 'bg-primary'} />
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Đạt: <strong className="text-foreground">{formatVND(commData.totalRevenue)}</strong></span>
                  <span>Mục tiêu: <strong className="text-foreground">{formatVND(targetRevenue)}</strong></span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="font-semibold text-sm">Tỷ lệ chốt</span>
                  <span className="text-lg font-bold tabular-nums">{closeRateProgress.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, closeRateProgress)} className="h-2.5" indicatorColor={closeRateProgress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'} />
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Đạt: <strong className="text-foreground">{actualCloseRate.toFixed(1)}%</strong></span>
                  <span>Mục tiêu: <strong className="text-foreground">{targetCloseRate}%</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
            <CardTitle className="text-sm font-semibold">Phân loại khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 h-[220px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chưa có lịch hẹn</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
            <CardTitle className="text-sm font-semibold">Doanh thu vs KPI</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={false} />
                <YAxis tickFormatter={(val) => `${val / 1000000}M`} width={50} tick={{fontSize: 10}} />
                <RechartsTooltip content={<CustomRevTooltip />} />
                <Bar dataKey="actual" name="Thực tế" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="target" name="KPI" fill="hsl(var(--muted-foreground)/0.3)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
            <CardTitle className="text-sm font-semibold">Tỷ lệ chốt vs KPI</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rateChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={false} />
                <YAxis tickFormatter={(val) => `${val}%`} width={40} tick={{fontSize: 10}} />
                <RechartsTooltip />
                <Bar dataKey="actual" name="Thực tế" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="target" name="KPI" fill="hsl(var(--muted-foreground)/0.3)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 pt-4">
        <h3 className="text-xl font-bold tracking-tight">Chi tiết số liệu</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-500" /> Lịch hẹn của tôi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0">
                  <TableRow>
                    <TableHead>Ngày hẹn</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAppointments.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Chưa có lịch hẹn.</TableCell></TableRow>
                  ) : (
                    myAppointments.map((a, idx) => (
                      <TableRow key={a.id || idx}>
                        <TableCell>{a.appointmentDate ? format(parseISO(a.appointmentDate), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-medium">{a.customerName}</TableCell>
                        <TableCell className="text-center">
                          <Badge style={{ backgroundColor: getStatusColor(a.status), color: '#fff' }} className="border-transparent font-medium">
                            {getStatusLabel(a.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="w-4 h-4 text-purple-500" /> Doanh thu được gán
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0">
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRevenues.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Chưa có doanh thu.</TableCell></TableRow>
                  ) : (
                    myRevenues.map((r, idx) => (
                      <TableRow key={r.id || idx}>
                        <TableCell>{r.createdAt ? format(new Date(r.createdAt), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="text-sm">{r.serviceNeed || r.service || r.type || '-'}</TableCell>
                        <TableCell className="text-right font-bold text-purple-600">{formatVND(r.revenueAmount || r.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SaleOfflineKpiPersonalModule;
