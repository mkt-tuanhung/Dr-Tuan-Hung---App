
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Users, CheckCircle, AlertTriangle, PhoneCall, MessageSquare, ShieldAlert, HeartHandshake } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

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

const MetricCell = ({ actual, target }) => {
  const progress = target > 0 ? Math.min((actual / target) * 100, 100) : (actual > 0 ? 100 : 0);
  return (
    <div className="flex flex-col gap-1.5 w-full min-w-[70px]">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-foreground">{actual.toLocaleString()}</span>
        <span className="text-muted-foreground text-[10px]">/ {target.toLocaleString()}</span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
};

const KpiCskhAdminProgressModule = ({ selectedMonth }) => {
  const data = useMemo(() => {
    const kpiTargets = getStorageItem('kpiTargets', []);
    const cskhDailyReports = getStorageItem('cskhDailyReports', []);

    const targets = kpiTargets.filter(t => t.targetType === 'cskh' && t.month === selectedMonth);

    return targets.map(target => {
      const empId = target.employeeId;
      
      const empReports = cskhDailyReports.filter(r => normalize(r.employeeId) === normalize(empId) && getRecordMonth(r) === selectedMonth);
      
      const totalCaredCustomers = empReports.reduce((sum, r) => sum + (Number(r.caredCustomerCount) || 0), 0);
      const totalSuccessfulCalls = empReports.reduce((sum, r) => sum + (Number(r.successfulCallCount) || 0), 0);
      const totalMessages = empReports.reduce((sum, r) => sum + (Number(r.messageCount) || 0), 0);
      const totalRevisitAppointments = empReports.reduce((sum, r) => sum + (Number(r.revisitAppointmentCount) || 0), 0);
      const totalSatisfiedFeedback = empReports.reduce((sum, r) => sum + (Number(r.satisfiedFeedbackCount) || 0), 0);
      const totalHandledComplaints = empReports.reduce((sum, r) => sum + (Number(r.handledComplaintCount) || 0), 0);
      const totalUnresolvedComplaints = empReports.reduce((sum, r) => sum + (Number(r.unresolvedComplaintCount) || 0), 0);

      const tCared = Number(target.targetCaredCustomerCount) || 0;
      const tCall = Number(target.targetSuccessfulCallCount) || 0;
      const tMsg = Number(target.targetMessageCount) || 0;
      const tRevisit = Number(target.targetRevisitAppointmentCount) || 0;
      const tSatisfied = Number(target.targetSatisfiedFeedbackCount) || 0;
      const tHandled = Number(target.targetHandledComplaintCount) || 0;

      const progressList = [
        tCared > 0 ? (totalCaredCustomers / tCared) * 100 : null,
        tCall > 0 ? (totalSuccessfulCalls / tCall) * 100 : null,
        tMsg > 0 ? (totalMessages / tMsg) * 100 : null,
        tRevisit > 0 ? (totalRevisitAppointments / tRevisit) * 100 : null,
        tSatisfied > 0 ? (totalSatisfiedFeedback / tSatisfied) * 100 : null,
        tHandled > 0 ? (totalHandledComplaints / tHandled) * 100 : null,
      ].filter(p => p !== null);

      const avgProgress = progressList.length > 0 ? progressList.reduce((a, b) => a + b, 0) / progressList.length : 0;

      return {
        ...target,
        totalCaredCustomers, totalSuccessfulCalls, totalMessages, 
        totalRevisitAppointments, totalSatisfiedFeedback, totalHandledComplaints, totalUnresolvedComplaints,
        tCared, tCall, tMsg, tRevisit, tSatisfied, tHandled,
        avgProgress
      };
    });
  }, [selectedMonth]);

  const stats = useMemo(() => {
    let achieved = 0;
    let notAchieved = 0;
    let sumProgress = 0;
    let sumCared = 0;
    let sumCalls = 0;
    let sumMessages = 0;
    let sumHandled = 0;

    data.forEach(d => {
      if (d.avgProgress >= 100) achieved++;
      else notAchieved++;
      sumProgress += d.avgProgress;
      sumCared += d.totalCaredCustomers;
      sumCalls += d.totalSuccessfulCalls;
      sumMessages += d.totalMessages;
      sumHandled += d.totalHandledComplaints;
    });

    return {
      total: data.length,
      achieved,
      notAchieved,
      avgOverall: data.length > 0 ? sumProgress / data.length : 0,
      sumCared,
      sumCalls,
      sumMessages,
      sumHandled
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.name.includes('Hoàn thành') ? `${entry.value.toFixed(1)}%` : entry.value.toLocaleString()}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <HeartHandshake className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground font-medium">Khách CS</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumCared.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <PhoneCall className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground font-medium">Gọi Thành công</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumCalls.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-muted-foreground font-medium">Tin nhắn</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumMessages.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-muted-foreground font-medium">KN Đã xử lý</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{stats.sumHandled.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Chi tiết Tiến độ KPI CSKH</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[50px] text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="w-[100px]">Khách CS</TableHead>
                <TableHead className="w-[100px]">Gọi TC</TableHead>
                <TableHead className="w-[100px]">Tin nhắn</TableHead>
                <TableHead className="w-[100px]">Tái khám</TableHead>
                <TableHead className="w-[100px]">Hài lòng</TableHead>
                <TableHead className="w-[100px]">Xử lý KN</TableHead>
                <TableHead className="w-[90px] text-center">Chưa XL</TableHead>
                <TableHead className="text-center w-[90px]">Tỷ lệ HT</TableHead>
                <TableHead className="text-center w-[120px]">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Không có dữ liệu tiến độ tháng này.</TableCell></TableRow>
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
                      <TableCell><MetricCell actual={d.totalCaredCustomers} target={d.tCared} /></TableCell>
                      <TableCell><MetricCell actual={d.totalSuccessfulCalls} target={d.tCall} /></TableCell>
                      <TableCell><MetricCell actual={d.totalMessages} target={d.tMsg} /></TableCell>
                      <TableCell><MetricCell actual={d.totalRevisitAppointments} target={d.tRevisit} /></TableCell>
                      <TableCell><MetricCell actual={d.totalSatisfiedFeedback} target={d.tSatisfied} /></TableCell>
                      <TableCell><MetricCell actual={d.totalHandledComplaints} target={d.tHandled} /></TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold tabular-nums ${d.totalUnresolvedComplaints > 0 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded' : 'text-muted-foreground'}`}>
                          {d.totalUnresolvedComplaints}
                        </span>
                      </TableCell>
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
            <CardTitle className="text-base font-semibold">Chỉ số Khách CS / Gọi TC / Tin nhắn</CardTitle>
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
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="totalCaredCustomers" name="Khách CS" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="totalSuccessfulCalls" name="Gọi TC" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="totalMessages" name="Tin nhắn" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiCskhAdminProgressModule;
