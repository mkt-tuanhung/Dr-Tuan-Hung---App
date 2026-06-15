
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { syncNotificationStatus } from '@/utils/ApprovalNotificationHelper.js';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { 
  syncAttendanceRecordsWithSupabase, 
  syncAttendanceRequestsWithSupabase,
  saveAttendanceRecordToSupabase,
  saveAttendanceRequestToSupabase,
  uploadAllAttendanceToSupabase
} from '@/services/dataService.js';

import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, CheckCircle, XCircle, FileEdit, UserCircle, CalendarDays, RefreshCw, Loader2 } from 'lucide-react';

import ResponsiveAttendanceCard from '@/components/ResponsiveAttendanceCard.jsx';
import ResponsiveAttendanceRequestCard from '@/components/ResponsiveAttendanceRequestCard.jsx';
import AttendanceCalendar from '@/components/AttendanceCalendar.jsx';

const STATUS_MAP = {
  present: { label: 'Có mặt', class: 'bg-emerald-100 text-emerald-700' },
  leave_full: { label: 'Nghỉ cả ngày', class: 'bg-slate-100 text-slate-700' },
  leave_morning: { label: 'Nghỉ sáng', class: 'bg-indigo-100 text-indigo-700' },
  leave_afternoon: { label: 'Nghỉ chiều', class: 'bg-indigo-100 text-indigo-700' },
  late: { label: 'Đi muộn', class: 'bg-amber-100 text-amber-700' },
  early_leave: { label: 'Về sớm', class: 'bg-amber-100 text-amber-700' },
  absent: { label: 'Vắng mặt', class: 'bg-rose-100 text-rose-700' }
};

const REQUEST_TYPES = {
  leave_full: 'Xin nghỉ cả ngày',
  leave_morning: 'Xin nghỉ sáng',
  leave_afternoon: 'Xin nghỉ chiều',
  late: 'Xin đi muộn',
  early_leave: 'Xin về sớm'
};

const AttendanceAdminPage = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [requests, setRequests] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const [selectedCalendarUser, setSelectedCalendarUser] = useState(null);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const [editForm, setEditForm] = useState({
    employeeId: '', date: '', status: '', checkInTime: '', checkOutTime: '', workUnit: 1, note: ''
  });

  const loadData = () => {
    const allUsers = JSON.parse(localStorage.getItem('clinic_users') || '[]');
    setUsers(allUsers.filter(u => u.role === 'Nhân viên'));
    setRecords(JSON.parse(localStorage.getItem('attendanceRecords') || '[]'));
    setRequests(JSON.parse(localStorage.getItem('attendanceRequests') || '[]'));
  };

  useEffect(() => { 
    const initSync = async () => {
      setIsSyncing(true);
      await Promise.all([
        syncAttendanceRecordsWithSupabase(),
        syncAttendanceRequestsWithSupabase()
      ]);
      loadData();
      setIsSyncing(false);
    };
    initSync();
  }, []);

  // Lắng nghe sự kiện realtime từ Supabase
  useEffect(() => {
    window.addEventListener('supabase-data-updated', loadData);
    return () => {
      window.removeEventListener('supabase-data-updated', loadData);
    };
  }, []);

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    const success = await uploadAllAttendanceToSupabase();
    if (success) {
      toast.success('Đã đồng bộ toàn bộ dữ liệu chấm công lên Supabase.');
    } else {
      toast.error('Có lỗi xảy ra khi đồng bộ hàng loạt lên Supabase.');
    }
    setIsBulkSyncing(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchPos = positionFilter === 'all' || u.departmentPosition === positionFilter;
      const matchSearch = u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchPos && matchSearch;
    });
  }, [users, positionFilter, searchQuery]);

  const getUserStats = (empId) => {
    const mRecords = records.filter(r => {
      const d = parseISO(r.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year && (r.employeeId === empId || r.employeeId === users.find(u => u.employeeId === empId)?.id);
    });
    
    let stats = { totalWork: 0, checkedIn: 0, leaveFull: 0, leaveHalf: 0, late: 0, early: 0, absent: 0, pending: 0 };
    
    mRecords.forEach(r => {
      stats.totalWork += (Number(r.workUnit) || 0);
      if (['present','late','early_leave'].includes(r.status)) stats.checkedIn++;
      if (r.status === 'leave_full') stats.leaveFull++;
      if (['leave_morning','leave_afternoon'].includes(r.status)) stats.leaveHalf++;
      if (r.status === 'late') stats.late++;
      if (r.status === 'early_leave') stats.early++;
      if (r.status === 'absent') stats.absent++;
    });

    stats.pending = requests.filter(r => {
      const d = parseISO(r.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year && (r.employeeId === empId || r.employeeId === users.find(u => u.employeeId === empId)?.id) && r.status === 'pending';
    }).length;

    return stats;
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const handleApprove = (req) => {
    const workUnitMap = { leave_full: 0, leave_morning: 0.5, leave_afternoon: 0.5, late: 1, early_leave: 1 };
    const workUnit = workUnitMap[req.requestType];

    let allRecords = [...records];
    const existingIndex = allRecords.findIndex(r => r.employeeId === req.employeeId && r.date === req.date);
    let targetRecord = null;
    
    if (existingIndex >= 0) {
      allRecords[existingIndex] = { ...allRecords[existingIndex], status: req.requestType, workUnit, updatedBy: user.employeeId || user.id, updatedAt: new Date().toISOString() };
      targetRecord = allRecords[existingIndex];
    } else {
      targetRecord = { id: crypto.randomUUID(), employeeId: req.employeeId, date: req.date, status: req.requestType, workUnit, createdBy: user.employeeId || user.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      allRecords.push(targetRecord);
    }

    let allRequests = [...requests];
    const reqIndex = allRequests.findIndex(r => r.id === req.id);
    let targetRequest = null;
    if (reqIndex >= 0) {
      allRequests[reqIndex] = { ...allRequests[reqIndex], status: 'approved', approvedBy: user.employeeId || user.id, updatedAt: new Date().toISOString() };
      targetRequest = allRequests[reqIndex];
    }

    localStorage.setItem('attendanceRecords', JSON.stringify(allRecords));
    localStorage.setItem('attendanceRequests', JSON.stringify(allRequests));
    
    if (targetRecord) saveAttendanceRecordToSupabase(targetRecord);
    if (targetRequest) saveAttendanceRequestToSupabase(targetRequest);
    
    syncNotificationStatus(req.id, 'completed');
    toast.success('Đã duyệt yêu cầu.');
    loadData();
  };

  const handleReject = () => {
    if (!rejectReason.trim()) { toast.error('Vui lòng nhập lý do từ chối.'); return; }

    let allRequests = [...requests];
    const reqIndex = allRequests.findIndex(r => r.id === selectedRequest.id);
    let targetRequest = null;
    
    if (reqIndex >= 0) {
      allRequests[reqIndex] = { ...allRequests[reqIndex], status: 'rejected', adminNote: rejectReason, updatedBy: user.employeeId || user.id, updatedAt: new Date().toISOString() };
      targetRequest = allRequests[reqIndex];
    }

    localStorage.setItem('attendanceRequests', JSON.stringify(allRequests));
    
    if (targetRequest) saveAttendanceRequestToSupabase(targetRequest);
    
    syncNotificationStatus(selectedRequest.id, 'completed');
    toast.success('Đã từ chối yêu cầu.');
    setRejectModalOpen(false);
    loadData();
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm.employeeId || !editForm.date || !editForm.status) { toast.error('Vui lòng điền thông bắt buộc.'); return; }

    let allRecords = [...records];
    const existingIndex = allRecords.findIndex(r => r.employeeId === editForm.employeeId && r.date === editForm.date);
    
    const payload = {
      status: editForm.status, workUnit: Number(editForm.workUnit) || 0,
      checkInTime: editForm.checkInTime || '', checkOutTime: editForm.checkOutTime || '',
      note: editForm.note || '', updatedBy: user.employeeId || user.id, updatedAt: new Date().toISOString()
    };

    let targetRecord = null;
    if (existingIndex >= 0) {
      allRecords[existingIndex] = { ...allRecords[existingIndex], ...payload };
      targetRecord = allRecords[existingIndex];
    } else {
      targetRecord = { id: crypto.randomUUID(), employeeId: editForm.employeeId, date: editForm.date, createdBy: user.employeeId || user.id, createdAt: new Date().toISOString(), ...payload };
      allRecords.push(targetRecord);
    }

    localStorage.setItem('attendanceRecords', JSON.stringify(allRecords));
    
    if (targetRecord) saveAttendanceRecordToSupabase(targetRecord);
    
    toast.success('Đã cập nhật chấm công.');
    setEditForm({ employeeId: '', date: '', status: '', checkInTime: '', checkOutTime: '', workUnit: 1, note: '' });
    loadData();
  };

  return (
    <>
      <Helmet><title>Quản lý chấm công - Dr Tuấn Hùng</title></Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-30 pt-safe">
          <div className="flex items-center gap-3">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" /> Quản lý chấm công</h1>
            {isSyncing && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin ml-2 hidden md:block" />}
          </div>
          {user?.role === 'Admin' && (
            <Button 
              variant="outline" 
              onClick={handleBulkSync}
              disabled={isBulkSyncing || isSyncing}
              size={isMobile ? "sm" : "default"}
              className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors shadow-sm"
            >
              {(isBulkSyncing || isSyncing) ? <Loader2 className="w-4 h-4 md:mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 md:mr-2" />}
              <span className="hidden md:inline">Đồng bộ Supabase</span>
            </Button>
          )}
        </header>
        
        <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-safe-nav">
          <Tabs defaultValue="table" className="w-full">
            <TabsList className="bg-card border shadow-sm p-1 rounded-xl h-auto mb-6 flex-wrap">
              <TabsTrigger value="table" className="py-2.5 px-4 md:px-6 rounded-lg font-medium flex-1">Bảng công</TabsTrigger>
              <TabsTrigger value="requests" className="py-2.5 px-4 md:px-6 rounded-lg font-medium flex-1 flex items-center justify-center gap-2">
                Chờ duyệt
                {pendingRequests.length > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1.5 py-0 text-[10px] rounded-full">{pendingRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="edit" className="py-2.5 px-4 md:px-6 rounded-lg font-medium flex-1">Cập nhật</TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="m-0 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 w-full bg-card p-4 rounded-xl border border-border shadow-sm mb-4">
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger className="h-11 w-full md:w-32"><SelectValue placeholder="Tháng" /></SelectTrigger>
                    <SelectContent>{Array.from({length: 12}, (_,i) => i+1).map(m => <SelectItem key={m} value={m.toString()}>Tháng {m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger className="h-11 w-full md:w-32"><SelectValue placeholder="Năm" /></SelectTrigger>
                    <SelectContent>{[year-1, year, year+1].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="relative w-full md:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Tìm nhân viên..." className="pl-9 h-11 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="w-full md:w-48">
                  <Select value={positionFilter} onValueChange={setPositionFilter}>
                    <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Vị trí" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả vị trí</SelectItem>
                      <SelectItem value="TELESALE">TELESALE</SelectItem>
                      <SelectItem value="Điều dưỡng">Điều dưỡng</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sale Offline">Sale Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isMobile ? (
                <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-12 text-center">STT</TableHead>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead>Vị trí</TableHead>
                        <TableHead className="text-center font-semibold text-primary">Tổng công</TableHead>
                        <TableHead className="text-center text-emerald-600">Check in</TableHead>
                        <TableHead className="text-center text-rose-600">Vắng</TableHead>
                        <TableHead className="text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Không tìm thấy dữ liệu.</TableCell></TableRow>
                      ) : (
                        filteredUsers.map((u, i) => {
                          const stats = getUserStats(u.employeeId);
                          return (
                            <TableRow key={u.id}>
                              <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                              <TableCell><div className="font-semibold">{u.fullName}</div><div className="text-xs text-muted-foreground">{u.employeeId}</div></TableCell>
                              <TableCell><Badge variant="outline" className="font-normal">{u.departmentPosition || '-'}</Badge></TableCell>
                              <TableCell className="text-center tabular-nums font-bold text-primary">{stats.totalWork}</TableCell>
                              <TableCell className="text-center tabular-nums font-medium text-emerald-600">{stats.checkedIn}</TableCell>
                              <TableCell className="text-center tabular-nums font-medium text-rose-600">{stats.absent}</TableCell>
                              <TableCell className="text-center">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedCalendarUser(u)}>
                                  <UserCircle className="w-4 h-4 mr-2" /> Chi tiết
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-card rounded-2xl border text-center text-muted-foreground">
                       <CalendarDays className="w-10 h-10 mb-3 text-muted-foreground/30" />
                       <p>Không tìm thấy dữ liệu</p>
                    </div>
                  ) : (
                    filteredUsers.map(u => <ResponsiveAttendanceCard key={u.id} u={u} stats={getUserStats(u.employeeId)} onDetail={() => setSelectedCalendarUser(u)} />)
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="requests" className="m-0">
               {!isMobile ? (
                 <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="w-12 text-center">STT</TableHead>
                          <TableHead>Nhân viên</TableHead>
                          <TableHead>Loại yêu cầu</TableHead>
                          <TableHead>Ngày xin</TableHead>
                          <TableHead className="w-1/3">Lý do</TableHead>
                          <TableHead className="text-center">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRequests.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Không có yêu cầu nào chờ duyệt.</TableCell></TableRow>
                        ) : (
                          pendingRequests.map((req, i) => {
                            const emp = users.find(u => u.employeeId === req.employeeId || u.id === req.employeeId);
                            return (
                              <TableRow key={req.id}>
                                <TableCell className="text-center">{i + 1}</TableCell>
                                <TableCell><div className="font-medium">{emp?.fullName}</div></TableCell>
                                <TableCell><Badge variant="outline">{REQUEST_TYPES[req.requestType]}</Badge></TableCell>
                                <TableCell>{format(parseISO(req.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="text-sm">{req.reason}</TableCell>
                                <TableCell className="text-center">
                                  <Button variant="ghost" size="icon" className="text-emerald-600 h-8 w-8" onClick={() => handleApprove(req)}><CheckCircle className="w-4 h-4" /></Button>
                                  <Button variant="ghost" size="icon" className="text-rose-600 h-8 w-8" onClick={() => { setSelectedRequest(req); setRejectModalOpen(true); }}><XCircle className="w-4 h-4" /></Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                 </div>
               ) : (
                 <div className="space-y-3 mt-4">
                   {pendingRequests.length === 0 ? (
                     <div className="flex flex-col items-center justify-center p-8 bg-card rounded-2xl border text-center text-muted-foreground">
                        Không có yêu cầu nào chờ duyệt.
                     </div>
                   ) : (
                     pendingRequests.map(req => {
                        const emp = users.find(u => u.employeeId === req.employeeId || u.id === req.employeeId);
                        return <ResponsiveAttendanceRequestCard key={req.id} req={req} emp={emp} onApprove={handleApprove} onReject={() => { setSelectedRequest(req); setRejectModalOpen(true); }} statusBadgeProps={{label: REQUEST_TYPES[req.requestType] || req.requestType, class: STATUS_MAP[req.requestType]?.class}} />
                     })
                   )}
                 </div>
               )}
            </TabsContent>

            <TabsContent value="edit" className="m-0">
              <Card className="shadow-sm border-border max-w-2xl mx-auto">
                <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2"><FileEdit className="w-5 h-5 text-primary" /> Cập nhật chấm công</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nhân viên <span className="text-destructive">*</span></Label>
                      <Select value={editForm.employeeId} onValueChange={v => setEditForm({...editForm, employeeId: v})}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                        <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.employeeId}>{u.employeeId} - {u.fullName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ngày <span className="text-destructive">*</span></Label>
                      <Input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label>Trạng thái <span className="text-destructive">*</span></Label>
                      <Select value={editForm.status} onValueChange={v => { const wMap = { present:1, leave_full:0, leave_morning:0.5, leave_afternoon:0.5, late:1, early_leave:1, absent:0 }; setEditForm({...editForm, status: v, workUnit: wMap[v]}); }}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
                        <SelectContent>{Object.entries(STATUS_MAP).map(([key, val]) => <SelectItem key={key} value={key}>{val.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Số công</Label>
                      <Input type="number" step="0.5" min="0" max="1" value={editForm.workUnit} onChange={e => setEditForm({...editForm, workUnit: e.target.value})} className="h-11" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Ghi chú</Label>
                      <Textarea placeholder="Lý do điều chỉnh..." value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} className="min-h-[80px]" />
                    </div>
                    <Button type="submit" className="w-full h-12 font-bold text-base mt-2">Lưu thay đổi</Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        <Dialog open={!!selectedCalendarUser} onOpenChange={(open) => !open && setSelectedCalendarUser(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Chi tiết chấm công - <span className="text-primary">{selectedCalendarUser?.fullName}</span> ({selectedCalendarUser?.employeeId})
              </DialogTitle>
            </DialogHeader>
            {selectedCalendarUser && (
              <div className="mt-4 pb-4">
                <AttendanceCalendar
                  month={month}
                  year={year}
                  onMonthChange={(m, y) => { setMonth(m); setYear(y); }}
                  records={records}
                  requests={requests}
                  currentUserId={selectedCalendarUser.employeeId || selectedCalendarUser.id}
                  isAdmin={true}
                  onSaved={loadData}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent className="sm:max-w-md mx-4 rounded-xl">
            <DialogHeader><DialogTitle>Từ chối yêu cầu</DialogTitle></DialogHeader>
            <div className="space-y-2 py-4">
              <Label>Lý do từ chối <span className="text-destructive">*</span></Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="min-h-[100px]" />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setRejectModalOpen(false)}>Hủy</Button>
              <Button variant="destructive" className="w-full sm:w-auto" onClick={handleReject}>Từ chối</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AttendanceAdminPage;
