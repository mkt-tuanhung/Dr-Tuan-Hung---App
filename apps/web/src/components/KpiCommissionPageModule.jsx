
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUsers, getPageDailyReports, getKpiTargets, saveKpiTarget } from '@/utils/userStorage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MessageSquare, Phone, Percent, Coins, Target } from 'lucide-react';

const KpiCommissionPageModule = () => {
  const { user: currentUser } = useAuth();
  
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState((today.getMonth() + 1).toString().padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');

  const [formState, setFormState] = useState({
    employeeId: '',
    targetPhones: '',
    targetConversionRate: '',
    note: ''
  });

  const monthYearKey = `${selectedYear}-${selectedMonth}`;

  // Data fetching
  const users = getUsers();
  const trucPageStaff = users.filter(u => u.role === 'Nhân viên' && u.departmentPosition?.toLowerCase().trim() === 'trực page');
  
  const reports = getPageDailyReports(monthYearKey);
  const targets = getKpiTargets(monthYearKey);

  // Summaries
  const summaries = useMemo(() => {
    let rawSummaries = trucPageStaff.map(emp => {
      const empReports = reports.filter(r => r.employeeId === emp.id);
      const empTarget = targets.find(t => t.employeeId === emp.id && t.targetType === 'page') || {};

      const totalMessages = empReports.reduce((sum, r) => sum + (Number(r.totalMessages) || 0), 0);
      const totalPhones = empReports.reduce((sum, r) => sum + (Number(r.totalPhones) || 0), 0);
      const conversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
      const commissionAmount = totalPhones * 20000;
      
      const targetPhones = Number(empTarget.targetPhones) || 0;
      const kpiCompletionRate = targetPhones > 0 ? (totalPhones / targetPhones) * 100 : 0;

      return {
        employee: emp,
        totalMessages,
        totalPhones,
        conversionRate,
        commissionAmount,
        targetPhones,
        targetConversionRate: empTarget.targetConversionRate || 0,
        kpiCompletionRate
      };
    });

    if (selectedEmployeeFilter !== 'all') {
      rawSummaries = rawSummaries.filter(s => s.employee.id === selectedEmployeeFilter);
    }
    
    return rawSummaries;
  }, [trucPageStaff, reports, targets, selectedEmployeeFilter, monthYearKey]);

  const overallStats = summaries.reduce((acc, curr) => {
    acc.totalMessages += curr.totalMessages;
    acc.totalPhones += curr.totalPhones;
    acc.totalCommission += curr.commissionAmount;
    return acc;
  }, { totalMessages: 0, totalPhones: 0, totalCommission: 0 });

  const overallConversion = overallStats.totalMessages > 0 
    ? (overallStats.totalPhones / overallStats.totalMessages) * 100 
    : 0;

  const handleSaveKpi = (e) => {
    e.preventDefault();
    if (!formState.employeeId || !formState.targetPhones) {
      toast.error('Vui lòng chọn nhân viên và nhập số điện thoại mục tiêu.');
      return;
    }

    const targetEmp = trucPageStaff.find(u => u.id === formState.employeeId);
    
    saveKpiTarget({
      employeeId: targetEmp.id,
      fullName: targetEmp.fullName,
      position: targetEmp.departmentPosition,
      month: monthYearKey,
      targetType: 'page',
      targetPhones: Number(formState.targetPhones),
      targetConversionRate: Number(formState.targetConversionRate) || 0,
      note: formState.note,
      createdBy: currentUser?.id,
      updatedBy: currentUser?.id
    });

    toast.success('Đã giao KPI Trực page.');
    setFormState({ employeeId: '', targetPhones: '', targetConversionRate: '', note: '' });
  };

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(val || 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="shadow-sm border-border bg-card">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-32">
            <Label className="text-xs mb-1 block text-muted-foreground">Tháng</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => (
                  <SelectItem key={m} value={m}>Tháng {m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-28">
            <Label className="text-xs mb-1 block text-muted-foreground">Năm</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-56">
            <Label className="text-xs mb-1 block text-muted-foreground">Lọc theo nhân sự</Label>
            <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
              <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhân sự</SelectItem>
                {trucPageStaff.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><MessageSquare className="w-6 h-6" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{overallStats.totalMessages}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tổng tin nhắn</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Phone className="w-6 h-6" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">{overallStats.totalPhones}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tổng số điện thoại</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Percent className="w-6 h-6" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{overallConversion.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tỷ lệ xin số</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-emerald-50/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl"><Coins className="w-6 h-6" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-emerald-700">{formatCurrency(overallStats.totalCommission)} đ</p>
              <p className="text-xs text-emerald-700/80 font-medium uppercase tracking-wider">Hoa hồng tạm tính</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Assignment Form */}
        <Card className="lg:col-span-1 shadow-sm border-border h-fit">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Giao KPI
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveKpi} className="space-y-4">
              <div className="space-y-2">
                <Label>Nhân viên <span className="text-destructive">*</span></Label>
                <Select value={formState.employeeId} onValueChange={v => setFormState({...formState, employeeId: v})}>
                  <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                  <SelectContent>
                    {trucPageStaff.map(e => <SelectItem key={e.id} value={e.id}>{e.employeeId} - {e.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>KPI số điện thoại <span className="text-destructive">*</span></Label>
                <Input 
                  type="number" 
                  min="0"
                  value={formState.targetPhones}
                  onChange={e => setFormState({...formState, targetPhones: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>KPI tỷ lệ xin số mục tiêu (%)</Label>
                <Input 
                  type="number" 
                  min="0"
                  max="100"
                  step="0.1"
                  value={formState.targetConversionRate}
                  onChange={e => setFormState({...formState, targetConversionRate: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea 
                  value={formState.note}
                  onChange={e => setFormState({...formState, note: e.target.value})}
                  className="h-20"
                />
              </div>

              <Button type="submit" className="w-full transition-all duration-200 active:scale-[0.98]">
                Lưu KPI
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Staff Summary Table */}
        <Card className="lg:col-span-3 shadow-sm border-border">
          <CardContent className="p-0 overflow-x-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Nhân sự</TableHead>
                  <TableHead className="text-center">Tin nhắn</TableHead>
                  <TableHead className="text-center">SĐT</TableHead>
                  <TableHead className="text-center">Tỷ lệ (%)</TableHead>
                  <TableHead className="text-center text-primary bg-primary/5">KPI SĐT</TableHead>
                  <TableHead className="text-center text-primary bg-primary/5">% Hoàn thành</TableHead>
                  <TableHead className="text-right text-emerald-700">Hoa hồng (VNĐ)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Không có dữ liệu nhân sự.</TableCell>
                  </TableRow>
                ) : (
                  summaries.map((summary, idx) => (
                    <TableRow key={summary.employee.id} className="transition-colors hover:bg-muted/30 duration-200">
                      <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{summary.employee.fullName}</div>
                        <div className="text-xs text-muted-foreground">{summary.employee.employeeId}</div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{summary.totalMessages}</TableCell>
                      <TableCell className="text-center tabular-nums font-semibold">{summary.totalPhones}</TableCell>
                      <TableCell className="text-center tabular-nums">{summary.conversionRate.toFixed(1)}%</TableCell>
                      
                      <TableCell className="text-center tabular-nums font-bold text-primary bg-primary/5 border-l border-primary/10">
                        {summary.targetPhones}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-bold text-primary bg-primary/5 border-r border-primary/10">
                        {summary.kpiCompletionRate.toFixed(1)}%
                      </TableCell>
                      
                      <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                        {formatCurrency(summary.commissionAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiCommissionPageModule;
