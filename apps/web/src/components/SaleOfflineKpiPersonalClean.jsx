
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Target, Coins, CalendarCheck, Banknote, Percent, TrendingUp, ArrowUpCircle, Wallet, AlertCircle } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { 
  normalize, matchId, getMonth, getStatus, isSurgery, isDeposit, isBong, 
  calculateKpiProgress, getKpiSeverity 
} from '@/utils/kpiPayrollHelper.js';

const STATUS_COLORS = {
  'surgery': '#10b981', 'phẫu thuật': '#10b981', 'phau thuat': '#10b981',
  'deposit': '#3b82f6', 'cọc': '#3b82f6', 'coc': '#3b82f6',
  'bong': '#f97316', 'bóng': '#f97316',
  'pending': '#64748b', 'chờ tư vấn': '#64748b'
};

const getStatusColor = (status) => STATUS_COLORS[normalize(status)] || '#94a3b8';
const getStatusLabel = (status) => {
  const s = normalize(status);
  if (['surgery', 'phẫu thuật', 'phau thuat'].includes(s)) return 'Phẫu thuật';
  if (['deposit', 'cọc', 'coc'].includes(s)) return 'Cọc';
  if (['bong', 'bóng'].includes(s)) return 'Bong';
  if (['pending', 'chờ tư vấn'].includes(s)) return 'Chờ tư vấn';
  return status || 'Khác';
};

const safeParse = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const getRevenueAmount = (r) => Number(r.revenueAmount || r.surgeryRevenue || r.amount || r.revenue || r.totalRevenue) || 0;
const getUpsaleAmount = (r) => Number(r.upsaleRevenue || r.upsaleAmount || r.revenueUpsale) || 0;

export const getKpiTarget = (user, month) => {
  const kpiTargets = safeParse("kpiTargets");
  return kpiTargets.find(t => 
    normalize(t.targetType).includes('sale') && 
    matchId(t.employeeId, user) && 
    t.month === month
  );
};

export const calculateSaleOfflineKPI = (user, month) => {
  const customerAppointments = safeParse("customerAppointments");
  const revenueRecords = safeParse("revenueRecords");

  const myApps = customerAppointments.filter(a => matchId(a.saleOfflineEmployeeId, user) && getMonth(a) === month);
  let surgeryCount = 0, depositCount = 0, bongCount = 0;

  myApps.forEach(a => {
    if (isSurgery(a)) surgeryCount++;
    else if (isDeposit(a)) depositCount++;
    else if (isBong(a)) bongCount++;
  });

  const actualCloseRate = myApps.length > 0 ? ((surgeryCount + depositCount) / myApps.length) * 100 : 0;
  const conversionRate = actualCloseRate; // Keep for backward compatibility

  const myRevenues = revenueRecords.filter(r => matchId(r.saleOfflineEmployeeId, user) && getMonth(r) === month);

  let totalRevenue = 0;
  let totalUpsale = 0;

  myRevenues.forEach(r => {
    totalRevenue += getRevenueAmount(r);
    totalUpsale += getUpsaleAmount(r);
  });

  const upsaleCommission = totalUpsale * 0.03;
  
  let revenueCommissionRate = 0;
  if (totalRevenue > 0 && totalRevenue < 500000000) revenueCommissionRate = 0.01;
  else if (totalRevenue >= 500000000 && totalRevenue < 1000000000) revenueCommissionRate = 0.015;
  else if (totalRevenue >= 1000000000) revenueCommissionRate = 0.02;

  const revenueCommission = totalRevenue * revenueCommissionRate;
  const totalCommission = revenueCommission + upsaleCommission;

  return {
    totalAppointments: myApps.length,
    surgeryCount, depositCount, bongCount,
    actualCloseRate, conversionRate,
    totalRevenue, totalUpsale,
    revenueCommission, upsaleCommission, totalCommission,
    revenueCommissionRate,
    myAppointments: myApps,
    myRevenues
  };
};

const SaleOfflineKpiPersonalClean = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const kpiData = useMemo(() => calculateSaleOfflineKPI(currentUser, selectedMonth), [currentUser, selectedMonth]);
  const kpiTarget = useMemo(() => getKpiTarget(currentUser, selectedMonth), [currentUser, selectedMonth]);

  // Calculations for assigned KPI targets
  const targetRevenue = Number(kpiTarget?.targetRevenue) || 0;
  const targetCloseRate = Number(kpiTarget?.targetCloseRate) || 0;

  const revenueProgress = calculateKpiProgress(kpiData.totalRevenue, targetRevenue);
  const closeRateProgress = calculateKpiProgress(kpiData.actualCloseRate, targetCloseRate);
  
  const activeTargetsCount = (targetRevenue > 0 ? 1 : 0) + (targetCloseRate > 0 ? 1 : 0);
  const overallProgress = activeTargetsCount > 0 ? (revenueProgress + closeRateProgress) / activeTargetsCount : 0;
  const severity = getKpiSeverity(overallProgress);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> 
            KPI cá nhân - Sale Offline
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Theo dõi hiệu suất và hoa hồng Sale Offline của bạn</p>
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

      {/* KPI TARGETS ASSIGNED SECTION */}
      <Card className="shadow-sm border-border bg-card">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg font-semibold">Chỉ tiêu KPI được giao</CardTitle>
              <CardDescription>Mục tiêu thực hiện trong tháng {selectedMonth}</CardDescription>
            </div>
            {kpiTarget && (
              <Badge variant="outline" className={`${severity.className} px-3 py-1 font-semibold text-sm`}>
                {severity.label} ({overallProgress.toFixed(0)}%)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!kpiTarget ? (
            <div className="flex flex-col items-center justify-center py-8 text-amber-600 bg-amber-50 rounded-xl border border-amber-200">
              <AlertCircle className="w-10 h-10 mb-2 opacity-80" />
              <p className="font-medium text-center">Chưa có KPI được giao cho tháng này.</p>
              <p className="text-sm text-amber-700/80 mt-1">Vui lòng liên hệ quản lý để được thiết lập chỉ tiêu.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col p-4 bg-muted/30 rounded-xl border border-border">
                  <span className="text-sm text-muted-foreground font-medium mb-1 uppercase">KPI Doanh thu</span>
                  <span className="text-xl font-bold text-foreground truncate">{formatVND(targetRevenue)}</span>
                </div>
                <div className="flex flex-col p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-sm text-emerald-700 font-medium mb-1 uppercase">Thực tế Doanh thu</span>
                  <span className="text-xl font-bold text-emerald-700 truncate">{formatVND(kpiData.totalRevenue)}</span>
                </div>
                <div className="flex flex-col p-4 bg-muted/30 rounded-xl border border-border">
                  <span className="text-sm text-muted-foreground font-medium mb-1 uppercase">KPI Tỷ lệ chốt</span>
                  <span className="text-xl font-bold text-foreground">{targetCloseRate}%</span>
                </div>
                <div className="flex flex-col p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <span className="text-sm text-blue-700 font-medium mb-1 uppercase">Thực tế Tỷ lệ chốt</span>
                  <span className="text-xl font-bold text-blue-700">{kpiData.actualCloseRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="font-semibold text-sm">Tiến độ Doanh thu</span>
                    <span className="text-base font-bold tabular-nums">{revenueProgress.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={Math.min(100, revenueProgress)} 
                    className="h-2.5"
                    indicatorColor={getKpiSeverity(revenueProgress).color}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="font-semibold text-sm">Tiến độ Tỷ lệ chốt</span>
                    <span className="text-base font-bold tabular-nums">{closeRateProgress.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={Math.min(100, closeRateProgress)} 
                    className="h-2.5"
                    indicatorColor={getKpiSeverity(closeRateProgress).color}
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-border/50">
                <div className="flex justify-between items-end mb-3">
                  <span className="font-bold">Tổng quan hoàn thành</span>
                  <span className={`text-lg font-bold tabular-nums ${severity.className.split(' ')[1]}`}>
                    {overallProgress.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(100, overallProgress)} 
                  className="h-3"
                  indicatorColor={severity.color}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Doanh thu & Hoa hồng</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng khách tiếp */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-5 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CalendarCheck className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng khách tiếp</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-blue-600">{kpiData.totalAppointments}</p>
              <div className="mt-2 text-xs text-muted-foreground flex gap-2">
                <span className="text-emerald-600 font-medium">PT: {kpiData.surgeryCount}</span>
                <span className="text-blue-600 font-medium">Cọc: {kpiData.depositCount}</span>
                <span className="text-rose-600 font-medium">Bong: {kpiData.bongCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Tỷ lệ chốt thực tế */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-5 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Percent className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Tỷ lệ chốt thực tế</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">{kpiData.actualCloseRate.toFixed(1)}%</p>
              <p className="mt-2 text-xs text-muted-foreground">(Phẫu thuật + Cọc) / Tổng khách</p>
            </CardContent>
          </Card>

          {/* Card 3: Doanh thu chốt được */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-5 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Banknote className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Doanh thu chốt được</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-purple-600 truncate" title={formatVND(kpiData.totalRevenue)}>
                {formatVND(kpiData.totalRevenue)}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Doanh thu Upsale */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-5 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Doanh thu Upsale</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-orange-600 truncate" title={formatVND(kpiData.totalUpsale)}>
                {formatVND(kpiData.totalUpsale)}
              </p>
            </CardContent>
          </Card>

          {/* Card 5: Hoa hồng doanh thu */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-5 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Wallet className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Hoa hồng doanh thu</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-emerald-600 truncate" title={formatVND(kpiData.revenueCommission)}>
                {formatVND(kpiData.revenueCommission)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground font-medium">Tỷ lệ: {(kpiData.revenueCommissionRate * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>

          {/* Card 6: Hoa hồng Upsale */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-5 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ArrowUpCircle className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Hoa hồng Upsale</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-blue-600 truncate" title={formatVND(kpiData.upsaleCommission)}>
                {formatVND(kpiData.upsaleCommission)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground font-medium">Tỷ lệ: 3.0%</p>
            </CardContent>
          </Card>

          {/* Card 7: Tổng hoa hồng ước tính */}
          <Card className="shadow-md border-none bg-gradient-to-br from-rose-500 to-red-600 text-white lg:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20"><Coins className="w-24 h-24" /></div>
            <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
              <p className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Tổng hoa hồng ước tính</p>
              <p className="text-4xl font-extrabold tabular-nums tracking-tight">{formatVND(kpiData.totalCommission)}</p>
              <p className="mt-2 text-sm opacity-80">Hoa hồng doanh thu + Hoa hồng Upsale</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-8 pt-4">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-500" /> Lịch hẹn khách hàng của tôi
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
                      Chưa có lịch hẹn khách hàng nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  kpiData.myAppointments.map((a, idx) => {
                    const statusLabel = getStatusLabel(a.status);
                    const statusColor = getStatusColor(a.status);
                    
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
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead className="text-right">Upsale</TableHead>
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
                    const revAmt = getRevenueAmount(r);
                    const upAmt = getUpsaleAmount(r);
                    return (
                      <TableRow key={r.id || idx}>
                        <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {r.revenueDate || r.createdAt ? format(new Date(r.revenueDate || r.createdAt), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-semibold">{r.customerName || '-'}</TableCell>
                        <TableCell className="text-right font-bold text-purple-600 tabular-nums">
                          {formatVND(revAmt)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-orange-600 tabular-nums">
                          {formatVND(upAmt)}
                        </TableCell>
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

export default SaleOfflineKpiPersonalClean;
