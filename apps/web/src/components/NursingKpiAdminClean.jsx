
import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Pencil, Trash2, HeartPulse } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { getUsers, getKpiTargets, saveKpiTarget, deleteKpiTarget } from '@/utils/userStorage.js';

const NursingKpiAdminClean = ({ selectedMonth: propMonth }) => {
  const { user: currentUser } = useAuth();
  const [localMonth, setLocalMonth] = useState(format(new Date(), 'yyyy-MM'));
  const activeMonth = propMonth || localMonth;
  const [refreshKey, setRefreshKey] = useState(0);

  const [kpiForm, setKpiForm] = useState({
    id: null,
    employeeId: '',
    targetCaredPatientCount: 0,
    targetSurgerySupportCount: 0,
    targetPostOpCareCount: 0,
    targetMedicalRecordCount: 0,
    targetOnTimeRate: 100,
    maxIncidentCount: 0,
    targetHandledIncidentRate: 100,
    note: ''
  });

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Get Nursing Staff
  const nursingStaff = useMemo(() => {
    const users = getUsers();
    return users.filter(u => {
      const pos = u.departmentPosition?.trim().toLowerCase();
      return (pos === 'điều dưỡng' || pos === 'dieu duong' || pos === 'nursing') && u.status !== 'inactive';
    });
  }, []);

  // Get Nursing KPIs
  const nursingKpis = useMemo(() => {
    return getKpiTargets()
      .filter(t => t.targetType === 'nursing' && t.month === activeMonth)
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }, [activeMonth, refreshKey]);

  const handleSaveKpi = (e) => {
    e.preventDefault();
    if (!kpiForm.employeeId) return toast.error('Vui lòng chọn nhân sự Điều dưỡng.');

    const selectedStaff = nursingStaff.find(s => s.employeeId === kpiForm.employeeId);
    
    // Check for duplicates if creating new
    if (!kpiForm.id) {
      const existing = nursingKpis.find(k => k.employeeId === kpiForm.employeeId);
      if (existing) {
        kpiForm.id = existing.id; // Switch to update mode implicitly
      }
    }

    const payload = {
      id: kpiForm.id || crypto.randomUUID(),
      employeeId: kpiForm.employeeId,
      fullName: selectedStaff?.fullName || '',
      position: 'Điều dưỡng',
      month: activeMonth,
      targetType: 'nursing',
      targetCaredPatientCount: Number(kpiForm.targetCaredPatientCount),
      targetSurgerySupportCount: Number(kpiForm.targetSurgerySupportCount),
      targetPostOpCareCount: Number(kpiForm.targetPostOpCareCount),
      targetMedicalRecordCount: Number(kpiForm.targetMedicalRecordCount),
      targetOnTimeRate: Number(kpiForm.targetOnTimeRate),
      maxIncidentCount: Number(kpiForm.maxIncidentCount),
      targetHandledIncidentRate: Number(kpiForm.targetHandledIncidentRate),
      note: kpiForm.note,
      updatedBy: currentUser?.employeeId || '',
      updatedAt: new Date().toISOString()
    };

    if (!kpiForm.id) {
      payload.createdBy = currentUser?.employeeId || '';
      payload.createdAt = new Date().toISOString();
    }

    saveKpiTarget(payload);
    toast.success(kpiForm.id ? 'Cập nhật KPI Điều dưỡng thành công' : 'Đã giao KPI Điều dưỡng mới');
    
    resetForm();
    refresh();
  };

  const handleEditKpi = (kpi) => {
    setKpiForm({
      id: kpi.id,
      employeeId: kpi.employeeId,
      targetCaredPatientCount: kpi.targetCaredPatientCount || 0,
      targetSurgerySupportCount: kpi.targetSurgerySupportCount || 0,
      targetPostOpCareCount: kpi.targetPostOpCareCount || 0,
      targetMedicalRecordCount: kpi.targetMedicalRecordCount || 0,
      targetOnTimeRate: kpi.targetOnTimeRate || 100,
      maxIncidentCount: kpi.maxIncidentCount || 0,
      targetHandledIncidentRate: kpi.targetHandledIncidentRate || 100,
      note: kpi.note || ''
    });
    document.getElementById('nursing-kpi-form')?.scrollIntoView({ behavior: 'smooth' });
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
      id: null, employeeId: '', targetCaredPatientCount: 0, targetSurgerySupportCount: 0, 
      targetPostOpCareCount: 0, targetMedicalRecordCount: 0, targetOnTimeRate: 100, 
      maxIncidentCount: 0, targetHandledIncidentRate: 100, note: ''
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> 
            Quản lý KPI Điều dưỡng
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Giao chỉ tiêu phục vụ và quản lý rủi ro y tế</p>
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

      <Card className="shadow-sm border-border" id="nursing-kpi-form">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-primary" />
            {kpiForm.id ? 'Chỉnh sửa KPI Điều dưỡng' : 'Giao KPI Điều dưỡng mới'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveKpi} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            <div className="space-y-2 lg:col-span-2">
              <Label>Nhân sự Điều dưỡng <span className="text-destructive">*</span></Label>
              <Select value={kpiForm.employeeId} onValueChange={v => setKpiForm({...kpiForm, employeeId: v})} disabled={!!kpiForm.id}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân sự Điều dưỡng" /></SelectTrigger>
                <SelectContent>
                  {nursingStaff.length === 0 ? (
                    <SelectItem value="none" disabled>Không có nhân viên Điều dưỡng</SelectItem>
                  ) : (
                    nursingStaff.map(s => (
                      <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Chỉ tiêu Khách CS</Label>
              <Input type="number" min="0" value={kpiForm.targetCaredPatientCount} onChange={e => setKpiForm({...kpiForm, targetCaredPatientCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Chỉ tiêu Hỗ trợ PT</Label>
              <Input type="number" min="0" value={kpiForm.targetSurgerySupportCount} onChange={e => setKpiForm({...kpiForm, targetSurgerySupportCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Chỉ tiêu Hậu phẫu</Label>
              <Input type="number" min="0" value={kpiForm.targetPostOpCareCount} onChange={e => setKpiForm({...kpiForm, targetPostOpCareCount: e.target.value})} />
            </div>

            <div className="space-y-2">
              <Label>Chỉ tiêu Hồ sơ y tế</Label>
              <Input type="number" min="0" value={kpiForm.targetMedicalRecordCount} onChange={e => setKpiForm({...kpiForm, targetMedicalRecordCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Tỷ lệ Đúng hạn (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={kpiForm.targetOnTimeRate} onChange={e => setKpiForm({...kpiForm, targetOnTimeRate: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Max Sự cố phát sinh</Label>
              <Input type="number" min="0" value={kpiForm.maxIncidentCount} onChange={e => setKpiForm({...kpiForm, maxIncidentCount: e.target.value})} className="border-rose-200 focus-visible:ring-rose-500" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Tỷ lệ Xử lý sự cố (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={kpiForm.targetHandledIncidentRate} onChange={e => setKpiForm({...kpiForm, targetHandledIncidentRate: e.target.value})} className="border-purple-200 focus-visible:ring-purple-500" />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-4 xl:col-span-5">
              <Label>Ghi chú / Yêu cầu thêm</Label>
              <Textarea 
                value={kpiForm.note} 
                onChange={e => setKpiForm({...kpiForm, note: e.target.value})} 
                placeholder="Tiêu chuẩn phục vụ, thái độ..."
                className="h-[42px]"
              />
            </div>
            
            <div className="md:col-span-2 lg:col-span-4 xl:col-span-5 flex justify-end gap-3 pt-2 border-t mt-2">
              {kpiForm.id && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Hủy chỉnh sửa
                </Button>
              )}
              <Button type="submit" className="min-w-[150px]">
                {kpiForm.id ? 'Cập nhật KPI' : 'Lưu KPI Điều dưỡng'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Danh sách KPI Điều dưỡng đã giao ({activeMonth})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-center">Khách CS</TableHead>
                <TableHead className="text-center">Hỗ trợ PT</TableHead>
                <TableHead className="text-center">Hậu phẫu</TableHead>
                <TableHead className="text-center">Hồ sơ</TableHead>
                <TableHead className="text-center">Đúng hạn</TableHead>
                <TableHead className="text-center text-rose-600">Max Sự cố</TableHead>
                <TableHead className="text-center text-purple-600">TL Xử lý</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-center w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nursingKpis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu KPI Điều dưỡng trong tháng này.
                  </TableCell>
                </TableRow>
              ) : (
                nursingKpis.map((kpi, idx) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-primary">{kpi.fullName}</div>
                      <div className="text-xs text-muted-foreground">{kpi.employeeId}</div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-blue-600">{kpi.targetCaredPatientCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-indigo-600">{kpi.targetSurgerySupportCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-emerald-600">{kpi.targetPostOpCareCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-600">{kpi.targetMedicalRecordCount || 0}</TableCell>
                    <TableCell className="text-center font-bold text-emerald-700">{kpi.targetOnTimeRate || 0}%</TableCell>
                    <TableCell className="text-center font-bold text-rose-600">{kpi.maxIncidentCount || 0}</TableCell>
                    <TableCell className="text-center font-bold text-purple-600">{kpi.targetHandledIncidentRate || 0}%</TableCell>
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

export default NursingKpiAdminClean;
