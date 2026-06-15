
import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Pencil, Trash2, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { getUsers, getKpiTargets, saveKpiTarget, deleteKpiTarget } from '@/utils/userStorage.js';
import { formatVND } from '@/utils/currencyFormat.js';

const MarketingKpiAdminClean = ({ selectedMonth: propMonth }) => {
  const { user: currentUser } = useAuth();
  const [localMonth, setLocalMonth] = useState(format(new Date(), 'yyyy-MM'));
  const activeMonth = propMonth || localMonth;
  const [refreshKey, setRefreshKey] = useState(0);

  const [kpiForm, setKpiForm] = useState({
    id: null,
    employeeId: '',
    targetLeadCount: 0,
    targetAppointmentCount: 0,
    targetAdsRevenue: 0,
    targetRoas: 0,
    maxCostPerLead: 0,
    targetAdSpend: 0,
    note: ''
  });

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Get Marketing Staff
  const marketingStaff = useMemo(() => {
    const users = getUsers();
    return users.filter(u => {
      const pos = u.departmentPosition?.trim().toLowerCase();
      return (pos === 'marketing' || pos === 'mkt') && u.status !== 'inactive';
    });
  }, []);

  // Get Marketing KPIs
  const marketingKpis = useMemo(() => {
    return getKpiTargets()
      .filter(t => t.targetType === 'marketing' && t.month === activeMonth)
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }, [activeMonth, refreshKey]);

  const handleSaveKpi = (e) => {
    e.preventDefault();
    if (!kpiForm.employeeId) return toast.error('Vui lòng chọn nhân sự Marketing.');

    const selectedStaff = marketingStaff.find(s => s.employeeId === kpiForm.employeeId);
    
    // Check for duplicates if creating new
    if (!kpiForm.id) {
      const existing = marketingKpis.find(k => k.employeeId === kpiForm.employeeId);
      if (existing) {
        kpiForm.id = existing.id; // Switch to update mode implicitly
      }
    }

    const payload = {
      id: kpiForm.id || crypto.randomUUID(),
      employeeId: kpiForm.employeeId,
      fullName: selectedStaff?.fullName || '',
      position: 'Marketing',
      month: activeMonth,
      targetType: 'marketing',
      targetLeadCount: Number(kpiForm.targetLeadCount),
      targetAppointmentCount: Number(kpiForm.targetAppointmentCount),
      targetAdsRevenue: Number(kpiForm.targetAdsRevenue),
      targetRoas: Number(kpiForm.targetRoas),
      maxCostPerLead: Number(kpiForm.maxCostPerLead),
      targetAdSpend: Number(kpiForm.targetAdSpend),
      note: kpiForm.note,
      updatedBy: currentUser?.employeeId || '',
      updatedAt: new Date().toISOString()
    };

    if (!kpiForm.id) {
      payload.createdBy = currentUser?.employeeId || '';
      payload.createdAt = new Date().toISOString();
    }

    saveKpiTarget(payload);
    toast.success(kpiForm.id ? 'Cập nhật KPI Marketing thành công' : 'Đã giao KPI Marketing mới');
    
    resetForm();
    refresh();
  };

  const handleEditKpi = (kpi) => {
    setKpiForm({
      id: kpi.id,
      employeeId: kpi.employeeId,
      targetLeadCount: kpi.targetLeadCount || 0,
      targetAppointmentCount: kpi.targetAppointmentCount || 0,
      targetAdsRevenue: kpi.targetAdsRevenue || 0,
      targetRoas: kpi.targetRoas || 0,
      maxCostPerLead: kpi.maxCostPerLead || 0,
      targetAdSpend: kpi.targetAdSpend || 0,
      note: kpi.note || ''
    });
    document.getElementById('mkt-kpi-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteKpi = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa KPI này?')) {
      deleteKpiTarget(id);
      toast.success('Đã xóa KPI Marketing');
      refresh();
    }
  };

  const resetForm = () => {
    setKpiForm({
      id: null, employeeId: '', targetLeadCount: 0, targetAppointmentCount: 0, 
      targetAdsRevenue: 0, targetRoas: 0, maxCostPerLead: 0, targetAdSpend: 0, note: ''
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> 
            Quản lý KPI Marketing
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Giao chỉ tiêu Leads, Chi phí, Doanh thu và hiệu suất ROAS</p>
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

      <Card className="shadow-sm border-border" id="mkt-kpi-form">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            {kpiForm.id ? 'Chỉnh sửa KPI Marketing' : 'Giao KPI Marketing mới'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveKpi} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
            <div className="space-y-2 lg:col-span-2">
              <Label>Nhân sự Marketing <span className="text-destructive">*</span></Label>
              <Select value={kpiForm.employeeId} onValueChange={v => setKpiForm({...kpiForm, employeeId: v})} disabled={!!kpiForm.id}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân sự Marketing" /></SelectTrigger>
                <SelectContent>
                  {marketingStaff.length === 0 ? (
                    <SelectItem value="none" disabled>Không có nhân sự Marketing</SelectItem>
                  ) : (
                    marketingStaff.map(s => (
                      <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Chỉ tiêu Lead / SĐT</Label>
              <Input type="number" min="0" value={kpiForm.targetLeadCount} onChange={e => setKpiForm({...kpiForm, targetLeadCount: e.target.value})} className="border-blue-200 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <Label>Chỉ tiêu Lịch hẹn</Label>
              <Input type="number" min="0" value={kpiForm.targetAppointmentCount} onChange={e => setKpiForm({...kpiForm, targetAppointmentCount: e.target.value})} className="border-indigo-200 focus-visible:ring-indigo-500" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Chỉ tiêu Doanh thu ADS (VNĐ)</Label>
              <Input type="number" min="0" value={kpiForm.targetAdsRevenue} onChange={e => setKpiForm({...kpiForm, targetAdsRevenue: e.target.value})} className="border-emerald-200 focus-visible:ring-emerald-500" />
            </div>
            
            <div className="space-y-2 lg:col-span-2">
              <Label>Ngân sách Quảng cáo (VNĐ)</Label>
              <Input type="number" min="0" value={kpiForm.targetAdSpend} onChange={e => setKpiForm({...kpiForm, targetAdSpend: e.target.value})} className="border-rose-200 focus-visible:ring-rose-500" />
            </div>
            <div className="space-y-2">
              <Label>Max CPL (Chi phí/Lead)</Label>
              <Input type="number" min="0" value={kpiForm.maxCostPerLead} onChange={e => setKpiForm({...kpiForm, maxCostPerLead: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Mục tiêu ROAS</Label>
              <Input type="number" min="0" step="0.1" value={kpiForm.targetRoas} onChange={e => setKpiForm({...kpiForm, targetRoas: e.target.value})} />
            </div>

            <div className="space-y-2 lg:col-span-4 xl:col-span-6">
              <Label>Ghi chú / Yêu cầu thêm</Label>
              <Textarea 
                value={kpiForm.note} 
                onChange={e => setKpiForm({...kpiForm, note: e.target.value})} 
                placeholder="Yêu cầu về chất lượng Lead, khung giờ chạy ADS..."
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
          <CardTitle className="text-base font-semibold">Danh sách KPI Marketing đã giao ({activeMonth})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-center">Ngân sách</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Hẹn</TableHead>
                <TableHead className="text-center">Max CPL</TableHead>
                <TableHead className="text-right text-emerald-600">DT ADS</TableHead>
                <TableHead className="text-center text-purple-600">ROAS</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-center w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketingKpis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu KPI Marketing trong tháng này.
                  </TableCell>
                </TableRow>
              ) : (
                marketingKpis.map((kpi, idx) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-primary">{kpi.fullName}</div>
                      <div className="text-xs text-muted-foreground">{kpi.employeeId}</div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-rose-600">{formatVND(kpi.targetAdSpend)}</TableCell>
                    <TableCell className="text-center font-semibold text-blue-600">{kpi.targetLeadCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-indigo-600">{kpi.targetAppointmentCount || 0}</TableCell>
                    <TableCell className="text-center text-amber-600">{formatVND(kpi.maxCostPerLead)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{formatVND(kpi.targetAdsRevenue)}</TableCell>
                    <TableCell className="text-center font-bold text-purple-600">{Number(kpi.targetRoas || 0).toFixed(2)}</TableCell>
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

export default MarketingKpiAdminClean;
