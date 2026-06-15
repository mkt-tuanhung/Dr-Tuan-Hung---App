
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Target, Megaphone, Users, CalendarCheck, Banknote, Percent, TrendingUp, DollarSign, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';
import { getKpiTargets } from '@/utils/userStorage.js';
import { formatVND } from '@/utils/currencyFormat.js';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

const PLATFORM_COLORS = {
  'Facebook': '#1877F2',
  'TikTok': '#000000',
  'Google': '#EA4335',
  'Khác': '#8B5CF6'
};

const MarketingKpiPersonalClean = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [refreshKey, setRefreshKey] = useState(0);

  const [reportForm, setReportForm] = useState({
    id: null,
    date: format(new Date(), 'yyyy-MM-dd'),
    platform: 'Facebook',
    campaignName: '',
    adSpend: 0,
    impressions: 0,
    reach: 0,
    messageCount: 0,
    leadCount: 0,
    appointmentCount: 0,
    adsRevenue: 0,
    note: ''
  });

  const currentEmployeeId = currentUser?.employeeId?.trim().toLowerCase();

  // Load KPI Target
  const assignedKpi = useMemo(() => {
    const allTargets = getKpiTargets();
    return allTargets.find(kpi => 
      kpi.targetType?.trim().toLowerCase() === 'marketing' && 
      kpi.employeeId?.trim().toLowerCase() === currentEmployeeId && 
      kpi.month === selectedMonth
    );
  }, [selectedMonth, currentEmployeeId, refreshKey]);

  // Load Daily Reports
  const myReports = useMemo(() => {
    const allReports = JSON.parse(localStorage.getItem('marketingDailyReports') || '[]');
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
      adSpend: acc.adSpend + (Number(r.adSpend) || 0),
      impressions: acc.impressions + (Number(r.impressions) || 0),
      reach: acc.reach + (Number(r.reach) || 0),
      messages: acc.messages + (Number(r.messageCount) || 0),
      leads: acc.leads + (Number(r.leadCount) || 0),
      appointments: acc.appointments + (Number(r.appointmentCount) || 0),
      adsRevenue: acc.adsRevenue + (Number(r.adsRevenue) || 0),
    }), { adSpend: 0, impressions: 0, reach: 0, messages: 0, leads: 0, appointments: 0, adsRevenue: 0 });
  }, [myReports]);

  // Derived Metrics
  const costPerLead = totals.leads > 0 ? totals.adSpend / totals.leads : 0;
  const appointmentRate = totals.leads > 0 ? (totals.appointments / totals.leads) * 100 : 0;
  const roas = totals.adSpend > 0 ? totals.adsRevenue / totals.adSpend : 0;

  // Target values
  const targets = {
    leads: Number(assignedKpi?.targetLeadCount) || 0,
    appointments: Number(assignedKpi?.targetAppointmentCount) || 0,
    adsRevenue: Number(assignedKpi?.targetAdsRevenue) || 0,
    roas: Number(assignedKpi?.targetRoas) || 0,
    maxCpl: Number(assignedKpi?.maxCostPerLead) || 0,
    adSpend: Number(assignedKpi?.targetAdSpend) || 0,
  };

  // Calculate Progresses
  const calcProgress = (total, target) => target > 0 ? (total / target) * 100 : 0;
  
  const progress = {
    leads: calcProgress(totals.leads, targets.leads),
    appointments: calcProgress(totals.appointments, targets.appointments),
    adsRevenue: calcProgress(totals.adsRevenue, targets.adsRevenue),
    roas: calcProgress(roas, targets.roas),
    cpl: targets.maxCpl > 0 ? (costPerLead > 0 ? (targets.maxCpl / costPerLead) * 100 : 100) : 0,
  };

  // Overall Completion Calculation
  const overallCompletion = useMemo(() => {
    const validMetrics = [
      targets.leads > 0 ? progress.leads : null,
      targets.appointments > 0 ? progress.appointments : null,
      targets.adsRevenue > 0 ? progress.adsRevenue : null,
      targets.roas > 0 ? progress.roas : null,
      targets.maxCpl > 0 ? progress.cpl : null,
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
        daysMap[day] = { name: day, Leads: 0, Appointments: 0, AdSpend: 0 };
      }
      daysMap[day].Leads += Number(r.leadCount) || 0;
      daysMap[day].Appointments += Number(r.appointmentCount) || 0;
      daysMap[day].AdSpend += (Number(r.adSpend) || 0) / 1000; // Display in thousands for better scale
    });
    return Object.values(daysMap).reverse();
  }, [myReports]);

  const platformChartData = useMemo(() => {
    const platMap = {};
    myReports.forEach(r => {
      const p = r.platform || 'Khác';
      if (!platMap[p]) platMap[p] = { name: p, spend: 0, leads: 0 };
      platMap[p].spend += Number(r.adSpend) || 0;
      platMap[p].leads += Number(r.leadCount) || 0;
    });
    return Object.values(platMap).sort((a, b) => b.spend - a.spend);
  }, [myReports]);

  const handleSaveReport = (e) => {
    e.preventDefault();
    if (!reportForm.date) return toast.error('Vui lòng chọn ngày báo cáo');
    if (!reportForm.platform) return toast.error('Vui lòng chọn Nền tảng');

    const allReports = JSON.parse(localStorage.getItem('marketingDailyReports') || '[]');
    const reportMonth = reportForm.date.substring(0, 7);
    
    const payload = {
      ...reportForm,
      month: reportMonth,
      employeeId: currentUser.employeeId,
      fullName: currentUser.fullName,
      adSpend: Number(reportForm.adSpend),
      impressions: Number(reportForm.impressions),
      reach: Number(reportForm.reach),
      messageCount: Number(reportForm.messageCount),
      leadCount: Number(reportForm.leadCount),
      appointmentCount: Number(reportForm.appointmentCount),
      adsRevenue: Number(reportForm.adsRevenue),
      updatedAt: new Date().toISOString()
    };

    if (reportForm.id) {
      const idx = allReports.findIndex(r => r.id === reportForm.id);
      if (idx !== -1) {
        allReports[idx] = { ...allReports[idx], ...payload };
        toast.success('Cập nhật báo cáo Marketing thành công');
      }
    } else {
      payload.id = crypto.randomUUID();
      payload.createdAt = new Date().toISOString();
      allReports.push(payload);
      toast.success('Thêm báo cáo Marketing mới thành công');
    }

    localStorage.setItem('marketingDailyReports', JSON.stringify(allReports));
    resetForm();
    setRefreshKey(k => k + 1);
  };

  const handleEditReport = (report) => {
    setReportForm({ ...report });
    document.getElementById('mkt-report-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteReport = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa báo cáo này?')) {
      const allReports = JSON.parse(localStorage.getItem('marketingDailyReports') || '[]');
      localStorage.setItem('marketingDailyReports', JSON.stringify(allReports.filter(r => r.id !== id)));
      toast.success('Đã xóa báo cáo Marketing');
      setRefreshKey(k => k + 1);
    }
  };

  const resetForm = () => {
    setReportForm({
      id: null,
      date: format(new Date(), 'yyyy-MM-dd'),
      platform: 'Facebook', campaignName: '', adSpend: 0, impressions: 0, reach: 0,
      messageCount: 0, leadCount: 0, appointmentCount: 0, adsRevenue: 0, note: ''
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> 
            KPI cá nhân - Marketing
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Theo dõi hiệu suất quảng cáo, Lead và Doanh thu ADS</p>
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
            <h4 className="font-semibold">Bạn chưa được giao KPI Marketing cho tháng này</h4>
            <p className="text-sm mt-1">Admin chưa cập nhật chỉ tiêu tháng {selectedMonth}. Tuy nhiên bạn vẫn có thể nhập báo cáo ngày bên dưới.</p>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-2 shadow-sm border-none bg-gradient-to-br from-indigo-500 to-purple-600 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500"><Target className="w-32 h-32" /></div>
          <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
            <p className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Tỷ lệ hoàn thành tổng thể KPI</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-extrabold tabular-nums tracking-tight">{overallCompletion.toFixed(1)}</span>
              <span className="text-2xl font-semibold opacity-80 mb-1">%</span>
            </div>
            <Progress value={overallCompletion} className="h-2 bg-white/20" indicatorColor="bg-white" />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><DollarSign className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Chi phí Quảng Cáo</p>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold text-rose-600 tabular-nums truncate" title={formatVND(totals.adSpend)}>{formatVND(totals.adSpend)}</span>
            </div>
            {targets.adSpend > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Ngân sách: {formatVND(targets.adSpend)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Banknote className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Doanh thu ADS</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-emerald-600 tabular-nums truncate" title={formatVND(totals.adsRevenue)}>{formatVND(totals.adsRevenue)}</span>
            </div>
            <Progress value={Math.min(progress.adsRevenue, 100)} className="h-1.5" indicatorColor={progress.adsRevenue >= 100 ? 'bg-emerald-500' : 'bg-emerald-500'} />
            <p className="text-xs text-muted-foreground mt-2">Mục tiêu: {formatVND(targets.adsRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng Leads / Số ĐT</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-blue-600 tabular-nums">{totals.leads.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.leads.toLocaleString()}</span>
            </div>
            <Progress value={Math.min(progress.leads, 100)} className="h-1.5" indicatorColor={progress.leads >= 100 ? 'bg-emerald-500' : 'bg-blue-500'} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><CalendarCheck className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Lịch hẹn Marketing</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold text-indigo-600 tabular-nums">{totals.appointments.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {targets.appointments.toLocaleString()}</span>
            </div>
            <Progress value={Math.min(progress.appointments, 100)} className="h-1.5" indicatorColor={progress.appointments >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Chi phí / Lead (CPL)</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className={`text-2xl font-bold tabular-nums truncate ${targets.maxCpl > 0 && costPerLead > targets.maxCpl ? 'text-rose-600' : 'text-amber-600'}`} title={formatVND(costPerLead)}>
                {formatVND(costPerLead)}
              </span>
            </div>
            <Progress value={Math.min(progress.cpl, 100)} className="h-1.5" indicatorColor={progress.cpl >= 100 ? 'bg-emerald-500' : 'bg-amber-500'} />
            <p className="text-xs text-muted-foreground mt-2">Tối đa: {formatVND(targets.maxCpl)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Percent className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Hiệu suất (ROAS)</p>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className={`text-2xl font-bold tabular-nums ${roas >= targets.roas ? 'text-emerald-600' : 'text-purple-600'}`}>
                {roas.toFixed(2)}
              </span>
            </div>
            <Progress value={Math.min(progress.roas, 100)} className="h-1.5" indicatorColor={progress.roas >= 100 ? 'bg-emerald-500' : 'bg-purple-500'} />
            <p className="text-xs text-muted-foreground mt-2">Mục tiêu: {targets.roas.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Tương tác và Chuyển đổi hàng ngày</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {dailyChartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAppts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="Leads" name="Tổng Leads" stroke="#3b82f6" strokeWidth={3} fill="url(#colorLeads)" />
                    <Area yAxisId="left" type="monotone" dataKey="Appointments" name="Lịch Hẹn" stroke="#6366f1" strokeWidth={3} fill="url(#colorAppts)" />
                    <Bar yAxisId="right" dataKey="AdSpend" name="Chi phí (K)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={30} opacity={0.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                Chưa có dữ liệu biểu đồ
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Phân bổ Nền tảng</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {platformChartData.length > 0 ? (
              <div className="h-[300px] w-full flex flex-col items-center">
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={platformChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="spend"
                      nameKey="name"
                      stroke="none"
                    >
                      {platformChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PLATFORM_COLORS[entry.name] || PLATFORM_COLORS['Khác']} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatVND(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground mt-2">
                  {platformChartData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[entry.name] || PLATFORM_COLORS['Khác'] }}></div>
                      <span>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                Chưa có dữ liệu nền tảng
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Report Form */}
      <Card className="shadow-sm border-border" id="mkt-report-form">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            {reportForm.id ? 'Sửa báo cáo Marketing' : 'Nhập báo cáo Marketing ngày'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveReport} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="space-y-2">
              <Label>Ngày báo cáo <span className="text-destructive">*</span></Label>
              <Input type="date" value={reportForm.date} onChange={e => setReportForm({...reportForm, date: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Nền tảng <span className="text-destructive">*</span></Label>
              <Select value={reportForm.platform} onValueChange={v => setReportForm({...reportForm, platform: v})}>
                <SelectTrigger><SelectValue placeholder="Chọn nền tảng" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tên Chiến dịch / Campaign</Label>
              <Input type="text" value={reportForm.campaignName} onChange={e => setReportForm({...reportForm, campaignName: e.target.value})} placeholder="Tên chiến dịch quảng cáo" />
            </div>
            
            <div className="space-y-2">
              <Label>Chi phí Quảng cáo (VNĐ)</Label>
              <Input type="number" min="0" value={reportForm.adSpend} onChange={e => setReportForm({...reportForm, adSpend: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Doanh thu ADS (VNĐ)</Label>
              <Input type="number" min="0" value={reportForm.adsRevenue} onChange={e => setReportForm({...reportForm, adsRevenue: e.target.value})} className="border-emerald-200 focus-visible:ring-emerald-500" />
            </div>
            <div className="space-y-2">
              <Label>Lượt hiển thị (Impressions)</Label>
              <Input type="number" min="0" value={reportForm.impressions} onChange={e => setReportForm({...reportForm, impressions: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Lượt tiếp cận (Reach)</Label>
              <Input type="number" min="0" value={reportForm.reach} onChange={e => setReportForm({...reportForm, reach: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Số tin nhắn</Label>
              <Input type="number" min="0" value={reportForm.messageCount} onChange={e => setReportForm({...reportForm, messageCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Số Leads / SĐT</Label>
              <Input type="number" min="0" value={reportForm.leadCount} onChange={e => setReportForm({...reportForm, leadCount: e.target.value})} className="border-blue-200 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Số Lịch hẹn (Appointments)</Label>
              <Input type="number" min="0" value={reportForm.appointmentCount} onChange={e => setReportForm({...reportForm, appointmentCount: e.target.value})} className="border-indigo-200 focus-visible:ring-indigo-500" />
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-4">
              <Label>Ghi chú / Nhận xét</Label>
              <Textarea 
                value={reportForm.note} 
                onChange={e => setReportForm({...reportForm, note: e.target.value})} 
                placeholder="Đánh giá chất lượng lead, nguyên nhân biến động chi phí..."
                className="h-16"
              />
            </div>
            
            <div className="md:col-span-2 xl:col-span-4 flex justify-end gap-3 pt-2">
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
          <CardTitle className="text-base font-semibold">Lịch sử báo cáo Marketing ({selectedMonth})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead className="whitespace-nowrap">Ngày</TableHead>
                <TableHead>Nền tảng/Chiến dịch</TableHead>
                <TableHead className="text-right">Chi phí</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Hẹn</TableHead>
                <TableHead className="text-right text-emerald-600">DT ADS</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
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
                myReports.map((r, idx) => {
                  const rAdSpend = Number(r.adSpend) || 0;
                  const rLeads = Number(r.leadCount) || 0;
                  const rRevenue = Number(r.adsRevenue) || 0;
                  const rCpl = rLeads > 0 ? rAdSpend / rLeads : 0;
                  const rRoas = rAdSpend > 0 ? rRevenue / rAdSpend : 0;
                  
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{format(parseISO(r.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[r.platform] || PLATFORM_COLORS['Khác'] }}></div>
                          {r.platform}
                        </div>
                        <div className="text-xs text-muted-foreground max-w-[150px] truncate" title={r.campaignName}>{r.campaignName || '-'}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-rose-600 font-medium">{formatVND(rAdSpend)}</TableCell>
                      <TableCell className="text-center tabular-nums text-blue-600 font-bold">{rLeads}</TableCell>
                      <TableCell className="text-center tabular-nums text-indigo-600 font-bold">{r.appointmentCount || 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 font-bold">{formatVND(rRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{formatVND(rCpl)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground text-xs">{rRoas.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate" title={r.note}>{r.note || '-'}</TableCell>
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingKpiPersonalClean;
