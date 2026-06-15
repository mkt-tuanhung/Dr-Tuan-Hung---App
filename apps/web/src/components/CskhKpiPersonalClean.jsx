
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Target, Users, Headphones as Headset, MessageCircle, CalendarHeart, Smile, AlertTriangle, Pencil, Trash2, ShieldAlert, HeartHandshake, AlertCircle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';
import { getKpiTargets } from '@/utils/userStorage.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

const CskhKpiPersonalClean = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [refreshKey, setRefreshKey] = useState(0);

  const [reportForm, setReportForm] = useState({
    id: null,
    date: format(new Date(), 'yyyy-MM-dd'),
    caredCustomerCount: 0,
    successfulCallCount: 0,
    messageCount: 0,
    revisitAppointmentCount: 0,
    satisfiedFeedbackCount: 0,
    followUpCount: 0,
    handledComplaintCount: 0,
    unresolvedComplaintCount: 0,
    note: ''
  });

  const currentEmployeeId = currentUser?.employeeId?.trim().toLowerCase();

  // Load KPI Target
  const assignedKpi = useMemo(() => {
    const allTargets = getKpiTargets();
    return allTargets.find(kpi => 
      kpi.targetType?.trim().toLowerCase() === 'cskh' && 
      kpi.employeeId?.trim().toLowerCase() === currentEmployeeId && 
      kpi.month === selectedMonth
    );
  }, [selectedMonth, currentEmployeeId, refreshKey]);

  // Load Daily Reports
  const myReports = useMemo(() => {
    const allReports = getStorageItem('cskhDailyReports', []);
    return allReports
      .filter(r => 
        r.employeeId?.trim().toLowerCase() === currentEmployeeId && 
        r.month === selectedMonth
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selectedMonth, currentEmployeeId, refreshKey]);

  // Calculate Totals
  const totals = useMemo(() => {
    return myReports.reduce((acc, r) => ({
      caredCustomer: acc.caredCustomer + (Number(r.caredCustomerCount) || 0),
      successfulCall: acc.successfulCall + (Number(r.successfulCallCount) || 0),
      message: acc.message + (Number(r.messageCount) || 0),
      revisit: acc.revisit + (Number(r.revisitAppointmentCount) || 0),
      satisfied: acc.satisfied + (Number(r.satisfiedFeedbackCount) || 0),
      followUp: acc.followUp + (Number(r.followUpCount) || 0),
      handledComplaint: acc.handledComplaint + (Number(r.handledComplaintCount) || 0),
      unresolvedComplaint: acc.unresolvedComplaint + (Number(r.unresolvedComplaintCount) || 0),
    }), { caredCustomer: 0, successfulCall: 0, message: 0, revisit: 0, satisfied: 0, followUp: 0, handledComplaint: 0, unresolvedComplaint: 0 });
  }, [myReports]);

  // Target values
  const targets = {
    caredCustomer: Number(assignedKpi?.targetCaredCustomerCount) || 0,
    successfulCall: Number(assignedKpi?.targetSuccessfulCallCount) || 0,
    message: Number(assignedKpi?.targetMessageCount) || 0,
    revisit: Number(assignedKpi?.targetRevisitAppointmentCount) || 0,
    satisfied: Number(assignedKpi?.targetSatisfiedFeedbackCount) || 0,
    handledComplaint: Number(assignedKpi?.targetHandledComplaintCount) || 0,
  };

  // Calculate Progresses
  const calcProgress = (total, target) => target > 0 ? (total / target) * 100 : 0;
  
  const progress = {
    caredCustomer: calcProgress(totals.caredCustomer, targets.caredCustomer),
    successfulCall: calcProgress(totals.successfulCall, targets.successfulCall),
    message: calcProgress(totals.message, targets.message),
    revisit: calcProgress(totals.revisit, targets.revisit),
    satisfied: calcProgress(totals.satisfied, targets.satisfied),
    handledComplaint: calcProgress(totals.handledComplaint, targets.handledComplaint),
  };

  // Overall Completion Calculation
  const overallCompletion = useMemo(() => {
    const validMetrics = [
      targets.caredCustomer > 0 ? progress.caredCustomer : null,
      targets.successfulCall > 0 ? progress.successfulCall : null,
      targets.message > 0 ? progress.message : null,
      targets.revisit > 0 ? progress.revisit : null,
      targets.satisfied > 0 ? progress.satisfied : null,
      targets.handledComplaint > 0 ? progress.handledComplaint : null,
    ].filter(p => p !== null);

    if (validMetrics.length === 0) return 0;
    const sum = validMetrics.reduce((a, b) => a + Math.min(b, 100), 0);
    return sum / validMetrics.length;
  }, [targets, progress]);

  // Chart Data
  const dailyChartData = useMemo(() => {
    const daysMap = {};
    myReports.forEach(r => {
      const day = isValid(parseISO(r.date)) ? format(parseISO(r.date), 'dd/MM') : r.date;
      if (!daysMap[day]) {
        daysMap[day] = { name: day, Khách: 0, Gọi: 0, Tin_nhắn: 0 };
      }
      daysMap[day].Khách += Number(r.caredCustomerCount) || 0;
      daysMap[day].Gọi += Number(r.successfulCallCount) || 0;
      daysMap[day].Tin_nhắn += Number(r.messageCount) || 0;
    });
    return Object.values(daysMap).reverse(); // Oldest to newest
  }, [myReports]);

  const pieChartData = useMemo(() => {
    return [
      { name: 'Khách Hài Lòng', value: totals.satisfied },
      { name: 'Đang Chăm Sóc/Follow-up', value: totals.followUp },
      { name: 'Khiếu Nại Đã Xử Lý', value: totals.handledComplaint },
      { name: 'Khiếu Nại Chưa Xử Lý', value: totals.unresolvedComplaint },
    ].filter(d => d.value > 0);
  }, [totals]);

  const handleSaveReport = (e) => {
    e.preventDefault();
    if (!reportForm.date) return toast.error('Vui lòng chọn ngày báo cáo');

    const allReports = getStorageItem('cskhDailyReports', []);
    const reportMonth = reportForm.date.substring(0, 7);
    
    const payload = {
      ...reportForm,
      month: reportMonth,
      employeeId: currentUser.employeeId,
      fullName: currentUser.fullName,
      caredCustomerCount: Number(reportForm.caredCustomerCount),
      successfulCallCount: Number(reportForm.successfulCallCount),
      messageCount: Number(reportForm.messageCount),
      revisitAppointmentCount: Number(reportForm.revisitAppointmentCount),
      satisfiedFeedbackCount: Number(reportForm.satisfiedFeedbackCount),
      followUpCount: Number(reportForm.followUpCount),
      handledComplaintCount: Number(reportForm.handledComplaintCount),
      unresolvedComplaintCount: Number(reportForm.unresolvedComplaintCount),
      updatedAt: new Date().toISOString()
    };

    if (reportForm.id) {
      const idx = allReports.findIndex(r => r.id === reportForm.id);
      if (idx !== -1) {
        allReports[idx] = { ...allReports[idx], ...payload };
        toast.success('Cập nhật báo cáo CSKH thành công');
      }
    } else {
      payload.id = crypto.randomUUID();
      payload.createdAt = new Date().toISOString();
      allReports.push(payload);
      toast.success('Thêm báo cáo CSKH mới thành công');
    }

    setStorageItem('cskhDailyReports', allReports);
    setReportForm({
      id: null,
      date: format(new Date(), 'yyyy-MM-dd'),
      caredCustomerCount: 0, successfulCallCount: 0, messageCount: 0, revisitAppointmentCount: 0,
      satisfiedFeedbackCount: 0, followUpCount: 0, handledComplaintCount: 0, unresolvedComplaintCount: 0, note: ''
    });
    setRefreshKey(k => k + 1);
  };

  const handleEditReport = (report) => {
    setReportForm({ ...report });
    document.getElementById('cskh-report-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteReport = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa báo cáo này?')) {
      const allReports = getStorageItem('cskhDailyReports', []);
      setStorageItem('cskhDailyReports', allReports.filter(r => r.id !== id));
      toast.success('Đã xóa báo cáo CSKH');
      setRefreshKey(k => k + 1);
    }
  };

  const resetForm = () => {
    setReportForm({
      id: null,
      date: format(new Date(), 'yyyy-MM-dd'),
      caredCustomerCount: 0, successfulCallCount: 0, messageCount: 0, revisitAppointmentCount: 0,
      satisfiedFeedbackCount: 0, followUpCount: 0, handledComplaintCount: 0, unresolvedComplaintCount: 0, note: ''
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-primary" /> 
            KPI cá nhân - Chăm Sóc Khách Hàng (CSKH)
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Quản lý mục tiêu và báo cáo tương tác, khiếu nại khách hàng</p>
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

      {!assignedKpi && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <h4 className="font-semibold">Chưa có KPI cho tháng này</h4>
            <p className="text-sm mt-1">Bạn chưa được Admin giao KPI cho tháng {selectedMonth}. Bạn vẫn có thể nhập báo cáo ngày bên dưới.</p>
          </div>
        </div>
      )}

      {/* KPI Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-2 shadow-sm border-none bg-gradient-to-br from-indigo-500 to-primary text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Target className="w-32 h-32" /></div>
          <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
            <p className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Tỷ lệ hoàn thành tổng thể KPI</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-extrabold tabular-nums tracking-tight">{overallCompletion.toFixed(1)}</span>
              <span className="text-2xl font-semibold opacity-80 mb-1">%</span>
            </div>
            <Progress value={overallCompletion} className="h-2 bg-white/20" indicatorColor="bg-white" />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md hover:border-blue-200 transition-all duration-300">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-blue-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Users className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Khách Đã Chăm Sóc</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-blue-700 tabular-nums">{totals.caredCustomer}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.caredCustomer}</span>
            </div>
            <Progress value={Math.min(progress.caredCustomer, 100)} className="h-1.5" indicatorColor={progress.caredCustomer >= 100 ? 'bg-emerald-500' : 'bg-blue-500'} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md hover:border-indigo-200 transition-all duration-300">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-indigo-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Headset className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Cuộc Gọi Thành Công</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-indigo-700 tabular-nums">{totals.successfulCall}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.successfulCall}</span>
            </div>
            <Progress value={Math.min(progress.successfulCall, 100)} className="h-1.5" indicatorColor={progress.successfulCall >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md hover:border-amber-200 transition-all duration-300">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-amber-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><MessageCircle className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tin Nhắn CSKH</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-amber-700 tabular-nums">{totals.message}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.message}</span>
            </div>
            <Progress value={Math.min(progress.message, 100)} className="h-1.5" indicatorColor={progress.message >= 100 ? 'bg-emerald-500' : 'bg-amber-500'} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md hover:border-rose-200 transition-all duration-300">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-rose-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><CalendarHeart className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Hẹn Tái Khám</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-rose-700 tabular-nums">{totals.revisit}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.revisit}</span>
            </div>
            <Progress value={Math.min(progress.revisit, 100)} className="h-1.5" indicatorColor={progress.revisit >= 100 ? 'bg-emerald-500' : 'bg-rose-500'} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md hover:border-emerald-200 transition-all duration-300">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-emerald-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Smile className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Feedback Hài Lòng</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{totals.satisfied}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.satisfied}</span>
            </div>
            <Progress value={Math.min(progress.satisfied, 100)} className="h-1.5" indicatorColor={progress.satisfied >= 100 ? 'bg-emerald-500' : 'bg-emerald-500'} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md hover:border-purple-200 transition-all duration-300">
          <CardContent className="p-4 flex flex-col justify-center h-full bg-purple-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><ShieldAlert className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Khiếu Nại Đã Xử Lý</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-purple-700 tabular-nums">{totals.handledComplaint}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.handledComplaint}</span>
            </div>
            <Progress value={Math.min(progress.handledComplaint, 100)} className="h-1.5" indicatorColor={progress.handledComplaint >= 100 ? 'bg-emerald-500' : 'bg-purple-500'} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tương tác CSKH hàng ngày</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {dailyChartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Bar dataKey="Khách" name="Khách Đã CS" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Gọi" name="Gọi Thành Công" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Tin_nhắn" name="Tin Nhắn" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                Chưa có dữ liệu tương tác để hiển thị
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Phân bổ kết quả CSKH</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {pieChartData.length > 0 ? (
              <div className="h-[300px] w-full flex flex-col items-center">
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground mt-2">
                  {pieChartData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                      <span>{entry.name}: <span className="font-medium text-foreground">{entry.value}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                Chưa có dữ liệu kết quả để hiển thị
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Report Form */}
      <Card className="shadow-sm border-border" id="cskh-report-form">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            {reportForm.id ? 'Sửa báo cáo CSKH' : 'Nhập báo cáo CSKH ngày'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveReport} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            <div className="space-y-2 lg:col-span-2 xl:col-span-1">
              <Label>Ngày báo cáo <span className="text-destructive">*</span></Label>
              <Input type="date" value={reportForm.date} onChange={e => setReportForm({...reportForm, date: e.target.value})} required />
            </div>
            
            <div className="space-y-2">
              <Label>Khách Đã CSKH</Label>
              <Input type="number" min="0" value={reportForm.caredCustomerCount} onChange={e => setReportForm({...reportForm, caredCustomerCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Cuộc Gọi Thành Công</Label>
              <Input type="number" min="0" value={reportForm.successfulCallCount} onChange={e => setReportForm({...reportForm, successfulCallCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Tin Nhắn Gửi Đi</Label>
              <Input type="number" min="0" value={reportForm.messageCount} onChange={e => setReportForm({...reportForm, messageCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Hẹn Tái Khám</Label>
              <Input type="number" min="0" value={reportForm.revisitAppointmentCount} onChange={e => setReportForm({...reportForm, revisitAppointmentCount: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Feedback Hài Lòng</Label>
              <Input type="number" min="0" value={reportForm.satisfiedFeedbackCount} onChange={e => setReportForm({...reportForm, satisfiedFeedbackCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Cần Theo Dõi Thêm</Label>
              <Input type="number" min="0" value={reportForm.followUpCount} onChange={e => setReportForm({...reportForm, followUpCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Khiếu Nại Đã Xử Lý</Label>
              <Input type="number" min="0" value={reportForm.handledComplaintCount} onChange={e => setReportForm({...reportForm, handledComplaintCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Khiếu Nại Chưa Xử Lý</Label>
              <Input type="number" min="0" value={reportForm.unresolvedComplaintCount} onChange={e => setReportForm({...reportForm, unresolvedComplaintCount: e.target.value})} className="border-rose-200 focus-visible:ring-rose-500" />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-4 xl:col-span-5">
              <Label>Ghi chú công việc / Vấn đề nổi cộm</Label>
              <Textarea 
                value={reportForm.note} 
                onChange={e => setReportForm({...reportForm, note: e.target.value})} 
                placeholder="Tình trạng khách hàng khó tính, góp ý dịch vụ..."
                className="h-16"
              />
            </div>
            
            <div className="md:col-span-2 lg:col-span-4 xl:col-span-5 flex justify-end gap-3 pt-2">
              {reportForm.id && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Hủy chỉnh sửa
                </Button>
              )}
              <Button type="submit" className="min-w-[150px]">
                {reportForm.id ? 'Cập nhật báo cáo' : 'Lưu báo cáo'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Lịch sử báo cáo CSKH ({selectedMonth})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead className="whitespace-nowrap">Ngày</TableHead>
                <TableHead className="text-center">Khách CS</TableHead>
                <TableHead className="text-center">Gọi TC</TableHead>
                <TableHead className="text-center">Tin Nhắn</TableHead>
                <TableHead className="text-center">Tái Khám</TableHead>
                <TableHead className="text-center text-emerald-600">Hài Lòng</TableHead>
                <TableHead className="text-center text-purple-600">KN Xong</TableHead>
                <TableHead className="text-center text-rose-600">KN Chưa</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-center w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Chưa có báo cáo nào trong tháng này.
                  </TableCell>
                </TableRow>
              ) : (
                myReports.map((r, idx) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{format(parseISO(r.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-center font-semibold text-blue-600">{r.caredCustomerCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-indigo-600">{r.successfulCallCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-600">{r.messageCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-rose-600">{r.revisitAppointmentCount || 0}</TableCell>
                    <TableCell className="text-center font-bold text-emerald-600">{r.satisfiedFeedbackCount || 0}</TableCell>
                    <TableCell className="text-center font-bold text-purple-600">{r.handledComplaintCount || 0}</TableCell>
                    <TableCell className="text-center font-bold text-rose-600 bg-rose-50/50">{r.unresolvedComplaintCount || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={r.note}>{r.note || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditReport(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDeleteReport(r.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

export default CskhKpiPersonalClean;
