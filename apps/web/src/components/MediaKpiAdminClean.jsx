
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Pencil, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { getUsers, getKpiTargets, saveKpiTarget, deleteKpiTarget } from '@/utils/userStorage.js';

const MediaKpiAdminClean = ({ selectedMonth: propMonth }) => {
  const { user: currentUser } = useAuth();
  const [localMonth, setLocalMonth] = useState(format(new Date(), 'yyyy-MM'));
  const activeMonth = propMonth || localMonth;
  const [refreshKey, setRefreshKey] = useState(0);

  const [kpiForm, setKpiForm] = useState({
    id: null,
    employeeId: '',
    targetVideoCount: 0,
    targetDesignCount: 0,
    targetPostCount: 0,
    targetApprovedCount: 0,
    targetViewCount: 0,
    note: ''
  });

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Get Media Staff
  const mediaStaff = useMemo(() => {
    const users = getUsers();
    return users.filter(u => 
      u.departmentPosition?.trim().toLowerCase() === 'media' && 
      u.status !== 'inactive'
    );
  }, []);

  // Get Media KPIs
  const mediaKpis = useMemo(() => {
    return getKpiTargets()
      .filter(t => t.targetType === 'media' && t.month === activeMonth)
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }, [activeMonth, refreshKey]);

  const handleSaveKpi = (e) => {
    e.preventDefault();
    if (!kpiForm.employeeId) return toast.error('Vui lòng chọn nhân sự Media.');

    const selectedStaff = mediaStaff.find(s => s.employeeId === kpiForm.employeeId);
    
    // Check for duplicates if creating new
    if (!kpiForm.id) {
      const existing = mediaKpis.find(k => k.employeeId === kpiForm.employeeId);
      if (existing) {
        kpiForm.id = existing.id; // Switch to update mode implicitly
      }
    }

    const payload = {
      id: kpiForm.id || crypto.randomUUID(),
      employeeId: kpiForm.employeeId,
      fullName: selectedStaff?.fullName || '',
      position: 'Media',
      month: activeMonth,
      targetType: 'media',
      targetVideoCount: Number(kpiForm.targetVideoCount),
      targetDesignCount: Number(kpiForm.targetDesignCount),
      targetPostCount: Number(kpiForm.targetPostCount),
      targetApprovedCount: Number(kpiForm.targetApprovedCount),
      targetViewCount: Number(kpiForm.targetViewCount),
      note: kpiForm.note,
      updatedBy: currentUser?.employeeId || '',
      updatedAt: new Date().toISOString()
    };

    if (!kpiForm.id) {
      payload.createdBy = currentUser?.employeeId || '';
      payload.createdAt = new Date().toISOString();
    }

    saveKpiTarget(payload);
    toast.success(kpiForm.id ? 'Cập nhật KPI Media thành công' : 'Đã giao KPI Media mới');
    
    setKpiForm({
      id: null, employeeId: '', targetVideoCount: 0, targetDesignCount: 0, 
      targetPostCount: 0, targetApprovedCount: 0, targetViewCount: 0, note: ''
    });
    refresh();
  };

  const handleEditKpi = (kpi) => {
    setKpiForm({
      id: kpi.id,
      employeeId: kpi.employeeId,
      targetVideoCount: kpi.targetVideoCount || 0,
      targetDesignCount: kpi.targetDesignCount || 0,
      targetPostCount: kpi.targetPostCount || 0,
      targetApprovedCount: kpi.targetApprovedCount || 0,
      targetViewCount: kpi.targetViewCount || 0,
      note: kpi.note || ''
    });
    document.getElementById('media-kpi-form')?.scrollIntoView({ behavior: 'smooth' });
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
      id: null, employeeId: '', targetVideoCount: 0, targetDesignCount: 0, 
      targetPostCount: 0, targetApprovedCount: 0, targetViewCount: 0, note: ''
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> 
            Quản lý KPI Media
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Giao chỉ tiêu Video, Design, Content cho bộ phận Media</p>
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

      <Card className="shadow-sm border-border" id="media-kpi-form">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {kpiForm.id ? 'Chỉnh sửa KPI Media' : 'Giao KPI Media mới'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveKpi} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="space-y-2 lg:col-span-2">
              <Label>Nhân sự Media <span className="text-destructive">*</span></Label>
              <Select value={kpiForm.employeeId} onValueChange={v => setKpiForm({...kpiForm, employeeId: v})} disabled={!!kpiForm.id}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân sự Media" /></SelectTrigger>
                <SelectContent>
                  {mediaStaff.length === 0 ? (
                    <SelectItem value="none" disabled>Không có nhân viên Media</SelectItem>
                  ) : (
                    mediaStaff.map(s => (
                      <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Chỉ tiêu Video</Label>
              <Input type="number" min="0" value={kpiForm.targetVideoCount} onChange={e => setKpiForm({...kpiForm, targetVideoCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Chỉ tiêu Design</Label>
              <Input type="number" min="0" value={kpiForm.targetDesignCount} onChange={e => setKpiForm({...kpiForm, targetDesignCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Chỉ tiêu Bài viết</Label>
              <Input type="number" min="0" value={kpiForm.targetPostCount} onChange={e => setKpiForm({...kpiForm, targetPostCount: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Số lượng Duyệt (Approved)</Label>
              <Input type="number" min="0" value={kpiForm.targetApprovedCount} onChange={e => setKpiForm({...kpiForm, targetApprovedCount: e.target.value})} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Chỉ tiêu Lượt xem (Views)</Label>
              <Input type="number" min="0" value={kpiForm.targetViewCount} onChange={e => setKpiForm({...kpiForm, targetViewCount: e.target.value})} />
            </div>

            <div className="space-y-2 lg:col-span-5">
              <Label>Ghi chú</Label>
              <Textarea 
                value={kpiForm.note} 
                onChange={e => setKpiForm({...kpiForm, note: e.target.value})} 
                placeholder="Yêu cầu chất lượng, định hướng nội dung..."
                className="h-16"
              />
            </div>
            
            <div className="lg:col-span-5 flex justify-end gap-3 pt-2 border-t mt-2">
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
          <CardTitle className="text-base font-semibold">Danh sách KPI Media đã giao ({activeMonth})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-center">Video</TableHead>
                <TableHead className="text-center">Design</TableHead>
                <TableHead className="text-center">Bài viết</TableHead>
                <TableHead className="text-center">Duyệt</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-center w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mediaKpis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu KPI Media trong tháng này.
                  </TableCell>
                </TableRow>
              ) : (
                mediaKpis.map((kpi, idx) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-primary">{kpi.fullName}</div>
                      <div className="text-xs text-muted-foreground">{kpi.employeeId}</div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-rose-600">{kpi.targetVideoCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-emerald-600">{kpi.targetDesignCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-600">{kpi.targetPostCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-blue-600">{kpi.targetApprovedCount || 0}</TableCell>
                    <TableCell className="text-right font-bold text-purple-600">{Number(kpi.targetViewCount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={kpi.note}>{kpi.note || '-'}</TableCell>
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

export default MediaKpiAdminClean;
