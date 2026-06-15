
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Users, CheckCircle, AlertTriangle, TrendingUp, Megaphone, Magnet, CalendarCheck, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatVND } from '@/utils/currencyFormat.js';

const normalize = (val) => String(val || '').trim().toLowerCase();
const getRecordMonth = (record) => record.month || String(record.date || record.createdAt || '').substring(0, 7);

const getStatus = (progress) => {
  if (progress < 50) return { label: 'Chưa đạt', className: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (progress < 80) return { label: 'Đang tiến triển', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (progress < 100) return { label: 'Gần đạt', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  if (progress < 120) return { label: 'Đạt KPI', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return { label: 'Vượt KPI', className: 'bg-purple-100 text-purple-700 border-purple-200' };
};

const CustomBar = (props) => {
  const { x, y, width, height, payload } = props;
  const progress = payload?.avgProgress || 0;
  const color = progress >= 120 ? '#a855f7' : progress >= 100 ? '#10b981' : progress >= 80 ? '#3b82f6' : progress >= 50 ? '#f59e0b' : '#ef4444';
  
  if (height <= 0 || width <= 0) return null;
  const r = Math.min(4, width / 2, height);
  
  return (
    <path 
      d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
      fill={color} 
    />
  );
};

const MetricCell = ({ actual, target, isCurrency = false, isDecimal = false }) => {
  const progress = target > 0 ? Math.min((actual / target) * 100, 100) : (actual > 0 ? 100 : 0);
  const displayActual = isCurrency ? formatVND(actual) : (isDecimal ? actual.toFixed(2) : actual.toLocaleString());
  const displayTarget = isCurrency ? formatVND(target) : (isDecimal ? target.toFixed(2) : target.toLocaleString());

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-[80px]">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-foreground">{displayActual}</span>
        <span className="text-muted-foreground text-[10px]">/ {displayTarget}</span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
};

const KpiMarketingAdminProgressModule = ({ selectedMonth }) => {
  const data = useMemo(() => {
    const kpiTargets = JSON.parse(localStorage.getItem('kpiTargets') || '[]');
    const marketingDailyReports = JSON.parse(localStorage.getItem('marketingDailyReports') || '[]');

    const targets = kpiTargets.filter(t => t.targetType === 'marketing' && t.month === selectedMonth);

    return targets.map(target => {
      const empId = target.employeeId;
      
      const empReports = marketingDailyReports.filter(r => normalize(r.employeeId) === normalize(empId) && getRecordMonth(r) === selectedMonth);
      
      const totalAdSpend = empReports.reduce((sum, r) => sum + (Number(r.adSpend) || 0), 0);
      const totalLeads = empReports.reduce((sum, r) => sum + (Number(r.leadCount) || 0), 0);
      const totalAppointments = empReports.reduce((sum, r) => sum + (Number(r.appointmentCount) || 0), 0);
      const totalAdsRevenue = empReports.reduce((sum, r) => sum + (Number(r.adsRevenue) || 0), 0);

      const costPerLead = totalLeads > 0 ? totalAdSpend / totalLeads : 0;
      const roas = totalAdSpend > 0 ? totalAdsRevenue / totalAdSpend : 0;

      const tLead = Number(target.targetLeadCount) || 0;
      const tAppt = Number(target.targetAppointmentCount) || 0;
      const tRev = Number(target.targetAdsRevenue) || 0;
      const tRoas = Number(target.targetRoas) || 0;
      const maxCpl = Number(target.maxCostPerLead) || 0;

      const leadProgress = tLead > 0 ? (totalLeads / tLead) * 100 : null;
      const apptProgress = tAppt > 0 ? (totalAppointments / tAppt) * 100 : null;
      const revProgress = tRev > 0 ? (totalAdsRevenue / tRev) * 100 : null;
      const roasProgress = tRoas > 0 ? (roas / tRoas) * 100 : null;
      
      let cplProgress = null;
      if (maxCpl > 0) {
        if (costPerLead === 0 && totalAdSpend === 0) {
          cplProgress = 100;
        } else if (costPerLead > 0) {
          cplProgress = costPerLead <= maxCpl ? 100 : (maxCpl / costPerLead) * 100;
        }
      }

      const progressList = [leadProgress, apptProgress, revProgress, roasProgress, cplProgress].filter(p => p !== null);
      const avgProgress = progressList.length > 0 ? progressList.reduce((a, b) => a + b, 0) / progressList.length : 0;

      return {
        ...target,
        totalAdSpend, totalLeads, totalAppointments, totalAdsRevenue, costPerLead, roas,
        tLead, tAppt, tRev, tRoas, maxCpl,
        avgProgress
      };
    });
  }, [selectedMonth]);

  const stats = useMemo(() => {
    let achieved = 0;
    let notAchieved = 0;
    let sumProgress = 0;
    let sumSpend = 0;
    let sumLeads = 0;
    let sumAppointments = 0;
    let sumRevenue = 0;

    data.forEach(d => {
      if (d.avgProgress >= 100) achieved++;
      else notAchieved++;
      sumProgress += d.avgProgress;
      sumSpend += d.totalAdSpend;
      sumLeads += d.totalLeads;
      sumAppointments += d.totalAppointments;
      sumRevenue += d.totalAdsRevenue;
    });

    const avgRoas = sumSpend > 0 ? sumRevenue / sumSpend : 0;

    return {
      total: data.length,
      achieved,
      notAchieved,
      avgOverall: data.length > 0 ? sumProgress / data.length : 0,
      sumSpend,
      sumLeads,
      sumAppointments,
      sumRevenue,
      avgRoas
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.name.includes('Doanh thu') || entry.name.includes('Chi phí') ? formatVND(entry.value) : entry.name.includes('Hoàn thành') ? `${entry.value.toFixed(1)}%` : entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Nhân sự KPI</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Đã đạt</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{stats.achieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <p className="text-xs text-muted-foreground font-semibold uppercase">Chưa đạt</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-rose-600">{stats.notAchieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-purple-50/50">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-purple-700/70 font-semibold uppercase">Hoàn thành TB</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-purple-700">{stats.avgOverall.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 md:grid-cols-5 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-rose-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Chi phí</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-rose-600">{formatVND(stats.sumSpend)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Magnet className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Leads</p>
            </div>
            <p className="text-xl font-bold tabular-nums text-blue-600">{stats.sumLeads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck className="w-4 h-4 text-indigo-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Lịch hẹn</p>
            </div>
            <p className="text-xl font-bold tabular-nums text-indigo-600">{stats.sumAppointments.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground font-medium">Tổng Doanh thu</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-emerald-600">{formatVND(stats.sumRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border col-span-2 md:col-span-1">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-muted-foreground font-medium">ROAS TB</p>
            </div>
            <p className="text-xl font-bold tabular-nums text-amber-600">{stats.avgRoas.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Chi tiết Tiến độ KPI Marketing</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[50px] text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-right">Chi phí Ads</TableHead>
                <TableHead className="w-[120px]">Lead</TableHead>
                <TableHead className="w-[120px]">Lịch hẹn</TableHead>
                <TableHead className="w-[150px]">Doanh thu ADS</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="w-[120px]">ROAS</TableHead>
                <TableHead className="text-center w-[100px]">Tỷ lệ HT</TableHead>
                <TableHead className="text-center w-[120px]">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Không có dữ liệu tiến độ tháng này.</TableCell></TableRow>
              ) : (
                data.map((d, idx) => {
                  const status = getStatus(d.avgProgress);
                  return (
                    <TableRow key={d.id} className="hover:bg-muted/50 transition-colors duration-200">
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-primary">{d.fullName}</div>
                        <div className="text-xs text-muted-foreground">{d.employeeId}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-rose-600 tabular-nums">{formatVND(d.totalAdSpend)}</TableCell>
                      <TableCell><MetricCell actual={d.totalLeads} target={d.tLead} /></TableCell>
                      <TableCell><MetricCell actual={d.totalAppointments} target={d.tAppt} /></TableCell>
                      <TableCell><MetricCell actual={d.totalAdsRevenue} target={d.tRev} isCurrency={true} /></TableCell>
                      <TableCell className="text-right">
                        <div className={`font-semibold tabular-nums ${d.maxCpl > 0 && d.costPerLead > d.maxCpl ? 'text-rose-600' : 'text-foreground'}`}>
                          {formatVND(d.costPerLead)}
                        </div>
                        {d.maxCpl > 0 && <div className="text-[10px] text-muted-foreground">Max: {formatVND(d.maxCpl)}</div>}
                      </TableCell>
                      <TableCell><MetricCell actual={d.roas} target={d.tRoas} isDecimal={true} /></TableCell>
                      <TableCell className="text-center font-bold tabular-nums">{d.avgProgress.toFixed(1)}%</TableCell>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tỷ lệ hoàn thành theo nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Không có dữ liệu tiến độ tháng này.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgProgress" name="Hoàn thành (%)" shape={<CustomBar />} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Chỉ số Leads / Lịch hẹn / Doanh thu</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Không có dữ liệu tiến độ tháng này.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="totalLeads" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="totalAppointments" name="Lịch hẹn" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="totalAdsRevenue" name="Doanh thu" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiMarketingAdminProgressModule;
