
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Target, Video, PenTool, FileText, CheckCircle, Eye, Pencil, Trash2, Link2, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { getKpiTargets } from '@/utils/userStorage.js';

const MediaKpiPersonalClean = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [refreshKey, setRefreshKey] = useState(0);

  const [reportForm, setReportForm] = useState({
    id: null,
    date: format(new Date(), 'yyyy-MM-dd'),
    videoCount: 0,
    designCount: 0,
    postCount: 0,
    approvedCount: 0,
    viewCount: 0,
    productLinks: '',
    note: ''
  });

  const currentEmployeeId = currentUser?.employeeId?.trim().toLowerCase();

  // Load KPI Target
  const assignedKpi = useMemo(() => {
    const allTargets = getKpiTargets();
    return allTargets.find(kpi => 
      kpi.targetType?.trim().toLowerCase() === 'media' && 
      kpi.employeeId?.trim().toLowerCase() === currentEmployeeId && 
      kpi.month === selectedMonth
    );
  }, [selectedMonth, currentEmployeeId, refreshKey]);

  // Load Daily Reports
  const myReports = useMemo(() => {
    const allReports = JSON.parse(localStorage.getItem('mediaDailyReports') || '[]');
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
      video: acc.video + (Number(r.videoCount) || 0),
      design: acc.design + (Number(r.designCount) || 0),
      post: acc.post + (Number(r.postCount) || 0),
      approved: acc.approved + (Number(r.approvedCount) || 0),
      view: acc.view + (Number(r.viewCount) || 0),
    }), { video: 0, design: 0, post: 0, approved: 0, view: 0 });
  }, [myReports]);

  // Target values
  const targets = {
    video: Number(assignedKpi?.targetVideoCount) || 0,
    design: Number(assignedKpi?.targetDesignCount) || 0,
    post: Number(assignedKpi?.targetPostCount) || 0,
    approved: Number(assignedKpi?.targetApprovedCount) || 0,
    view: Number(assignedKpi?.targetViewCount) || 0,
  };

  // Calculate Progresses
  const calcProgress = (total, target) => target > 0 ? (total / target) * 100 : 0;
  
  const progress = {
    video: calcProgress(totals.video, targets.video),
    design: calcProgress(totals.design, targets.design),
    post: calcProgress(totals.post, targets.post),
    approved: calcProgress(totals.approved, targets.approved),
    view: calcProgress(totals.view, targets.view),
  };

  // Overall Completion Calculation
  const overallCompletion = useMemo(() => {
    const validMetrics = [
      targets.video > 0 ? progress.video : null,
      targets.design > 0 ? progress.design : null,
      targets.post > 0 ? progress.post : null,
      targets.approved > 0 ? progress.approved : null,
      targets.view > 0 ? progress.view : null,
    ].filter(p => p !== null);

    if (validMetrics.length === 0) return 0;
    const sum = validMetrics.reduce((a, b) => a + Math.min(b, 100), 0);
    return sum / validMetrics.length;
  }, [targets, progress]);

  const handleSaveReport = (e) => {
    e.preventDefault();
    if (!reportForm.date) return toast.error('Vui lòng chọn ngày báo cáo');

    const allReports = JSON.parse(localStorage.getItem('mediaDailyReports') || '[]');
    const reportMonth = reportForm.date.substring(0, 7);
    
    const payload = {
      ...reportForm,
      month: reportMonth,
      employeeId: currentUser.employeeId,
      fullName: currentUser.fullName,
      videoCount: Number(reportForm.videoCount),
      designCount: Number(reportForm.designCount),
      postCount: Number(reportForm.postCount),
      approvedCount: Number(reportForm.approvedCount),
      viewCount: Number(reportForm.viewCount),
      updatedAt: new Date().toISOString()
    };

    if (reportForm.id) {
      const idx = allReports.findIndex(r => r.id === reportForm.id);
      if (idx !== -1) {
        allReports[idx] = { ...allReports[idx], ...payload };
        toast.success('Cập nhật báo cáo thành công');
      }
    } else {
      payload.id = crypto.randomUUID();
      payload.createdAt = new Date().toISOString();
      allReports.push(payload);
      toast.success('Thêm báo cáo mới thành công');
    }

    localStorage.setItem('mediaDailyReports', JSON.stringify(allReports));
    setReportForm({
      id: null,
      date: format(new Date(), 'yyyy-MM-dd'),
      videoCount: 0,
      designCount: 0,
      postCount: 0,
      approvedCount: 0,
      viewCount: 0,
      productLinks: '',
      note: ''
    });
    setRefreshKey(k => k + 1);
  };

  const handleEditReport = (report) => {
    setReportForm({ ...report });
    document.getElementById('media-report-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteReport = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa báo cáo này?')) {
      const allReports = JSON.parse(localStorage.getItem('mediaDailyReports') || '[]');
      localStorage.setItem('mediaDailyReports', JSON.stringify(allReports.filter(r => r.id !== id)));
      toast.success('Đã xóa báo cáo');
      setRefreshKey(k => k + 1);
    }
  };

  const resetForm = () => {
    setReportForm({
      id: null,
      date: format(new Date(), 'yyyy-MM-dd'),
      videoCount: 0, designCount: 0, postCount: 0, approvedCount: 0, viewCount: 0, productLinks: '', note: ''
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" /> 
            KPI cá nhân - Media
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Theo dõi hiệu suất và tiến độ công việc Media</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Progress Card */}
        <Card className="lg:col-span-1 shadow-sm border-none bg-gradient-to-br from-indigo-500 to-purple-600 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Target className="w-32 h-32" /></div>
          <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
            <p className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Tỷ lệ hoàn thành tổng thể</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-extrabold tabular-nums tracking-tight">{overallCompletion.toFixed(1)}</span>
              <span className="text-2xl font-semibold opacity-80 mb-1">%</span>
            </div>
            <Progress value={overallCompletion} className="h-2 bg-white/20" indicatorColor="bg-white" />
          </CardContent>
        </Card>

        {/* Detailed Metrics */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="shadow-sm border-border">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><Video className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Sản xuất Video</p>
              </div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-2xl font-bold text-rose-600 tabular-nums">{totals.video}</span>
                <span className="text-sm text-muted-foreground">/ {targets.video}</span>
              </div>
              <Progress value={Math.min(progress.video, 100)} className="h-1.5" indicatorColor={progress.video >= 100 ? 'bg-emerald-500' : 'bg-rose-500'} />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><PenTool className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Thiết kế / Design</p>
              </div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-2xl font-bold text-emerald-600 tabular-nums">{totals.design}</span>
                <span className="text-sm text-muted-foreground">/ {targets.design}</span>
              </div>
              <Progress value={Math.min(progress.design, 100)} className="h-1.5" indicatorColor={progress.design >= 100 ? 'bg-emerald-500' : 'bg-emerald-500'} />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><FileText className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Bài viết / Post</p>
              </div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-2xl font-bold text-amber-600 tabular-nums">{totals.post}</span>
                <span className="text-sm text-muted-foreground">/ {targets.post}</span>
              </div>
              <Progress value={Math.min(progress.post, 100)} className="h-1.5" indicatorColor={progress.post >= 100 ? 'bg-emerald-500' : 'bg-amber-500'} />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CheckCircle className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Đã duyệt (Approved)</p>
              </div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-2xl font-bold text-blue-600 tabular-nums">{totals.approved}</span>
                <span className="text-sm text-muted-foreground">/ {targets.approved}</span>
              </div>
              <Progress value={Math.min(progress.approved, 100)} className="h-1.5" indicatorColor={progress.approved >= 100 ? 'bg-emerald-500' : 'bg-blue-500'} />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border sm:col-span-2 lg:col-span-2">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Eye className="w-4 h-4" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng lượt xem (Views)</p>
              </div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-2xl font-bold text-purple-600 tabular-nums">{totals.view.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">/ {targets.view.toLocaleString()}</span>
              </div>
              <Progress value={Math.min(progress.view, 100)} className="h-1.5" indicatorColor={progress.view >= 100 ? 'bg-emerald-500' : 'bg-purple-500'} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily Report Form */}
      <Card className="shadow-sm border-border" id="media-report-form">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PenTool className="w-4 h-4 text-primary" />
            {reportForm.id ? 'Sửa báo cáo ngày' : 'Nhập báo cáo ngày mới'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSaveReport} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
            <div className="space-y-2 lg:col-span-2">
              <Label>Ngày báo cáo <span className="text-destructive">*</span></Label>
              <Input type="date" value={reportForm.date} onChange={e => setReportForm({...reportForm, date: e.target.value})} required />
            </div>
            
            <div className="space-y-2">
              <Label>Số Video</Label>
              <Input type="number" min="0" value={reportForm.videoCount} onChange={e => setReportForm({...reportForm, videoCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Số Design</Label>
              <Input type="number" min="0" value={reportForm.designCount} onChange={e => setReportForm({...reportForm, designCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Số Bài viết</Label>
              <Input type="number" min="0" value={reportForm.postCount} onChange={e => setReportForm({...reportForm, postCount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Số Lượng Duyệt</Label>
              <Input type="number" min="0" value={reportForm.approvedCount} onChange={e => setReportForm({...reportForm, approvedCount: e.target.value})} />
            </div>
            
            <div className="space-y-2 lg:col-span-2">
              <Label>Lượt xem thu về (Views)</Label>
              <Input type="number" min="0" value={reportForm.viewCount} onChange={e => setReportForm({...reportForm, viewCount: e.target.value})} />
            </div>

            <div className="space-y-2 lg:col-span-4">
              <Label>Link sản phẩm / Thành phẩm</Label>
              <Input value={reportForm.productLinks} onChange={e => setReportForm({...reportForm, productLinks: e.target.value})} placeholder="https://..." />
            </div>

            <div className="space-y-2 lg:col-span-6">
              <Label>Ghi chú công việc</Label>
              <Textarea 
                value={reportForm.note} 
                onChange={e => setReportForm({...reportForm, note: e.target.value})} 
                placeholder="Nội dung, tình trạng, khó khăn..."
                className="h-20"
              />
            </div>
            
            <div className="lg:col-span-6 flex justify-end gap-3 pt-2">
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
          <CardTitle className="text-base font-semibold">Lịch sử báo cáo ({selectedMonth})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead className="whitespace-nowrap">Ngày</TableHead>
                <TableHead className="text-center">Video</TableHead>
                <TableHead className="text-center">Design</TableHead>
                <TableHead className="text-center">Bài viết</TableHead>
                <TableHead className="text-center">Duyệt</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Links</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-center w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Chưa có báo cáo nào trong tháng này.
                  </TableCell>
                </TableRow>
              ) : (
                myReports.map((r, idx) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{format(parseISO(r.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-center font-semibold text-rose-600">{r.videoCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-emerald-600">{r.designCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-600">{r.postCount || 0}</TableCell>
                    <TableCell className="text-center font-semibold text-blue-600">{r.approvedCount || 0}</TableCell>
                    <TableCell className="text-right font-bold text-purple-600">{Number(r.viewCount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      {r.productLinks ? (
                        <a href={r.productLinks.startsWith('http') ? r.productLinks : `https://${r.productLinks}`} target="_blank" rel="noreferrer" className="flex items-center text-primary hover:underline text-sm max-w-[120px] truncate">
                          <Link2 className="w-3 h-3 mr-1 shrink-0" /> Link
                        </a>
                      ) : '-'}
                    </TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaKpiPersonalClean;
