
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import ResponsiveDataList from '@/components/ResponsiveDataList.jsx';
import { MessageSquare, PhoneCall, Percent, Target, Banknote, Pencil, Trash2, RotateCcw, Link2, Calendar } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';
import { getStaffByPosition } from '@/utils/staffPositionUtils.js';
import { getPagePhoneAssignments, savePagePhoneAssignment, deletePagePhoneAssignment, updatePagePhoneAssignment } from '@/utils/userStorage.js';
import { getKpiTargetsFromSupabase, getPageDailyReportsFromSupabase, saveKpiTargetToSupabase, softDeleteKpiTargetFromSupabase } from '@/services/dataService.js';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

const COMMISSION_PER_PHONE = 20000;

const resolveEmployeeId = (value, staffList) => {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase();
  const found = staffList.find(s =>
    String(s.employeeId || '').trim().toLowerCase() === normalized ||
    String(s.id || '').trim().toLowerCase() === normalized
  );
  return found?.employeeId || value;
};

const matchEmployee = (idA, idB, employeeIdA, employeeIdB) => {
  const normalize = (val) => String(val || '').trim().toLowerCase();
  const a1 = normalize(idA);
  const a2 = normalize(employeeIdA);
  const b1 = normalize(idB);
  const b2 = normalize(employeeIdB);

  return (a1 === b1 && a1 !== '') || 
         (a1 === b2 && a1 !== '') || 
         (a2 === b1 && a2 !== '') || 
         (a2 === b2 && a2 !== '');
};

const KpiPageAdminModule = () => {
  const { user: currentUser } = useAuth();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [filterEmployeeId, setFilterEmployeeId] = useState('all');
  
  const [allTargets, setAllTargets] = useState([]);
  const [allReports, setAllReports] = useState([]);

  const [kpiForm, setKpiForm] = useState({
    id: null,
    employeeId: '',
    targetPhones: 0,
    targetConversionRate: 0,
    note: ''
  });

  const [phoneAssignForm, setPhoneAssignForm] = useState({
    id: null,
    date: format(new Date(), 'yyyy-MM-dd'),
    pageEmployeeId: '',
    telesaleEmployeeId: '',
    phoneCount: 0,
    note: ''
  });

  const loadData = useCallback(async () => {
    const targets = await getKpiTargetsFromSupabase();
    setAllTargets(targets);
    const reports = await getPageDailyReportsFromSupabase();
    setAllReports(reports);
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('supabase-data-updated', loadData);
    return () => window.removeEventListener('supabase-data-updated', loadData);
  }, [loadData]);

  const handleResetFilter = () => {
    setMonth(format(new Date(), 'yyyy-MM'));
    setFilterEmployeeId('all');
  };

  const pageStaff = useMemo(() => getStaffByPosition('trực page'), []);
  const telesaleStaff = useMemo(() => getStaffByPosition('telesale'), []);
  const allPhoneAssignments = useMemo(() => getPagePhoneAssignments(), []);

  const currentTargets = useMemo(() => 
    allTargets.filter(t => t.month === month && t.targetType === 'page'),
  [allTargets, month]);

  const currentReports = useMemo(() => 
    allReports.filter(r => r.date && r.date.startsWith(month)),
  [allReports, month]);

  const currentPhoneAssignments = useMemo(() => 
    allPhoneAssignments.filter(a => 
      a.month === month || String(a.date || '').substring(0, 7) === month
    ).sort((a, b) => b.date.localeCompare(a.date)),
  [allPhoneAssignments, month]);

  const summaries = useMemo(() => {
    return pageStaff.map(emp => {
      const empReports = currentReports.filter(r => matchEmployee(r.employeeId, emp.id, r.employeeId, emp.employeeId));
      const totalMessages = empReports.reduce((sum, r) => sum + (Number(r.totalMessages) || Number(r.messagesCount) || 0), 0);
      const totalPhones = empReports.reduce((sum, r) => sum + (Number(r.totalPhones) || Number(r.phonesReceived) || 0), 0);
      const commission = totalPhones * COMMISSION_PER_PHONE;
      const actualConversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;

      const target = currentTargets.find(t => matchEmployee(t.employeeId, emp.id, t.employeeId, emp.employeeId));
      const targetPhones = target ? (Number(target.targetPhones) || 0) : 0;
      const targetConversionRate = target ? (Number(target.targetConversionRate) || 0) : 0;
      const completionPercent = targetPhones > 0 ? (totalPhones / targetPhones) * 100 : 0;
      const phonesRemaining = Math.max(0, targetPhones - totalPhones);

      return {
        ...emp,
        totalMessages,
        totalPhones,
        commission,
        actualConversionRate,
        targetPhones,
        targetConversionRate,
        completionPercent,
        phonesRemaining,
        hasTarget: !!target,
        targetId: target?.id,
        targetNote: target?.note
      };
    });
  }, [pageStaff, currentReports, currentTargets]);

  const filteredSummaries = useMemo(() => {
    if (filterEmployeeId === 'all') return summaries;
    return summaries.filter(s => s.id === filterEmployeeId || s.employeeId === filterEmployeeId);
  }, [summaries, filterEmployeeId]);

  const stats = useMemo(() => {
    const totalMessages = filteredSummaries.reduce((s, e) => s + e.totalMessages, 0);
    const totalPhones = filteredSummaries.reduce((s, e) => s + e.totalPhones, 0);
    const avgConversion = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
    const totalKPIAssigned = filteredSummaries.reduce((s, e) => s + e.targetPhones, 0);
    const totalCommission = filteredSummaries.reduce((s, e) => s + e.commission, 0);
    
    const staffWithTargets = filteredSummaries.filter(s => s.hasTarget);
    const avgCompletion = staffWithTargets.length > 0 
      ? staffWithTargets.reduce((s, e) => s + e.completionPercent, 0) / staffWithTargets.length 
      : 0;

    return { totalMessages, totalPhones, avgConversion, totalKPIAssigned, totalCommission, avgCompletion };
  }, [filteredSummaries]);

  const handleSaveKpi = async (e) => {
    e.preventDefault();
    if (!kpiForm.employeeId) return toast.error('Vui lòng chọn nhân sự.');
    if (kpiForm.targetPhones <= 0) return toast.error('KPI Số SĐT phải lớn hơn 0.');

    const selectedStaff = pageStaff.find(s => s.id === kpiForm.employeeId || s.employeeId === kpiForm.employeeId);

    const payload = {
      id: kpiForm.id || crypto.randomUUID(),
      employeeId: selectedStaff?.employeeId || selectedStaff?.id,
      fullName: selectedStaff?.fullName || '',
      position: 'TRỰC PAGE',
      month: month,
      targetType: 'page',
      targetPhones: Number(kpiForm.targetPhones),
      targetConversionRate: Number(kpiForm.targetConversionRate),
      note: kpiForm.note,
      updatedAt: new Date().toISOString()
    };
    
    if (!kpiForm.id) payload.createdAt = new Date().toISOString();

    const success = await saveKpiTargetToSupabase(payload);
    if (success) {
      toast.success(kpiForm.id ? 'Đã cập nhật KPI Trực page.' : 'Đã lưu KPI Trực page.');
      setKpiForm({ id: null, employeeId: '', targetPhones: 0, targetConversionRate: 0, note: '' });
      loadData();
    }
  };

  const handleDeleteKpi = async (id) => {
    if (window.confirm('Xóa KPI này?')) {
      const success = await softDeleteKpiTargetFromSupabase(id);
      if (success) {
        toast.success('Đã xóa KPI');
        loadData();
      }
    }
  };

  const handleSavePhoneAssignment = (e) => {
    e.preventDefault();
    if (!phoneAssignForm.date || !phoneAssignForm.pageEmployeeId || !phoneAssignForm.telesaleEmployeeId) {
      return toast.error('Vui lòng điền đầy đủ Ngày, Trực page và Telesale.');
    }

    const pageEmp = pageStaff.find(s => s.employeeId === phoneAssignForm.pageEmployeeId || s.id === phoneAssignForm.pageEmployeeId);
    const teleEmp = telesaleStaff.find(s => s.employeeId === phoneAssignForm.telesaleEmployeeId || s.id === phoneAssignForm.telesaleEmployeeId);

    const payload = {
      date: phoneAssignForm.date,
      month: phoneAssignForm.date.substring(0, 7),
      pageEmployeeId: pageEmp?.employeeId || phoneAssignForm.pageEmployeeId,
      pageName: pageEmp?.fullName || '',
      telesaleEmployeeId: teleEmp?.employeeId || phoneAssignForm.telesaleEmployeeId,
      telesaleName: teleEmp?.fullName || '',
      phoneCount: Number(phoneAssignForm.phoneCount || 0),
      note: phoneAssignForm.note || '',
      updatedBy: currentUser?.id || ''
    };

    if (phoneAssignForm.id) {
      updatePagePhoneAssignment(phoneAssignForm.id, payload);
      toast.success('Đã cập nhật phân bổ số điện thoại.');
    } else {
      savePagePhoneAssignment({ ...payload, createdBy: currentUser?.id || '' });
      toast.success('Đã phân bổ số điện thoại cho Telesale.');
    }

    setPhoneAssignForm({ id: null, date: format(new Date(), 'yyyy-MM-dd'), pageEmployeeId: '', telesaleEmployeeId: '', phoneCount: 0, note: '' });
    loadData();
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> 
            KPI Trực page
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Quản lý và theo dõi chỉ tiêu nhân viên Trực page</p>
        </div>
      </div>

      <Card className="bg-card shadow-sm border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="space-y-1.5 w-full sm:w-48">
            <Label className="text-xs text-muted-foreground">Tháng</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full" />
          </div>
          <div className="space-y-1.5 w-full sm:w-64">
            <Label className="text-xs text-muted-foreground">Nhân sự Trực page</Label>
            <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Tất cả nhân sự" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhân sự</SelectItem>
                {pageStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={handleResetFilter} title="Đặt lại" className="shrink-0 w-full sm:w-10 h-10 mb-[1px]">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <MessageSquare className="w-5 h-5 text-indigo-500 mb-2" />
            <p className="text-lg md:text-2xl font-bold text-indigo-600">{stats.totalMessages.toLocaleString()}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase mt-1">Tổng TN/Cmt</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <PhoneCall className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-lg md:text-2xl font-bold text-amber-600">{stats.totalPhones.toLocaleString()}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase mt-1">SĐT thu về</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Percent className="w-5 h-5 text-purple-500 mb-2" />
            <p className="text-lg md:text-2xl font-bold text-purple-600">{stats.avgConversion.toFixed(1)}%</p>
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase mt-1">Tỷ lệ xin số</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-none col-span-2 md:col-span-1">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Banknote className="w-5 h-5 text-emerald-100 mb-2" />
            <p className="text-lg md:text-xl font-bold">{formatVND(stats.totalCommission)}</p>
            <p className="text-[10px] md:text-xs font-medium uppercase mt-1 opacity-90">Hoa hồng</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Target className="w-5 h-5 text-rose-500 mb-2" />
            <p className="text-lg md:text-2xl font-bold text-rose-600">{stats.totalKPIAssigned.toLocaleString()}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase mt-1">KPI đã giao</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <Target className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-lg md:text-2xl font-bold text-blue-600">{stats.avgCompletion.toFixed(1)}%</p>
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase mt-1">Hoàn thành TB</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 pt-4 border-t border-border">
        <h2 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" /> Giao KPI Trực page
        </h2>
        
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold text-primary">
              {kpiForm.id ? 'Chỉnh sửa KPI' : 'Thiết lập KPI mới'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveKpi} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Nhân sự <span className="text-destructive">*</span></Label>
                <Select value={kpiForm.employeeId} onValueChange={v => setKpiForm({...kpiForm, employeeId: v})}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn nhân sự" /></SelectTrigger>
                  <SelectContent>{pageStaff.map(s => <SelectItem key={s.id} value={s.employeeId || s.id}>{s.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>KPI Số điện thoại <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" value={kpiForm.targetPhones} onChange={e => setKpiForm({...kpiForm, targetPhones: e.target.value})} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>KPI Tỷ lệ xin số (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" value={kpiForm.targetConversionRate} onChange={e => setKpiForm({...kpiForm, targetConversionRate: e.target.value})} className="w-full" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Ghi chú</Label>
                <Input value={kpiForm.note} onChange={e => setKpiForm({...kpiForm, note: e.target.value})} placeholder="Không bắt buộc" className="w-full" />
              </div>
              <div className="lg:col-span-5 flex flex-col-reverse md:flex-row justify-end gap-3 pt-2">
                {kpiForm.id && (
                  <Button type="button" variant="outline" onClick={() => setKpiForm({ id: null, employeeId: '', targetPhones: 0, targetConversionRate: 0, note: '' })} className="w-full md:w-auto">
                    Hủy
                  </Button>
                )}
                <Button type="submit" className="w-full md:w-auto min-w-[150px]">
                  {kpiForm.id ? 'Cập nhật KPI' : 'Lưu KPI'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Danh sách KPI Trực page đã giao</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Nhân sự</TableHead>
                  <TableHead>Tháng</TableHead>
                  <TableHead className="text-center">KPI SĐT</TableHead>
                  <TableHead className="text-center">KPI Tỷ lệ xin số</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="text-center w-24">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTargets.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chưa có KPI nào được giao trong tháng này.</TableCell></TableRow>
                ) : (
                  currentTargets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-semibold">{t.fullName}</TableCell>
                      <TableCell>{t.month}</TableCell>
                      <TableCell className="text-center font-bold text-primary">{t.targetPhones}</TableCell>
                      <TableCell className="text-center font-medium text-amber-600">{t.targetConversionRate}%</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={t.note}>{t.note}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => {
                            setKpiForm({
                              id: t.id, employeeId: t.employeeId, targetPhones: t.targetPhones, targetConversionRate: t.targetConversionRate || 0, note: t.note || ''
                            });
                          }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDeleteKpi(t.id)}><Trash2 className="w-4 h-4" /></Button>
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

      <div className="space-y-6 pt-4 border-t border-border" id="phan-bo-sdt-form">
        <h2 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" /> Phân bổ số điện thoại cho Telesale
        </h2>
        
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold text-primary">
              {phoneAssignForm.id ? 'Chỉnh sửa phân bổ' : 'Ghi nhận phân bổ SĐT mới'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSavePhoneAssignment} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Ngày <span className="text-destructive">*</span></Label>
                <Input type="date" value={phoneAssignForm.date} onChange={e => setPhoneAssignForm({...phoneAssignForm, date: e.target.value})} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Trực page chuyển số <span className="text-destructive">*</span></Label>
                <Select value={phoneAssignForm.pageEmployeeId} onValueChange={v => setPhoneAssignForm({...phoneAssignForm, pageEmployeeId: v})}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn nhân sự" /></SelectTrigger>
                  <SelectContent>{pageStaff.map(s => <SelectItem key={s.id} value={s.employeeId || s.id}>{s.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telesale nhận số <span className="text-destructive">*</span></Label>
                <Select value={phoneAssignForm.telesaleEmployeeId} onValueChange={v => setPhoneAssignForm({...phoneAssignForm, telesaleEmployeeId: v})}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn nhân sự" /></SelectTrigger>
                  <SelectContent>{telesaleStaff.map(s => <SelectItem key={s.id} value={s.employeeId || s.id}>{s.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Số lượng SĐT <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" value={phoneAssignForm.phoneCount} onChange={e => setPhoneAssignForm({...phoneAssignForm, phoneCount: e.target.value})} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Input value={phoneAssignForm.note} onChange={e => setPhoneAssignForm({...phoneAssignForm, note: e.target.value})} placeholder="Không bắt buộc" className="w-full" />
              </div>
              <div className="lg:col-span-5 flex flex-col-reverse md:flex-row justify-end gap-3 pt-2">
                {phoneAssignForm.id && (
                  <Button type="button" variant="outline" onClick={() => setPhoneAssignForm({ id: null, date: format(new Date(), 'yyyy-MM-dd'), pageEmployeeId: '', telesaleEmployeeId: '', phoneCount: 0, note: '' })} className="w-full md:w-auto">
                    Hủy
                  </Button>
                )}
                <Button type="submit" className="w-full md:w-auto min-w-[150px]">
                  {phoneAssignForm.id ? 'Cập nhật' : 'Lưu phân bổ'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ResponsiveDataList 
          data={currentPhoneAssignments}
          emptyText="Chưa có dữ liệu phân bổ trong tháng này."
          renderDesktop={() => (
            <Card className="shadow-sm border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Trực page chuyển</TableHead>
                    <TableHead>Telesale nhận</TableHead>
                    <TableHead className="text-center">Số lượng</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead className="text-center w-24">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPhoneAssignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{format(parseISO(a.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-semibold text-primary">{a.pageName}</TableCell>
                      <TableCell className="font-semibold text-indigo-600">{a.telesaleName}</TableCell>
                      <TableCell className="text-center font-bold text-amber-600">{a.phoneCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.note}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => {
                            setPhoneAssignForm({
                              id: a.id, date: a.date, pageEmployeeId: resolveEmployeeId(a.pageEmployeeId, pageStaff), telesaleEmployeeId: resolveEmployeeId(a.telesaleEmployeeId, telesaleStaff), phoneCount: a.phoneCount, note: a.note || ''
                            });
                            document.getElementById('phan-bo-sdt-form')?.scrollIntoView({ behavior: 'smooth' });
                          }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => {
                            if (window.confirm('Xóa bản ghi này?')) { deletePagePhoneAssignment(a.id); loadData(); }
                          }}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          renderMobileItem={(a, idx) => (
            <Card key={a.id} className="p-4 shadow-sm border-border">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-bold text-sm">{format(parseISO(a.date), 'dd/MM/yyyy')}</span>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{a.phoneCount} SĐT</Badge>
              </div>
              <div className="space-y-2 text-sm bg-muted/20 p-3 rounded-lg border border-dashed">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trực page:</span>
                  <span className="font-medium text-primary">{a.pageName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telesale:</span>
                  <span className="font-medium text-indigo-600">{a.telesaleName}</span>
                </div>
                {a.note && (
                  <div className="flex flex-col mt-2 pt-2 border-t border-border/50">
                    <span className="text-muted-foreground text-xs">Ghi chú:</span>
                    <span className="text-xs">{a.note}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" className="h-8 text-blue-600" onClick={() => {
                  setPhoneAssignForm({
                    id: a.id, date: a.date, pageEmployeeId: resolveEmployeeId(a.pageEmployeeId, pageStaff), telesaleEmployeeId: resolveEmployeeId(a.telesaleEmployeeId, telesaleStaff), phoneCount: a.phoneCount, note: a.note || ''
                  });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>Sửa</Button>
                <Button variant="outline" size="sm" className="h-8 text-rose-600" onClick={() => {
                  if (window.confirm('Xóa bản ghi này?')) { deletePagePhoneAssignment(a.id); loadData(); }
                }}>Xóa</Button>
              </div>
            </Card>
          )}
        />
      </div>
    </div>
  );
};

export default KpiPageAdminModule;
