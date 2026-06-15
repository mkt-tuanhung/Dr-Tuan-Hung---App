
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getKpiTargetsByMonth, saveKpiTarget, deleteKpiTarget, getRevenueRecords, getPagePhoneAssignments, getCustomerAppointments } from '@/utils/userStorage.js';
import { getStaffByPosition } from '@/utils/staffPositionUtils.js';
import { formatVND } from '@/utils/currencyFormat.js';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { Target, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import ResponsiveKPICard from '@/components/ResponsiveKPICard.jsx';

const KpiTelesaleAdminModule = () => {
  const { user: currentUser } = useAuth();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState((today.getMonth() + 1).toString().padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());
  const [refreshKey, setRefreshKey] = useState(0);

  const monthYearKey = `${selectedYear}-${selectedMonth}`;
  const telesaleStaff = useMemo(() => getStaffByPosition('telesale'), []);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const targets = useMemo(() => getKpiTargetsByMonth(monthYearKey).filter(t => t.targetType === 'telesale'), [monthYearKey, refreshKey]);

  const [kpiForm, setKpiForm] = useState({
    id: null, selectedUserId: '', month: monthYearKey, targetRevenue: 0, targetCloseRate: 0, note: ''
  });

  useEffect(() => {
    if (!kpiForm.id) setKpiForm(prev => ({ ...prev, month: monthYearKey }));
  }, [monthYearKey, kpiForm.id]);

  const handleKpiSubmit = (e) => {
    e.preventDefault();
    if (!kpiForm.selectedUserId || !kpiForm.month || kpiForm.targetRevenue <= 0 || kpiForm.targetCloseRate <= 0) {
      return toast.error('Vui lòng điền đầy đủ thông tin.');
    }
    const staff = telesaleStaff.find(s => s.id === kpiForm.selectedUserId);
    if (!staff) return toast.error('Không tìm thấy nhân viên.');

    saveKpiTarget({
      id: kpiForm.id || crypto.randomUUID(), employeeId: staff.employeeId?.trim().toLowerCase(), 
      userId: staff.id, fullName: staff.fullName, position: 'TELESALE', month: kpiForm.month,
      targetType: 'telesale', targetRevenue: Number(kpiForm.targetRevenue), targetCloseRate: Number(kpiForm.targetCloseRate),
      note: kpiForm.note || '', createdBy: kpiForm.id ? undefined : currentUser?.id, updatedBy: currentUser?.id,
      createdAt: kpiForm.id ? undefined : new Date().toISOString(),
    });
    toast.success('Đã lưu KPI.');
    setKpiForm({ id: null, selectedUserId: '', month: monthYearKey, targetRevenue: 0, targetCloseRate: 0, note: '' });
    refresh();
  };

  const handleEditKpi = (target) => {
    const staff = telesaleStaff.find(s => s.employeeId?.toLowerCase() === target.employeeId?.toLowerCase() || s.id === target.userId);
    setKpiForm({ id: target.id, selectedUserId: staff ? staff.id : '', month: target.month, targetRevenue: target.targetRevenue || 0, targetCloseRate: target.targetCloseRate || 0, note: target.note || '' });
    document.getElementById('giao-kpi-telesale')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteKpi = (id) => {
    if (window.confirm('Xóa KPI này?')) { deleteKpiTarget(id); toast.success('Đã xóa KPI.'); refresh(); }
  };

  const statsData = useMemo(() => {
    const allRevenues = getRevenueRecords().filter(r => r.month === monthYearKey);
    const allPhones = getPagePhoneAssignments().filter(p => p.month === monthYearKey);
    const allAppointments = getCustomerAppointments().filter(a => a.month === monthYearKey);

    return telesaleStaff.map(staff => {
      const empId = staff.employeeId?.trim().toLowerCase();
      const revenue = allRevenues.filter(r => r.telesaleEmployeeId?.trim().toLowerCase() === empId).reduce((sum, r) => sum + (Number(r.revenueAmount || r.amount) || 0), 0);
      const phones = allPhones.filter(p => p.telesaleEmployeeId?.trim().toLowerCase() === empId).reduce((sum, p) => sum + (Number(p.phoneCount) || 0), 0);
      const appointments = allAppointments.filter(a => a.telesaleEmployeeId?.trim().toLowerCase() === empId).length;
      const closeRate = phones > 0 ? (appointments / phones) * 100 : 0;
      const target = targets.find(t => t.employeeId === empId);
      
      return {
        id: staff.id, fullName: staff.fullName, employeeId: staff.employeeId,
        revenue, phones, appointments, closeRate,
        targetRevenue: target?.targetRevenue || 0, targetCloseRate: target?.targetCloseRate || 0,
        revenueProgress: target?.targetRevenue > 0 ? (revenue / target.targetRevenue) * 100 : 0,
        closeRateProgress: target?.targetCloseRate > 0 ? (closeRate / target.targetCloseRate) * 100 : 0
      };
    });
  }, [telesaleStaff, monthYearKey, targets]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.name.includes('Doanh thu') ? formatVND(entry.value) : entry.name.includes('Tỷ lệ') ? `${entry.value.toFixed(1)}%` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300 pb-12">
      <Card className="shadow-sm border-border bg-card">
        <CardContent className="p-4 flex gap-4 items-end form-mobile">
          <div className="space-y-2">
            <Label>Tháng</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => <SelectItem key={m} value={m}>Tháng {m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Năm</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2 bg-muted/20 border-b">
            <CardTitle className="text-base font-semibold">Doanh thu theo Telesale</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {statsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={(val) => `${val / 1000000}M`} tick={{fontSize: 10}} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="revenue" name="Thực tế" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="targetRevenue" name="KPI Doanh thu" fill="hsl(var(--muted-foreground)/0.3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2 bg-muted/20 border-b">
            <CardTitle className="text-base font-semibold">Tỷ lệ chốt hẹn theo Telesale</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {statsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{fontSize: 10}} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="closeRate" name="Tỷ lệ chốt (%)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="targetCloseRate" name="KPI Tỷ lệ (%)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border lg:col-span-2">
          <CardHeader className="pb-2 bg-muted/20 border-b">
            <CardTitle className="text-base font-semibold">Số điện thoại tiếp nhận vs Tổng hẹn</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-[320px]">
            {statsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="fullName" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" />
                  <YAxis tick={{fontSize: 10}} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="phones" name="SĐT Nhận" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="appointments" name="Tổng hẹn" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="hidden md:block bg-card border rounded-xl overflow-hidden shadow-sm">
         <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-center">SĐT Nhận</TableHead>
                <TableHead className="text-center">Tổng hẹn</TableHead>
                <TableHead className="text-right">Doanh thu / KPI</TableHead>
                <TableHead className="text-center">Tỷ lệ chốt / KPI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsData.map(stat => (
                <TableRow key={stat.id}>
                  <TableCell className="font-semibold">{stat.fullName}</TableCell>
                  <TableCell className="text-center text-blue-600 font-bold">{stat.phones}</TableCell>
                  <TableCell className="text-center text-emerald-600 font-bold">{stat.appointments}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-bold text-emerald-600">{formatVND(stat.revenue)}</div>
                    <div className="text-xs text-muted-foreground">/ {formatVND(stat.targetRevenue)}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-bold text-amber-600">{stat.closeRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">/ {stat.targetCloseRate}%</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
         </Table>
      </div>
      
      <div className="md:hidden space-y-4">
        <h3 className="text-lg font-bold tracking-tight">Thống kê chi tiết</h3>
        {statsData.map(stat => (
           <ResponsiveKPICard key={stat.id} t={{...stat, position: 'TELESALE'}} 
             metrics={[
               {label: 'Doanh thu', value: formatVND(stat.revenue), valueClass: 'text-emerald-600'},
               {label: 'KPI DT', value: formatVND(stat.targetRevenue)},
               {label: 'Tỷ lệ chốt', value: `${stat.closeRate.toFixed(1)}%`, valueClass: 'text-amber-600'},
               {label: 'KPI Tỷ lệ', value: `${stat.targetCloseRate}%`}
             ]}
             progress={{label: 'Tiến độ Doanh thu', percent: stat.revenueProgress}}
           />
        ))}
      </div>

      <div className="border-t border-border pt-8" id="giao-kpi-telesale">
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Giao KPI Telesale</h2>
        <Card className="shadow-sm border-border bg-card mb-6">
          <CardContent className="pt-6">
            <form onSubmit={handleKpiSubmit} className="form-mobile">
              <div className="space-y-2"><Label>Telesale <span className="text-destructive">*</span></Label><Select value={kpiForm.selectedUserId} onValueChange={v => setKpiForm({...kpiForm, selectedUserId: v})} disabled={!!kpiForm.id}><SelectTrigger className="h-11"><SelectValue placeholder="Chọn nhân sự" /></SelectTrigger><SelectContent>{telesaleStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Tháng <span className="text-destructive">*</span></Label><Input type="month" value={kpiForm.month} onChange={e => setKpiForm({...kpiForm, month: e.target.value})} className="h-11" required /></div>
              <div className="space-y-2"><Label>KPI doanh thu (VNĐ) <span className="text-destructive">*</span></Label><CurrencyInput value={kpiForm.targetRevenue} onChange={v => setKpiForm({...kpiForm, targetRevenue: v})} className="h-11 text-emerald-600 font-semibold" /></div>
              <div className="space-y-2"><Label>KPI tỷ lệ chốt (%) <span className="text-destructive">*</span></Label><Input type="number" step="0.1" value={kpiForm.targetCloseRate} onChange={e => setKpiForm({...kpiForm, targetCloseRate: e.target.value})} className="h-11" required /></div>
              <div className="space-y-2 md:col-span-2"><Label>Ghi chú</Label><Textarea value={kpiForm.note} onChange={e => setKpiForm({...kpiForm, note: e.target.value})} className="min-h-[80px]" /></div>
              <Button type="submit" className="h-12 font-bold md:col-span-2 mt-2">{kpiForm.id ? 'Cập nhật' : 'Lưu KPI'}</Button>
            </form>
          </CardContent>
        </Card>

        <h3 className="text-lg font-bold mb-4">Danh sách KPI đã giao</h3>
        <div className="hidden md:block bg-card border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40"><TableRow><TableHead>Nhân sự</TableHead><TableHead className="text-right">KPI DT</TableHead><TableHead className="text-center">KPI Tỷ lệ</TableHead><TableHead className="text-center">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>{targets.map(t => <TableRow key={t.id}><TableCell className="font-semibold">{t.fullName}</TableCell><TableCell className="text-right text-emerald-600 font-bold">{formatVND(t.targetRevenue)}</TableCell><TableCell className="text-center text-amber-600 font-bold">{t.targetCloseRate}%</TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => handleEditKpi(t)}><Pencil className="w-4 h-4"/></Button><Button variant="ghost" size="icon" className="text-rose-600" onClick={() => handleDeleteKpi(t.id)}><Trash2 className="w-4 h-4"/></Button></TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="md:hidden space-y-3 pb-safe-nav">
          {targets.length === 0 ? <div className="empty-state-mobile">Chưa có KPI nào.</div> : targets.map(t => (
            <ResponsiveKPICard key={t.id} t={t} 
              metrics={[{label: 'KPI DT', value: formatVND(t.targetRevenue), valueClass: 'text-emerald-600'}, {label: 'KPI Tỷ lệ', value: `${t.targetCloseRate}%`, valueClass: 'text-amber-600'}]}
              onEdit={handleEditKpi} onDelete={handleDeleteKpi}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default KpiTelesaleAdminModule;
