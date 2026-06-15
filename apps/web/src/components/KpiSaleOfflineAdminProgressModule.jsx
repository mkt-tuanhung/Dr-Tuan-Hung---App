
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, BarChart2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  normalize, matchId, getKpiSeverity, calculateSaleOfflineKPI 
} from '@/utils/kpiPayrollHelper.js';

const safeParse = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const formatPercent = (val) => `${Number(val).toFixed(1)}%`;

const KpiSaleOfflineAdminProgressModule = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { saleOfflineKPIData, chartsData } = useMemo(() => {
    const customerAppointments = safeParse('customerAppointments');
    const revenueRecords = safeParse('revenueRecords');
    const kpiTargets = safeParse('kpiTargets');
    const users = safeParse('clinic_users');

    const saleOfflineUsers = users.filter(u => {
      const pos = normalize(u.departmentPosition);
      return pos === 'sale offline' || pos === 'sale';
    });

    const kpiDataList = saleOfflineUsers.map(user => {
      const metrics = calculateSaleOfflineKPI(user, selectedMonth, customerAppointments, revenueRecords);
      
      const target = kpiTargets.find(t => 
        (normalize(t.targetType) === 'sale_offline' || normalize(t.targetType) === 'sale') && 
        matchId(t.employeeId, user) && 
        t.month === selectedMonth
      );

      const targetRevenue = Number(target?.targetRevenue) || 0;
      const targetCloseRate = Number(target?.targetCloseRate) || 0;

      const revenueProgress = targetRevenue > 0 ? (metrics.totalRevenue / targetRevenue) * 100 : 0;
      const closeRateProgress = targetCloseRate > 0 ? (metrics.actualCloseRate / targetCloseRate) * 100 : 0;
      
      let activeTargetsCount = 0;
      let sumProgress = 0;
      if (targetRevenue > 0) { activeTargetsCount++; sumProgress += revenueProgress; }
      if (targetCloseRate > 0) { activeTargetsCount++; sumProgress += closeRateProgress; }
      
      const overallProgress = activeTargetsCount > 0 ? sumProgress / activeTargetsCount : 0;
      const severity = getKpiSeverity(overallProgress);

      return {
        ...user,
        ...metrics,
        targetRevenue,
        targetCloseRate,
        revenueProgress,
        closeRateProgress,
        overallProgress,
        severity
      };
    }).sort((a, b) => b.overallProgress - a.overallProgress);

    const cRevenue = [];
    const cUpsale = [];
    const cCommission = [];
    const cAppointments = [];
    const cCloseRate = [];
    const cKpiProgress = [];

    kpiDataList.forEach(d => {
      const name = d.fullName || d.name || d.employeeId;
      cRevenue.push({ name, DoanhThu: d.totalRevenue });
      cUpsale.push({ name, Upsale: d.totalUpsale });
      cCommission.push({ name, HoaHong: d.saleOfflineCommissionTotal });
      cAppointments.push({ name, Bong: d.bongCount, Coc: d.depositCount, PhauThuat: d.surgeryCount });
      cCloseRate.push({ name, TyLeChot: d.actualCloseRate });
      cKpiProgress.push({ name, TienDoDoanhThu: d.revenueProgress, TienDoTyLeChot: d.closeRateProgress });
    });

    return {
      saleOfflineKPIData: kpiDataList,
      chartsData: {
        revenue: cRevenue,
        upsale: cUpsale,
        commission: cCommission,
        appointments: cAppointments,
        closeRate: cCloseRate,
        kpiProgress: cKpiProgress
      }
    };
  }, [selectedMonth]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" /> 
            So sánh & Tiến độ Sale Offline
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Phân tích hiệu suất, doanh thu và hoa hồng toàn bộ phòng Sale</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Thực tế Doanh thu</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.revenue} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val/1000000}tr`} />
                <Tooltip formatter={(val) => formatVND(val)} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="DoanhThu" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Doanh thu Upsale</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.upsale} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val/1000000}tr`} />
                <Tooltip formatter={(val) => formatVND(val)} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="Upsale" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tổng hoa hồng (VNĐ)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.commission} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val/1000000}tr`} />
                <Tooltip formatter={(val) => formatVND(val)} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="HoaHong" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Trạng thái Hẹn khách</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.appointments} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Bong" stackId="a" fill="#f43f5e" />
                <Bar dataKey="Coc" stackId="a" fill="#3b82f6" />
                <Bar dataKey="PhauThuat" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tỷ lệ chốt thực tế (%)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartsData.closeRate} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip formatter={formatPercent} />
                <Line type="monotone" dataKey="TyLeChot" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tiến độ KPI (%)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.kpiProgress} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={formatPercent} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="TienDoDoanhThu" name="Doanh thu" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="TienDoTyLeChot" name="Tỷ lệ chốt" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Bảng phân tích chi tiết KPI
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1400px]">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[160px]">Nhân sự</TableHead>
                <TableHead className="text-center">Tổng hẹn</TableHead>
                <TableHead className="text-center text-rose-600">Bong</TableHead>
                <TableHead className="text-center text-blue-600">Cọc</TableHead>
                <TableHead className="text-center text-emerald-600">Phẫu thuật</TableHead>
                <TableHead className="text-center bg-muted/50">Tỷ lệ chốt</TableHead>
                <TableHead className="text-right">KPI Doanh thu</TableHead>
                <TableHead className="text-center">KPI Tỷ lệ chốt</TableHead>
                <TableHead className="text-right bg-purple-50/50">Doanh thu</TableHead>
                <TableHead className="text-right bg-orange-50/50">Upsale</TableHead>
                <TableHead className="text-right">Hoa hồng DT</TableHead>
                <TableHead className="text-right">Hoa hồng Upsale</TableHead>
                <TableHead className="text-right bg-emerald-50/50">Tổng hoa hồng</TableHead>
                <TableHead className="text-center w-[120px]">Tiến độ</TableHead>
                <TableHead className="text-center w-[120px]">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saleOfflineKPIData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu nhân sự Sale Offline.
                  </TableCell>
                </TableRow>
              ) : (
                saleOfflineKPIData.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">
                      <div className="text-foreground">{row.fullName || row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeId}</div>
                    </TableCell>
                    <TableCell className="text-center font-bold">{row.totalAppointments}</TableCell>
                    <TableCell className="text-center font-medium text-rose-600">{row.bongCount}</TableCell>
                    <TableCell className="text-center font-medium text-blue-600">{row.depositCount}</TableCell>
                    <TableCell className="text-center font-medium text-emerald-600">{row.surgeryCount}</TableCell>
                    <TableCell className="text-center font-bold bg-muted/20">
                      {formatPercent(row.actualCloseRate)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">
                      {row.targetRevenue > 0 ? formatVND(row.targetRevenue) : '-'}
                    </TableCell>
                    <TableCell className="text-center font-medium text-muted-foreground">
                      {row.targetCloseRate > 0 ? formatPercent(row.targetCloseRate) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-purple-700 bg-purple-50/20 tabular-nums">
                      {formatVND(row.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-orange-600 bg-orange-50/20 tabular-nums">
                      {formatVND(row.totalUpsale)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-muted-foreground">
                      {formatVND(row.saleOfflineRevenueCommission)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-muted-foreground">
                      {formatVND(row.saleOfflineUpsaleCommission)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-700 bg-emerald-50/20 tabular-nums">
                      {formatVND(row.saleOfflineCommissionTotal)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-1 items-center justify-center">
                        <span className="text-xs font-bold" style={{ color: row.severity.color }}>
                          {formatPercent(row.overallProgress)}
                        </span>
                        <Progress 
                          value={Math.min(row.overallProgress, 100)} 
                          className="h-1.5 w-full bg-muted" 
                          indicatorColor={row.severity.color} 
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.targetRevenue > 0 || row.targetCloseRate > 0 ? (
                        <Badge variant="outline" className={`${row.severity.className} whitespace-nowrap`}>
                          {row.severity.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Chưa giao</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default KpiSaleOfflineAdminProgressModule;
