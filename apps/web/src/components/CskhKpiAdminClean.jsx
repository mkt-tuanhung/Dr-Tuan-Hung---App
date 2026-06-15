
import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Pencil, Trash2, HeartHandshake } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { getUsers, getKpiTargets, saveKpiTarget, deleteKpiTarget } from '@/utils/userStorage.js';

const CskhKpiAdminClean = ({ selectedMonth: propMonth }) => {
  const { user: currentUser } = useAuth();
  const [localMonth, setLocalMonth] = useState(format(new Date(), 'yyyy-MM'));
  const activeMonth = propMonth || localMonth;
  const [refreshKey, setRefreshKey] = useState(0);

  const [kpiForm, setKpiForm] = useState({
    id: null,
    employeeId: '',
    targetCaredCustomerCount: 0,
    targetSuccessfulCallCount: 0,
    targetMessageCount: 0,
    targetRevisitAppointmentCount: 0,
    targetSatisfiedFeedbackCount: 0,
    targetHandledComplaintCount: 0,
    note: ''
  });

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Get CSKH Staff
  const cskhStaff = useMemo(() => {
    const users = getUsers();
    return users.filter(u => {
      const pos = u.departmentPosition?.trim().toLowerCase();
      return (pos === 'cskh' || pos === 'chăm sóc khách hàng') && u.status !== 'inactive';
    });
  }, []);

  // Get CSKH KPIs
  const cskhKpis = useMemo(() => {
    return getKpiTargets()
      .filter(t => t.targetType === 'cskh' && t.month === activeMonth)
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }, [activeMonth, refreshKey]);

  const handleSaveKpi = (e) => {
    e.preventDefault();
    if (!kpiForm.employeeId) return toast.error('Vui lòng chọn nhân sự CSKH.');

    const selectedStaff = cskhStaff.find(s => s.employeeId === kpiForm.employeeId);
    
    // Check for duplicates if creating new
    if (!kpiForm.id) {
      const existing = cskhKpis.find(k => k.employeeId === kpiForm.employeeId);
      if (existing) {
        kpiForm.id = existing.id; // Switch to update mode implicitly
      }
    }

    const payload = {
      id: kpiForm.id || crypto.randomUUID(),
      employeeId: kpiForm.employeeId,
      fullName: selectedStaff?.fullName || '',
      position: 'CSKH',
      month: activeMonth,
      targetType: 'cskh',
      targetCaredCustomerCount: Number(kpiForm.targetCaredCustomerCount),
      targetSuccessfulCallCount: Number(kpiForm.targetSuccessfulCallCount),
      targetMessageCount: Number(kpiForm.targetMessageCount),
      targetRevisitAppointmentCount: Number(kpiForm.targetRevisitAppointmentCount),
      targetSatisfiedFeedbackCount: Number(kpiForm.targetSatisfiedFeedbackCount),
      targetHandledComplaintCount: Number(kpiForm.targetHandledComplaintCount),
      note: kpiForm.note,
      updatedBy: currentUser?.employeeId || '',
      updatedAt: new Date().toISOString()
    };

    if (!kpiForm.id) {
      payload.createdBy = currentUser?.employeeId || '';
      payload.createdAt = new Date().toISOString();
    }

    saveKpiTarget(payload);
    toast.success(kpiForm.id ? 'Cập nhật KPI CSKH thành công' : 'Đã giao KPI CSKH mới');
    
    setKpiForm({
      id: null, employeeId: '', targetCaredCustomerCount: 0, targetSuccessfulCallCount: 0, 
      targetMessageCount: 0, targetRevisitAppointmentCount: 0, targetSatisfiedFeedbackCount: 0, 
      targetHandledComplaintCount: 0, note: ''
    });
    refresh();
  };

  const handleEditKpi = (kpi) => {
    setKpiForm({
      id: kpi.id,
      employeeId: kpi.employeeId,
      targetCaredCustomerCount: kpi.targetCaredCustomerCount || 0,
      targetSuccessfulCallCount: kpi.targetSuccessfulCallCount || 0,
      targetMessageCount: kpi.targetMessageCount || 0,
      targetRevisitAppointmentCount: kpi.targetRevisitAppointmentCount || 0,
      targetSatisfiedFeedbackCount: kpi.targetSatisfiedFeedbackCount || 0,
      targetHandledComplaintCount: kpi.targetHandledComplaintCount || 0,
      note: kpi.note || ''
    });
    document.getElementById('cskh-kpi-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteKpi = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa KPI này?')) {
      deleteKpiTarget(id);
      toast.success('Đã xóa KPI');
      refresh();
    }
  };

  const resetForm = () => {
    setKpiForm({
      id: null, employeeId: '', targetCaredCustomerCount: 0, targetSuccessfulCallCount: 0, 
      targetMessageCount: 0, targetRevisitAppointmentCount: 0, targetSatisfiedFeedbackCount: 0, 
      targetHandledComplaintCount: 0, note: ''
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> 
            Quản lý KPI Chăm Sóc Khách Hàng (CSKH)
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Giao chỉ tiêu tương tác, tỷ lệ hài lòng và xử lý khiếu nại</p>
        </div>
        {!propMonth && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Label className="whitespace-nowrap font-medium">Tháng:</Label>
            <Input 
              type="month" 
              value={localMonth} 
              onChange={e => setLocalMonth(e.target.value)}
              className="w-[160px]"
            />
          </div>
        )}
      </div>

      <Card className="shadow-sm border-border" id="cskh-kpi-form">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-primary" />
            {kpiForm.id ? 'Chỉnh sửa KPI CSKH' : 'Giao KPI CSKH mới'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveKpi} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
            <div className="space-y-2 lg:col-span-2">
              <Label>Nhân sự CSKH <span className="text-destructive">*</span></Label>
              <Select value={kpiForm.employeeId} onValueChange={v => setKpiForm({...kpiForm, employeeId: v})} disabled={!!kpiForm.id}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân sự CSKH" /></SelectTrigger>
                <SelectContent>
                  {cskhStaff.length === 0 ? (
                    <SelectItem value="none" disabled>Không có nhân viên CSKH</SelectItem>
                  ) : (
                    cskhStaff.map(s => (
                      <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Khách cần CSKH</Label>
              <Input type="number" min="0" value={kpiForm.targetCaredCustomerCount} onChange={e => setKpiForm({...kpiForm, targetCaredCustomerCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Cuộc gọi thành công</Label>
              <Input type="number" min="0" value={kpiForm.targetSuccessfulCallCount} onChange={e => setKpiForm({...kpiForm, targetSuccessfulCallCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Tin nhắn CSKH</Label>
              <Input type="number" min="0" value={kpiForm.targetMessageCount} onChange={e => setKpiForm({...kpiForm, targetMessageCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Hẹn tái khám</Label>
              <Input type="number" min="0" value={kpiForm.targetRevisitAppointmentCount} onChange={e => setKpiForm({...kpiForm, targetRevisitAppointmentCount: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Feedback Hài lòng</Label>
              <Input type="number" min="0" value={kpiForm.targetSatisfiedFeedbackCount} onChange={e => setKpiForm({...kpiForm, targetSatisfiedFeedbackCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Khiếu nại cần xử lý</Label>
              <Input type="number" min="0" value={kpiForm.targetHandledComplaintCount} onChange={e => setKpiForm({...kpiForm, targetHandledComplaintCount: e.target.value})} />
            </div>

            <div className="space-y-2 lg:col-span-4 xl:col-span-4">
              <Label>Ghi chú / Yêu cầu thêm</Label>
              <Textarea 
                value={kpiForm.note} 
                onChange={e => setKpiForm({...kpiForm, note: e.target.value})} 
                placeholder="Tiêu chuẩn đánh giá hài lòng..."
                className="h-[42px]"
              />
            </div>
            
            <div className="lg:col-span-4 xl:col-span-6 flex justify-end gap-3 pt-2 border-t mt-2">
              {kpiForm.id && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Hủy chỉnh sửa
                </Button>
              )}
              <Button type="submit" className="min-w-[150px]">
                {kpiForm.id ? 'Cập nhật KPI' : 'Lưu KPI'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Danh sách KPI CSKH đã giao ({activeMonth})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-center">Khách CS</TableHead>
                <TableHead className="text-center">Gọi TC</TableHead>
                <TableHead className="text-center">Tin Nhắn</TableHead>
                <TableHead className="text-center">Tái Khám</TableHead>
                <TableHead className="text-center text-emerald-600">Hài Lòng</TableHead>
                <TableHead className="text-center text-purple-600">Xử Lý KN</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-center w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cskhKpis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu KPI CSKH trong tháng này.
                  </TableCell>
                </TableRow>
              ) : (
                cskhKpis.map((kpi, idx) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-primary">{kpi.fullName}</div>
                      <div className="text-xs text-muted-foreground">{kpi.employeeId}</div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-blue-600">{kpi.targetCaredCustomerCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-indigo-600">{kpi.targetSuccessfulCallCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-600">{kpi.targetMessageCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-rose-600">{kpi.targetRevisitAppointmentCount || 0}</TableCell>
                    <TableCell className="text-center font-bold text-emerald-600">{kpi.targetSatisfiedFeedbackCount || 0}</TableCell>
                    <TableCell className="text-center font-bold text-purple-600">{kpi.targetHandledComplaintCount || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate" title={kpi.note}>{kpi.note || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditKpi(kpi)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDeleteKpi(kpi.id)}>
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

export default CskhKpiAdminClean;
