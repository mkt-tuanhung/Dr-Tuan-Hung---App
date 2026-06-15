
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getKpiTargetsByMonth, saveKpiTarget, deleteKpiTarget } from '@/utils/userStorage.js';
import { formatVND } from '@/utils/currencyFormat.js';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { Target, Pencil, Trash2, ListChecks, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { normalize, calculateSaleOfflineKPI } from '@/utils/kpiPayrollHelper.js';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#64748b'];

const safeParse = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

const KpiSaleOfflineAdminModule = () => {
  const { user: currentUser } = useAuth();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const targets = useMemo(() => getKpiTargetsByMonth(selectedMonth).filter(t => t.targetType === 'sale_offline'), [selectedMonth, refreshKey]);

  const allUsers = useMemo(() => safeParse('clinic_users'), []);
  const saleOfflineStaff = useMemo(() => {
    return allUsers.filter(u => {
      const pos = normalize(u.departmentPosition);
      return pos === 'sale offline' || pos === 'sale';
    });
  }, [allUsers]);

  const [kpiForm, setKpiForm] = useState({
    id: null,
    selectedUserId: '',
    month: selectedMonth,
    targetRevenue: 0,
    targetCloseRate: 0,
    note: ''
  });

  useEffect(() => {
    if (!kpiForm.id) {
      setKpiForm(prev => ({ ...prev, month: selectedMonth }));
    }
  }, [selectedMonth, kpiForm.id]);

  const handleKpiSubmit = (e) => {
    e.preventDefault();
    if (!kpiForm.selectedUserId || !kpiForm.month || kpiForm.targetRevenue <= 0 || kpiForm.targetCloseRate <= 0) {
      return toast.error('Vui lòng điền đầy đủ thông tin KPI (Doanh thu, Tỷ lệ chốt).');
    }

    const staff = saleOfflineStaff.find(s => s.id === kpiForm.selectedUserId);
    if (!staff) return toast.error('Không tìm thấy nhân viên.');

    const payload = {
      id: kpiForm.id || crypto.randomUUID(),
      employeeId: staff.employeeId?.trim().toLowerCase(), 
      userId: staff.id,
      fullName: staff.fullName,
      position: 'Sale Offline',
      month: kpiForm.month,
      targetType: 'sale_offline',
      targetRevenue: Number(kpiForm.targetRevenue),
      targetCloseRate: Number(kpiForm.targetCloseRate),
      note: kpiForm.note || '',
      createdBy: kpiForm.id ? undefined : currentUser?.id,
      updatedBy: currentUser?.id,
      createdAt: kpiForm.id ? undefined : new Date().toISOString(),
    };

    saveKpiTarget(payload);
    toast.success('Đã lưu KPI Sale Offline thành công.');
    
    setKpiForm({
      id: null, selectedUserId: '', month: selectedMonth,
      targetRevenue: 0, targetCloseRate: 0, note: ''
    });
    refresh();
  };

  const handleEditKpi = (target) => {
    const staff = saleOfflineStaff.find(s => s.employeeId?.toLowerCase() === target.employeeId?.toLowerCase() || s.id === target.userId);
    setKpiForm({
      id: target.id,
      selectedUserId: staff ? staff.id : '',
      month: target.month,
      targetRevenue: target.targetRevenue || 0,
      targetCloseRate: target.targetCloseRate || 0,
      note: target.note || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteKpi = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa KPI Sale Offline này không?')) {
      deleteKpiTarget(id);
      toast.success('Đã xóa KPI Sale Offline.');
      refresh();
    }
  };

  const saleOfflineKPIData = useMemo(() => {
    const appointments = safeParse('customerAppointments');
    const revenues = safeParse('revenueRecords');

    return saleOfflineStaff.map(user => {
      const kpiMetrics = calculateSaleOfflineKPI(user, selectedMonth, appointments, revenues);
      const target = targets.find(t => normalize(t.employeeId) === normalize(user.employeeId) || normalize(t.userId) === normalize(user.id));
      
      const targetRevenue = target?.targetRevenue || 0;
      const targetCloseRate = target?.targetCloseRate || 0;

      const revenueProgress = targetRevenue > 0 ? (kpiMetrics.totalRevenue / targetRevenue) * 100 : 0;
      const closeRateProgress = targetCloseRate > 0 ? (kpiMetrics.actualCloseRate / targetCloseRate) * 100 : 0;

      return {
        ...user,
        ...kpiMetrics,
        targetRevenue,
        targetCloseRate,
        revenueProgress,
        closeRateProgress
      };
    });
  }, [saleOfflineStaff, selectedMonth, targets]);

  const pieData = useMemo(() => {
    let deposit = 0, surgery = 0, bong = 0, others = 0;
    saleOfflineKPIData.forEach(s => {
      deposit += s.depositCount;
      surgery += s.surgeryCount;
      bong += s.bongCount;
      others += Math.max(0, s.totalAppointments - (s.depositCount + s.surgeryCount + s.bongCount));
    });
    return [
      { name: 'Khách cọc', value: deposit },
      { name: 'Khách phẫu thuật', value: surgery },
      { name: 'Khách bong', value: bong },
      { name: 'Chờ tư vấn/Khác', value: others }
    ].filter(d => d.value > 0);
  }, [saleOfflineKPIData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.name.includes('Doanh thu') || entry.name.includes('Thực tế') || entry.name.includes('KPI Doanh') ? formatVND(entry.value) : entry.name.includes('Tỷ lệ') ? `${entry.value.toFixed(1)}%` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center justify-between border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> Quản lý KPI Sale Offline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Phân tích hiệu suất và thiết lập mục tiêu cho bộ phận Sale Offline</p>
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

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid w-full sm:w-auto grid-cols-2 max-w-[400px]">
          <TabsTrigger value="list" className="flex gap-2"><ListChecks className="w-4 h-4" /> Giao KPI & Danh sách</TabsTrigger>
          <TabsTrigger value="analysis" className="flex gap-2"><Activity className="w-4 h-4" /> Phân tích</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base font-medium">
                {kpiForm.id ? 'Chỉnh sửa KPI Sale Offline' : 'Tạo mới KPI Sale Offline'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleKpiSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nhân viên Sale Offline <span className="text-destructive">*</span></Label>
                  <Select value={kpiForm.selectedUserId} onValueChange={v => setKpiForm({...kpiForm, selectedUserId: v})} disabled={!!kpiForm.id}>
                    <SelectTrigger><SelectValue placeholder="Chọn nhân sự" /></SelectTrigger>
                    <SelectContent>
                      {saleOfflineStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tháng <span className="text-destructive">*</span></Label>
                  <Input 
                    type="month" 
                    value={kpiForm.month} 
                    onChange={e => setKpiForm({...kpiForm, month: e.target.value})} 
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label>KPI doanh thu (VNĐ) <span className="text-destructive">*</span></Label>
                  <CurrencyInput 
                    value={kpiForm.targetRevenue} 
                    onChange={v => setKpiForm({...kpiForm, targetRevenue: v})} 
                    className="text-emerald-600 font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <Label>KPI tỷ lệ chốt khách mục tiêu (%) <span className="text-destructive">*</span></Label>
                  <Input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="100"
                    value={kpiForm.targetCloseRate} 
                    onChange={e => setKpiForm({...kpiForm, targetCloseRate: e.target.value})} 
                    placeholder="Ví dụ: 30"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Ghi chú</Label>
                  <Textarea 
                    value={kpiForm.note} 
                    onChange={e => setKpiForm({...kpiForm, note: e.target.value})} 
                    className="min-h-[60px]"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                  {kpiForm.id && (
                    <Button type="button" variant="outline" onClick={() => setKpiForm({
                      id: null, selectedUserId: '', month: selectedMonth, targetRevenue: 0, targetCloseRate: 0, note: ''
                    })}>Hủy</Button>
                  )}
                  <Button type="submit" className="min-w-[150px]">{kpiForm.id ? 'Cập nhật KPI' : 'Lưu KPI Sale Offline'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-base font-medium">Bảng thông số Sale Offline ({selectedMonth})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto rounded-b-xl">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-12 text-center">STT</TableHead>
                    <TableHead>Nhân sự</TableHead>
                    <TableHead className="text-center">Tổng hẹn</TableHead>
                    <TableHead className="text-center text-rose-600">Bong</TableHead>
                    <TableHead className="text-center text-blue-600">Cọc</TableHead>
                    <TableHead className="text-center text-emerald-600">Phẫu thuật</TableHead>
                    <TableHead className="text-center bg-muted/50">Tỷ lệ chốt (%)</TableHead>
                    <TableHead className="text-right">Doanh thu (VND)</TableHead>
                    <TableHead className="text-right">Upsale (VND)</TableHead>
                    <TableHead className="text-right bg-primary/5">Hoa hồng (VND)</TableHead>
                    <TableHead className="text-center w-24">Thao tác KPI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleOfflineKPIData.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Không có dữ liệu nhân sự.</TableCell></TableRow>
                  ) : (
                    saleOfflineKPIData.map((row, idx) => {
                      const targetRecord = targets.find(t => normalize(t.employeeId) === normalize(row.employeeId) || normalize(t.userId) === normalize(row.id));
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-primary">{row.fullName || row.name}</TableCell>
                          <TableCell className="text-center font-bold">{row.totalAppointments}</TableCell>
                          <TableCell className="text-center font-medium text-rose-600">{row.bongCount}</TableCell>
                          <TableCell className="text-center font-medium text-blue-600">{row.depositCount}</TableCell>
                          <TableCell className="text-center font-medium text-emerald-600">{row.surgeryCount}</TableCell>
                          <TableCell className="text-center font-bold bg-muted/20">{(row.actualCloseRate).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-bold text-purple-700 tabular-nums">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(row.totalRevenue)}</TableCell>
                          <TableCell className="text-right font-bold text-orange-600 tabular-nums">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(row.totalUpsale)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-700 bg-primary/5 tabular-nums">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(row.saleOfflineCommissionTotal)}</TableCell>
                          <TableCell className="text-center">
                            {targetRecord ? (
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditKpi(targetRecord)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDeleteKpi(targetRecord.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Chưa giao</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="shadow-sm border-border lg:col-span-2">
              <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold">Doanh thu theo Sale Offline</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 h-[320px]">
                {saleOfflineKPIData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={saleOfflineKPIData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="fullName" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" />
                      <YAxis tickFormatter={(val) => `${val / 1000000}M`} tick={{fontSize: 10}} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="totalRevenue" name="Thực tế" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="targetRevenue" name="KPI Doanh thu" fill="hsl(var(--muted-foreground)/0.3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold">Tỷ lệ Cọc/Phẫu thuật/Bong</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 h-[320px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border lg:col-span-3">
              <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base font-semibold">Tỷ lệ chốt theo Sale Offline</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 h-[320px]">
                {saleOfflineKPIData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={saleOfflineKPIData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="fullName" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" />
                      <YAxis tickFormatter={(val) => `${val}%`} tick={{fontSize: 10}} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="actualCloseRate" name="Tỷ lệ đạt (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="targetCloseRate" name="KPI Tỷ lệ (%)" fill="hsl(var(--muted-foreground)/0.3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KpiSaleOfflineAdminModule;
