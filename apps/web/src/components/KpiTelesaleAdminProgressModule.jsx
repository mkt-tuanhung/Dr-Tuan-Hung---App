
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Users, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { getKpiTargetsByMonth, getPageDailyReports, getRevenueRecords } from '@/utils/userStorage.js';
import { formatVND } from '@/utils/currencyFormat.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const getStatusDisplay = (progress) => {
  if (progress < 50) return { label: 'Chưa đạt', className: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (progress < 80) return { label: 'Đang tiến triển', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (progress < 100) return { label: 'Gần đạt', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  if (progress < 120) return { label: 'Đạt KPI', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return { label: 'Vượt KPI', className: 'bg-purple-100 text-purple-700 border-purple-200' };
};

const CustomBar = (props) => {
  const { x, y, width, height, payload } = props;
  const progress = payload?.avgProgress || 0;
  const color = progress >= 100 ? '#10b981' : progress >= 80 ? '#3b82f6' : progress >= 50 ? '#f59e0b' : '#ef4444';
  
  if (height <= 0 || width <= 0) return null;
  const r = Math.min(4, width / 2, height);
  
  return (
    <path 
      d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
      fill={color} 
    />
  );
};

export const calculateTelesaleKPIForAdmin = (targetUser, month, customerAppointments, revenueRecords) => {
  const uId = String(targetUser.id || '').trim().toLowerCase();
  const uEmpId = String(targetUser.employeeId || '').trim().toLowerCase();
  
  const apps = customerAppointments.filter(a => {
    const tId = String(a.telesaleEmployeeId || '').trim().toLowerCase();
    const isMatch = (tId === uId && uId !== '') || (tId === uEmpId && uEmpId !== '');
    
    const aMonth = String(a.appointmentDate || a.date || a.createdAt || '').substring(0, 7);
    return isMatch && aMonth === month;
  });

  let surgeryCount = 0, depositCount = 0, bongCount = 0;
  apps.forEach(a => {
    const s = String(a.evaluationStatus || a.status || '').trim().toLowerCase();
    if (['surgery', 'phẫu thuật', 'phau thuat'].includes(s)) surgeryCount++;
    else if (['deposit', 'cọc', 'coc'].includes(s)) depositCount++;
    else if (['bong', 'bóng'].includes(s)) bongCount++;
  });

  const revs = revenueRecords.filter(r => {
    const tId = String(r.telesaleEmployeeId || '').trim().toLowerCase();
    const isMatch = (tId === uId && uId !== '') || (tId === uEmpId && uEmpId !== '');
    const rMonth = String(r.revenueDate || r.date || r.createdAt || '').substring(0, 7);
    return isMatch && rMonth === month;
  });
  const totalRevenue = revs.reduce((sum, r) => sum + (Number(r.revenueAmount || r.amount) || 0), 0);

  return { totalAppointments: apps.length, surgeryCount, depositCount, bongCount, totalRevenue };
};

const KpiTelesaleAdminProgressModule = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const data = useMemo(() => {
    const kpiTargets = getStorageItem('kpiTargets', []);
    const pagePhoneAssignments = getStorageItem('pagePhoneAssignments', []);
    const customerAppointments = getStorageItem('customerAppointments', []);
    const revenueRecords = getRevenueRecords(true);
    const allUsers = getStorageItem('clinic_users', []);

    const targets = kpiTargets.filter(t => String(t.targetType).trim().toLowerCase() === 'telesale' && t.month === selectedMonth);

    return targets.map(target => {
      const realUser = allUsers.find(u => {
        const uId = String(u.id || '').trim().toLowerCase();
        const uEmpId = String(u.employeeId || '').trim().toLowerCase();
        const tEmpId = String(target.employeeId || '').trim().toLowerCase();
        return (tEmpId === uId && uId !== '') || (tEmpId === uEmpId && uEmpId !== '');
      }) || target;

      const empPhones = pagePhoneAssignments.filter(a => {
        const aTId = String(a.telesaleEmployeeId || '').trim().toLowerCase();
        const rId = String(realUser.id || '').trim().toLowerCase();
        const rEmpId = String(realUser.employeeId || '').trim().toLowerCase();
        const isMatch = (aTId === rId && rId !== '') || (aTId === rEmpId && rEmpId !== '');
        const aMonth = String(a.date || a.createdAt || '').substring(0, 7);
        return isMatch && aMonth === selectedMonth;
      });

      const totalPhones = empPhones.reduce((sum, a) => sum + (Number(a.phoneCount) || 1), 0);
      const kpiData = calculateTelesaleKPIForAdmin(realUser, selectedMonth, customerAppointments, revenueRecords);
      const closeRate = totalPhones > 0 ? (kpiData.totalAppointments / totalPhones) * 100 : 0;

      const targetRev = Number(target.targetRevenue) || 0;
      const targetClose = Number(target.targetCloseRate) || 0;

      const revProgress = targetRev > 0 ? (kpiData.totalRevenue / targetRev) * 100 : 0;
      const closeProgress = targetClose > 0 ? (closeRate / targetClose) * 100 : 0;

      const progressList = [];
      if (targetRev > 0) progressList.push(revProgress);
      if (targetClose > 0) progressList.push(closeProgress);

      const avgProgress = progressList.length > 0 ? progressList.reduce((a, b) => a + b, 0) / progressList.length : 0;

      return {
        ...target,
        fullName: realUser.fullName || target.fullName,
        employeeId: realUser.employeeId || target.employeeId,
        totalPhones, 
        totalApps: kpiData.totalAppointments, 
        totalRev: kpiData.totalRevenue, 
        closeRate,
        avgProgress, 
        revProgress, 
        closeProgress, 
        targetRev, 
        targetClose
      };
    });
  }, [selectedMonth]);

  const stats = useMemo(() => {
    let achieved = 0;
    let notAchieved = 0;
    let sumProgress = 0;

    data.forEach(d => {
      if (d.avgProgress >= 100) achieved++;
      else notAchieved++;
      sumProgress += d.avgProgress;
    });

    return {
      total: data.length,
      achieved,
      notAchieved,
      avgOverall: data.length > 0 ? sumProgress / data.length : 0
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.name.includes('Hoàn thành') ? `${entry.value.toFixed(1)}%` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Tiến độ KPI Telesale
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Theo dõi tỷ lệ hoàn thành chỉ tiêu tháng</p>
        </div>
        <div className="w-[160px]">
          <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng nhân sự giao KPI</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-700">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Đã đạt KPI</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">{stats.achieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Chưa đạt KPI</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-rose-700">{stats.notAchieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Target className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Trung bình hoàn thành</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-purple-700">{stats.avgOverall.toFixed(1)}%</p>
            <Progress value={Math.min(stats.avgOverall, 100)} className="h-1.5 mt-2" indicatorColor="bg-purple-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-border lg:col-span-3">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Bảng tiến độ chi tiết</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Nhân sự</TableHead>
                  <TableHead className="text-center">SĐT Đã nhận</TableHead>
                  <TableHead className="text-center">Lịch hẹn</TableHead>
                  <TableHead className="text-right">Doanh thu / KPI</TableHead>
                  <TableHead className="text-center">Tỷ lệ chốt / KPI</TableHead>
                  <TableHead className="text-center w-[150px]">Hoàn thành</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Không có dữ liệu tiến độ tháng này.</TableCell></TableRow>
                ) : (
                  data.map(d => {
                    const status = getStatusDisplay(d.avgProgress);
                    return (
                      <TableRow key={d.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <div className="font-medium text-primary">{d.fullName}</div>
                          <div className="text-xs text-muted-foreground">{d.employeeId}</div>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-blue-600">{d.totalPhones}</TableCell>
                        <TableCell className="text-center font-semibold text-indigo-600">{d.totalApps}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-emerald-600">{formatVND(d.totalRev)}</div>
                          <div className="text-xs text-muted-foreground">/ {formatVND(d.targetRev)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-bold text-amber-600">{d.closeRate.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">/ {d.targetClose}%</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={Math.min(d.avgProgress, 100)} className="h-2 w-full" indicatorColor={status.className.split(' ')[0].replace('bg-', 'bg-').replace('-100', '-500')} />
                            <span className="text-xs font-bold tabular-nums min-w-[40px]">{d.avgProgress.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${status.className} font-medium`}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {data.length > 0 && (
          <Card className="shadow-sm border-border lg:col-span-3">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base font-semibold">So sánh Tỷ lệ hoàn thành KPI Telesale</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgProgress" name="Hoàn thành (%)" shape={<CustomBar />} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default KpiTelesaleAdminProgressModule;
