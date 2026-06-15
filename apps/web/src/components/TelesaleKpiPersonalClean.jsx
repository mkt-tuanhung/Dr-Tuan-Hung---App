
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { PhoneCall, Target, Coins, CalendarCheck, Banknote, Percent, AlertCircle } from 'lucide-react';
import { getKpiTargetByEmployeeAndMonth, getRevenueRecords } from '@/utils/userStorage.js';
import { formatVND } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const STATUS_COLORS = {
  'surgery': '#10b981', 'phẫu thuật': '#10b981', 'phau thuat': '#10b981',
  'deposit': '#3b82f6', 'cọc': '#3b82f6', 'coc': '#3b82f6',
  'bong': '#f97316', 'bóng': '#f97316',
  'pending': '#64748b', 'chờ tư vấn': '#64748b'
};

const normalizeStr = (val) => String(val || '').trim().toLowerCase();

const getStatusColor = (status) => STATUS_COLORS[normalizeStr(status)] || '#94a3b8';
const getStatusLabel = (status) => {
  const s = normalizeStr(status);
  if (['surgery', 'phẫu thuật', 'phau thuat'].includes(s)) return 'Phẫu thuật';
  if (['deposit', 'cọc', 'coc'].includes(s)) return 'Cọc';
  if (['bong', 'bóng'].includes(s)) return 'Bong';
  if (['pending', 'chờ tư vấn'].includes(s)) return 'Chờ tư vấn';
  return status || 'Khác';
};

export const calculateTelesaleKPI = (user, month) => {
  const customerAppointments = getStorageItem('customerAppointments', []);
  const revenueRecords = getRevenueRecords(true);

  const uId = normalizeStr(user.id);
  const uEmpId = normalizeStr(user.employeeId);

  const myAppointments = customerAppointments.filter(a => {
    const tId = normalizeStr(a.telesaleEmployeeId);
    const isMatch = (tId === uId && uId !== '') || (tId === uEmpId && uEmpId !== '');
    const aMonth = String(a.appointmentDate || a.date || a.createdAt || '').substring(0, 7);
    return isMatch && aMonth === month;
  });

  let surgeryCount = 0, depositCount = 0, bongCount = 0;
  myAppointments.forEach(a => {
    const s = normalizeStr(a.evaluationStatus || a.status);
    if (['surgery', 'phẫu thuật', 'phau thuat'].includes(s)) surgeryCount++;
    else if (['deposit', 'cọc', 'coc'].includes(s)) depositCount++;
    else if (['bong', 'bóng'].includes(s)) bongCount++;
  });

  const myRevenues = revenueRecords.filter(r => {
    const tId = normalizeStr(r.telesaleEmployeeId);
    const isMatch = (tId === uId && uId !== '') || (tId === uEmpId && uEmpId !== '');
    const rMonth = String(r.revenueDate || r.date || r.createdAt || '').substring(0, 7);
    return isMatch && rMonth === month;
  });

  const totalRevenue = myRevenues.reduce((sum, r) => sum + (Number(r.revenueAmount || r.amount) || 0), 0);

  return {
    totalAppointments: myAppointments.length,
    surgeryCount,
    depositCount,
    bongCount,
    totalRevenue,
    myAppointments,
    myRevenues
  };
};

const TelesaleKpiPersonalClean = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const kpiTargets = getStorageItem('kpiTargets', []);
  const pagePhoneAssignments = getStorageItem('pagePhoneAssignments', []);

  const kpiData = calculateTelesaleKPI(currentUser, selectedMonth);

  const uId = normalizeStr(currentUser.id);
  const uEmpId = normalizeStr(currentUser.employeeId);

  const assignedKpi = kpiTargets.find(kpi => {
    const kType = normalizeStr(kpi.targetType);
    const kEmpId = normalizeStr(kpi.employeeId);
    const isMatch = (kEmpId === uId && uId !== '') || (kEmpId === uEmpId && uEmpId !== '');
    return kType === 'telesale' && isMatch && kpi.month === selectedMonth;
  });

  const myAssignments = pagePhoneAssignments
    .filter(a => {
      const aTId = normalizeStr(a.telesaleEmployeeId);
      const isMatch = (aTId === uId && uId !== '') || (aTId === uEmpId && uEmpId !== '');
      const aMonth = String(a.date || a.createdAt || '').substring(0, 7);
      return isMatch && aMonth === selectedMonth;
    })
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  const totalPhonesReceived = myAssignments.reduce((sum, a) => sum + Number(a.phoneCount || 0), 0);
  const actualCloseRate = totalPhonesReceived > 0 ? (kpiData.totalAppointments / totalPhonesReceived) * 100 : 0;

  const targetAppointments = Number(assignedKpi?.targetAppointments) || 0;
  const targetRevenue = Number(assignedKpi?.targetRevenue) || 0;
  const targetCloseRate = Number(assignedKpi?.targetCloseRate) || 0;

  const appointmentProgress = targetAppointments > 0 ? (kpiData.totalAppointments / targetAppointments) * 100 : 0;
  const revenueProgress = targetRevenue > 0 ? (kpiData.totalRevenue / targetRevenue) * 100 : 0;

  const missingAppointments = Math.max(0, targetAppointments - kpiData.totalAppointments);
  const missingRevenue = Math.max(0, targetRevenue - kpiData.totalRevenue);

  const commissionAppointments = (kpiData.surgeryCount * 500000) + (kpiData.depositCount * 250000) + (kpiData.bongCount * 250000);

  let revRate = 0.005;
  if (kpiData.totalRevenue >= 1000000000) revRate = 0.015;
  else if (kpiData.totalRevenue >= 500000000) revRate = 0.01;

  const commissionRevenue = kpiData.totalRevenue * revRate;
  const totalCommission = commissionAppointments + commissionRevenue;

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
            <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2 bg-muted/20 rounded-lg border border-dashed">
              <AlertCircle className="w-8 h-8 opacity-50" />
              <p>Bạn chưa được giao KPI cho tháng này.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PhoneCall className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Số điện thoại nhận</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{totalPhonesReceived}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CalendarCheck className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng lịch hẹn</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{kpiData.totalAppointments}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Percent className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tỷ lệ chốt hẹn</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{actualCloseRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Banknote className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Doanh thu được gán</p>
            </div>
            <p className="text-xl font-bold tabular-nums text-purple-600 truncate" title={formatVND(kpiData.totalRevenue)}>{formatVND(kpiData.totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-none bg-gradient-to-br from-indigo-500 to-purple-600 text-white lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Coins className="w-20 h-20" /></div>
          <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
            <p className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Hoa hồng tạm tính</p>
            <p className="text-4xl font-extrabold tabular-nums tracking-tight">{formatVND(totalCommission)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-rose-50/30">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Lịch hẹn còn thiếu</p>
            <p className={`text-2xl font-bold tabular-nums ${missingAppointments > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {missingAppointments}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-rose-50/30">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Doanh thu còn thiếu</p>
            <p className={`text-xl font-bold tabular-nums truncate ${missingRevenue > 0 ? 'text-rose-500' : 'text-emerald-500'}`} title={formatVND(missingRevenue)}>
              {formatVND(missingRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Tiến độ hoàn thành KPI</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="font-semibold text-sm">Tiến độ KPI lịch hẹn</span>
              <span className="text-lg font-bold tabular-nums">{appointmentProgress.toFixed(1)}%</span>
            </div>
            <Progress 
              value={Math.min(100, appointmentProgress)} 
              className="h-2.5"
              indicatorColor={appointmentProgress >= 100 ? 'bg-emerald-500' : appointmentProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'}
            />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Đạt: <strong className="text-foreground">{kpiData.totalAppointments}</strong></span>
              <span>Mục tiêu: <strong className="text-foreground">{targetAppointments}</strong></span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="font-semibold text-sm">Tiến độ KPI doanh thu</span>
              <span className="text-lg font-bold tabular-nums">{revenueProgress.toFixed(1)}%</span>
            </div>
            <Progress 
              value={Math.min(100, revenueProgress)} 
              className="h-2.5"
              indicatorColor={revenueProgress >= 100 ? 'bg-emerald-500' : revenueProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'}
            />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Đạt: <strong className="text-foreground">{formatVND(kpiData.totalRevenue)}</strong></span>
              <span>Mục tiêu: <strong className="text-foreground">{formatVND(targetRevenue)}</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8 pt-4">
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
                {kpiData.myAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Chưa có lịch hẹn.
                    </TableCell>
                  </TableRow>
                ) : (
                  kpiData.myAppointments.map((a, idx) => {
                    const statusLabel = getStatusLabel(a.evaluationStatus || a.status);
                    const statusColor = getStatusColor(a.evaluationStatus || a.status);
                    
                    return (
                      <TableRow key={a.id || idx}>
                        <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {a.appointmentDate ? format(parseISO(a.appointmentDate), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-semibold">{a.customerName}</TableCell>
                        <TableCell className="text-center">
                          <Badge style={{ backgroundColor: statusColor, color: '#fff' }} className="border-transparent font-medium">
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={a.note}>{a.note || '-'}</TableCell>
                      </TableRow>
                    );
                  })
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
                {kpiData.myRevenues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Chưa có doanh thu được gán.
                    </TableCell>
                  </TableRow>
                ) : (
                  kpiData.myRevenues.map((r, idx) => {
                    return (
                      <TableRow key={r.id || idx}>
                        <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {r.revenueDate || r.date || r.createdAt ? format(new Date(r.revenueDate || r.date || r.createdAt), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell>{r.serviceNeed || r.service || r.type || '-'}</TableCell>
                        <TableCell className="text-right font-bold text-purple-600 tabular-nums">
                          {formatVND(r.revenueAmount || r.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={r.note}>{r.note || '-'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default TelesaleKpiPersonalClean;
