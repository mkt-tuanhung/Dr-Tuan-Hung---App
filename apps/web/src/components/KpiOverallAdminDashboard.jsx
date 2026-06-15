import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getRevenueRecords } from '@/utils/userStorage.js';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const PIE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7'];

const normalize = (val) => String(val || '').trim().toLowerCase();
const getRecordMonth = (record) => record.month || String(record.date || record.createdAt || '').substring(0, 7);

const KpiOverallAdminDashboard = ({ selectedMonth }) => {
  const data = useMemo(() => {
    const kpiTargets = getStorageItem('kpiTargets', []);
    const targets = kpiTargets.filter(t => t.month === selectedMonth);

    // Fetch all relevant data sets
    const pageReports = getStorageItem('pageDailyReports', []);
    const phoneAssigns = getStorageItem('pagePhoneAssignments', []);
    const appointments = getStorageItem('customerAppointments', []);
    const revenues = getRevenueRecords(true);
    const mediaReports = getStorageItem('mediaDailyReports', []);
    const cskhReports = getStorageItem('cskhDailyReports', []);
    const marketingReports = getStorageItem('marketingDailyReports', []);

    let departmentStats = {
      'page': { name: 'Trực page', sumProgress: 0, count: 0 },
      'telesale': { name: 'Telesale', sumProgress: 0, count: 0 },
      'sale_offline': { name: 'Sale Offline', sumProgress: 0, count: 0 },
      'media': { name: 'Media', sumProgress: 0, count: 0 },
      'cskh': { name: 'CSKH', sumProgress: 0, count: 0 },
      'marketing': { name: 'Marketing', sumProgress: 0, count: 0 },
    };

    let statusCounts = {
      'Chưa đạt': 0, 'Đang tiến triển': 0, 'Gần đạt': 0, 'Đạt KPI': 0, 'Vượt KPI': 0
    };

    let totalAchieved = 0;
    let totalNotAchieved = 0;
    let overallProgressSum = 0;

    targets.forEach(target => {
      const empId = normalize(target.employeeId);
      let avgProgress = 0;

      if (target.targetType === 'page') {
        const empReports = pageReports.filter(r => normalize(r.employeeId) === empId && getRecordMonth(r) === selectedMonth);
        const totalPhones = empReports.reduce((sum, r) => sum + (Number(r.totalPhones) || Number(r.phonesReceived) || 0), 0);
        const tPhones = Number(target.targetPhones) || 0;
        avgProgress = tPhones > 0 ? (totalPhones / tPhones) * 100 : 0;
      } 
      else if (target.targetType === 'telesale') {
        const empRevs = revenues.filter(r => normalize(r.telesaleEmployeeId) === empId && getRecordMonth(r) === selectedMonth);
        const totalRev = empRevs.reduce((sum, r) => sum + (Number(r.revenueAmount || r.amount) || 0), 0);
        const targetRev = Number(target.targetRevenue) || 0;
        avgProgress = targetRev > 0 ? (totalRev / targetRev) * 100 : 0; // Simplified to primary metric
      }
      else if (target.targetType === 'sale_offline') {
        const empRevs = revenues.filter(r => normalize(r.saleOfflineEmployeeId) === empId && getRecordMonth(r) === selectedMonth);
        const totalRev = empRevs.reduce((sum, r) => sum + (Number(r.revenueAmount || r.amount) || 0), 0);
        const targetRev = Number(target.targetRevenue) || 0;
        avgProgress = targetRev > 0 ? (totalRev / targetRev) * 100 : 0;
      }
      else if (target.targetType === 'media') {
        const empReports = mediaReports.filter(r => normalize(r.employeeId) === empId && getRecordMonth(r) === selectedMonth);
        const totalVideos = empReports.reduce((sum, r) => sum + (Number(r.videoCount) || 0), 0);
        const tVideo = Number(target.targetVideoCount) || 0;
        avgProgress = tVideo > 0 ? (totalVideos / tVideo) * 100 : 0;
      }
      else if (target.targetType === 'cskh') {
        const empReports = cskhReports.filter(r => normalize(r.employeeId) === empId && getRecordMonth(r) === selectedMonth);
        const totalCared = empReports.reduce((sum, r) => sum + (Number(r.caredCustomerCount) || 0), 0);
        const tCared = Number(target.targetCaredCustomerCount) || 0;
        avgProgress = tCared > 0 ? (totalCared / tCared) * 100 : 0;
      }
      else if (target.targetType === 'marketing') {
        const empReports = marketingReports.filter(r => normalize(r.employeeId) === empId && getRecordMonth(r) === selectedMonth);
        const totalLeads = empReports.reduce((sum, r) => sum + (Number(r.leadCount) || 0), 0);
        const tLead = Number(target.targetLeadCount) || 0;
        avgProgress = tLead > 0 ? (totalLeads / tLead) * 100 : 0;
      }

      // Aggregate
      overallProgressSum += avgProgress;
      if (avgProgress >= 100) totalAchieved++;
      else totalNotAchieved++;

      if (departmentStats[target.targetType]) {
        departmentStats[target.targetType].sumProgress += avgProgress;
        departmentStats[target.targetType].count++;
      }

      if (avgProgress < 50) statusCounts['Chưa đạt']++;
      else if (avgProgress < 80) statusCounts['Đang tiến triển']++;
      else if (avgProgress < 100) statusCounts['Gần đạt']++;
      else if (avgProgress < 120) statusCounts['Đạt KPI']++;
      else statusCounts['Vượt KPI']++;
    });

    const deptChartData = Object.values(departmentStats).map(dept => ({
      name: dept.name,
      avgProgress: dept.count > 0 ? dept.sumProgress / dept.count : 0
    })).filter(d => d.avgProgress > 0 || targets.length === 0);

    const pieChartData = Object.entries(statusCounts).map(([name, value]) => ({
      name, value
    })).filter(d => d.value > 0);

    return {
      totalTargets: targets.length,
      totalAchieved,
      totalNotAchieved,
      overallAverage: targets.length > 0 ? overallProgressSum / targets.length : 0,
      deptChartData,
      pieChartData
    };
  }, [selectedMonth]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.value.toFixed(1)}{entry.name.includes('%') || entry.name.includes('Trung bình') ? '%' : ' nhân sự'}
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
              <Target className="w-4 h-4 text-primary" />
              <p className="text-[10px] md:text-xs text-muted-foreground font-semibold uppercase">Tổng KPI Đã Giao</p>
            </div>
            <p className="text-xl md:text-2xl font-bold tabular-nums text-foreground">{data.totalTargets}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-[10px] md:text-xs text-muted-foreground font-semibold uppercase">Nhân Sự Đạt KPI</p>
            </div>
            <p className="text-xl md:text-2xl font-bold tabular-nums text-emerald-600">{data.totalAchieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <p className="text-[10px] md:text-xs text-muted-foreground font-semibold uppercase">Nhân Sự Chưa Đạt</p>
            </div>
            <p className="text-xl md:text-2xl font-bold tabular-nums text-rose-600">{data.totalNotAchieved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-purple-50/50">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-purple-600" />
              <p className="text-[10px] md:text-xs text-purple-700/70 font-semibold uppercase">Hoàn Thành Hệ Thống</p>
            </div>
            <p className="text-xl md:text-2xl font-bold tabular-nums text-purple-700">{data.overallAverage.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tỷ lệ hoàn thành theo Bộ phận</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {data.deptChartData.length === 0 || data.totalTargets === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu KPI tháng này</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.deptChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgProgress" name="Trung bình (%)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Phân bổ trạng thái KPI</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {data.pieChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu trạng thái</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {data.pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiOverallAdminDashboard;
