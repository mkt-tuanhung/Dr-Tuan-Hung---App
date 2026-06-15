
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { PhoneCall, Target, CalendarCheck, Banknote, Percent, AlertCircle } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { getKpiTargetByEmployeeAndMonth, getRevenueRecords } from '@/utils/userStorage.js';
import { calculateTotalPhonesReceivedFromPageAssignments, getPagePhoneAssignmentsForTelesale } from '@/utils/telesaleKpiUtils.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#64748b'];

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

const TelesaleKpiPersonalModule = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    normalizeKpiTargets();
  }, []);

  const kpiTargets = getStorageItem('kpiTargets', []);
  const customerAppointments = getStorageItem('customerAppointments', []);
  const revenueRecords = getRevenueRecords(true);

  const currentEmployeeId = currentUser?.employeeId?.trim().toLowerCase();
  
  const assignedKpi = kpiTargets.find(kpi => 
    kpi.targetType?.trim().toLowerCase() === 'telesale' && 
    kpi.employeeId?.trim().toLowerCase() === currentEmployeeId && 
    kpi.month === selectedMonth
  );

  const myAssignments = getPagePhoneAssignmentsForTelesale(currentEmployeeId, selectedMonth)
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  const myAppointments = customerAppointments
    .filter(a => a.telesaleEmployeeId?.trim().toLowerCase() === currentEmployeeId && a.month === selectedMonth)
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

  const myRevenues = revenueRecords
    .filter(r => r.telesaleEmployeeId?.trim().toLowerCase() === currentEmployeeId && r.month === selectedMonth)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalPhonesReceived = calculateTotalPhonesReceivedFromPageAssignments(currentEmployeeId, selectedMonth);
  const totalAppointments = myAppointments.length;
  const totalRevenue = myRevenues.reduce((sum, r) => sum + (Number(r.revenueAmount || r.amount) || 0), 0);
  
  const actualCloseRate = totalPhonesReceived > 0 ? (totalAppointments / totalPhonesReceived) * 100 : 0;

  const targetRevenue = Number(assignedKpi?.targetRevenue) || 0;
  const targetCloseRate = Number(assignedKpi?.targetCloseRate) || 0;

  const revenueProgress = targetRevenue > 0 ? (totalRevenue / targetRevenue) * 100 : 0;
  const closeRateProgress = targetCloseRate > 0 ? (actualCloseRate / targetCloseRate) * 100 : 0;

  const telesaleKpiCount = kpiTargets.filter(k => k.targetType?.trim().toLowerCase() === 'telesale').length;

  const barChartData = [{
    name: 'SĐT / Hẹn',
    phones: totalPhonesReceived,
    appointments: totalAppointments
  }];

  let surgeryC = 0, depositC = 0, bongC = 0, pendingC = 0;
  myAppointments.forEach(a => {
    const s = (a.status || '').toLowerCase();
    if (['surgery', 'phẫu thuật'].includes(s)) surgeryC++;
    else if (['deposit', 'cọc'].includes(s)) depositC++;
    else if (['bong', 'bỏng'].includes(s)) bongC++;
    else pendingC++;
  });

  const pieData = [
    { name: 'Phẫu thuật', value: surgeryC },
    { name: 'Cọc', value: depositC },
    { name: 'Bong', value: bongC },
    { name: 'Khác', value: pendingC },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> 
            KPI cá nhân - Telesale
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Theo dõi hiệu suất cá nhân</p>
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

      <div className="mt-4 p-5 border border-slate-700 bg-slate-900 text-green-400 font-mono text-xs rounded-lg shadow-xl relative">
        <h4 className="font-bold border-b border-slate-700 pb-3 mb-3 text-green-300 text-sm uppercase flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" /> DEBUG: KẾT QUẢ TÌM KIẾM KPI
        </h4>
        <div className="space-y-1">
          <p>employeeId: <span className="text-white font-semibold">{currentEmployeeId}</span></p>
          <p>selectedMonth: <span className="text-white font-semibold">{selectedMonth}</span></p>
          <p>Tổng số KPI targetType='telesale' trong DB: <span className="text-white font-semibold">{telesaleKpiCount}</span></p>
          <p className="mt-2">Trạng thái tìm thấy assignedKpi: <span className={`font-bold px-2 py-0.5 rounded ${assignedKpi ? 'bg-green-900 text-green-300' : 'bg-rose-900 text-rose-300'}`}>{assignedKpi ? "Có" : "Không"}</span></p>
          {assignedKpi && (
            <div className="mt-2 pl-4 border-l-2 border-slate-700">
              <p>Chi tiết KPI tìm thấy:</p>
              <p>- targetType: {assignedKpi.targetType}</p>
              <p>- month: {assignedKpi.month}</p>
              <p>- employeeId: {assignedKpi.employeeId}</p>
            </div>
          )}
        </div>
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
                <span className="text-3xl font-bold text-emerald-600">{formatVND(targetRevenue)}</span>
              </div>
              <div className="flex flex-col md:border-l md:pl-6">
                <span className="text-sm text-muted-foreground mb-1">KPI Tỷ lệ chốt hẹn mục tiêu</span>
                <span className="text-3xl font-bold text-amber-600">{targetCloseRate}%</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Banknote className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Doanh thu chốt được</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-purple-600 truncate" title={formatVND(totalRevenue)}>{formatVND(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Percent className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tỷ lệ chốt hẹn</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{actualCloseRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PhoneCall className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">SĐT đã tiếp nhận</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{totalPhonesReceived}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CalendarCheck className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng lịch hẹn</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{totalAppointments}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tiến độ hoàn thành KPI</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="font-semibold text-sm">Doanh thu</span>
                <span className="text-lg font-bold tabular-nums">{revenueProgress.toFixed(1)}%</span>
              </div>
              <Progress 
                value={Math.min(100, revenueProgress)} 
                className="h-2.5"
                indicatorColor={revenueProgress >= 100 ? 'bg-emerald-500' : 'bg-primary'}
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Đạt: <strong className="text-foreground">{formatVND(totalRevenue)}</strong></span>
                <span>Mục tiêu: <strong className="text-foreground">{formatVND(targetRevenue)}</strong></span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="font-semibold text-sm">Tỷ lệ chốt hẹn</span>
                <span className="text-lg font-bold tabular-nums">{closeRateProgress.toFixed(1)}%</span>
              </div>
              <Progress 
                value={Math.min(100, closeRateProgress)} 
                className="h-2.5"
                indicatorColor={closeRateProgress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Đạt: <strong className="text-foreground">{actualCloseRate.toFixed(1)}%</strong></span>
                <span>Mục tiêu: <strong className="text-foreground">{targetCloseRate}%</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Phân tích Số điện thoại & Lịch hẹn</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[250px] flex gap-4">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <RechartsTooltip />
                  <Bar dataKey="phones" name="SĐT tiếp nhận" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="appointments" name="Tổng hẹn" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 h-full">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chưa có lịch hẹn</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold tracking-tight">Chi tiết số liệu</h3>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-500" /> SĐT nhận từ Trực page
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto max-h-[300px]">
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Ngày giao</TableHead>
                  <TableHead className="text-center">Số lượng</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myAssignments.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Chưa có dữ liệu.</TableCell></TableRow>
                ) : (
                  myAssignments.map((a, idx) => (
                    <TableRow key={a.id || idx}>
                      <TableCell className="text-center tabular-nums">{idx + 1}</TableCell>
                      <TableCell>{a.date ? format(parseISO(a.date), 'dd/MM/yyyy') : format(new Date(a.createdAt), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-center font-bold text-blue-600">{a.phoneCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.note || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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

export default TelesaleKpiPersonalModule;
