
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useAttendance } from '@/hooks/useAttendance.js';
import { getUsers } from '@/utils/userStorage.js';
import { uploadAllAttendanceToSupabase } from '@/services/dataService.js';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Search, CalendarDays, RefreshCw, Loader2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import AttendanceCalendar from '@/components/AttendanceCalendar.jsx';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Đã check in' },
  { value: 'leave_full', label: 'Nghỉ cả ngày' },
  { value: 'leave_morning', label: 'Nghỉ sáng' },
  { value: 'leave_afternoon', label: 'Nghỉ chiều' },
  { value: 'late', label: 'Đi muộn' },
  { value: 'early_leave', label: 'Về sớm' },
  { value: 'absent', label: 'Vắng mặt' }
];

const AdminAttendanceModule = () => {
  const { user } = useAuth();
  const { 
    isSyncing,
    syncData,
    getAttendanceRecords, 
    getAttendanceRequests, 
    createAttendanceRecord, 
    updateAttendanceRecord,
    updateAttendanceRequest,
    getStatusBadge,
    formatDateVN,
    formatTimeVN
  } = useAttendance();

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [requests, setRequests] = useState([]);

  const [deptFilter, setDeptFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCalendarUser, setSelectedCalendarUser] = useState(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const [editForm, setEditForm] = useState({
    employeeId: '',
    date: '',
    status: '',
    checkInTime: '',
    checkOutTime: '',
    workUnit: 1,
    note: ''
  });

  const loadData = () => {
    const allUsers = getUsers().filter(u => u.role === 'Nhân viên');
    setUsers(allUsers);
    setRecords(getAttendanceRecords());
    setRequests(getAttendanceRequests());
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing]); // Reload data when useAttendance sync completes

  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg font-medium text-destructive">Bạn không có quyền truy cập chức năng này.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    if (deptFilter !== 'all' && u.departmentPosition !== deptFilter) return false;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      return u.employeeId.toLowerCase().includes(lower) || u.fullName.toLowerCase().includes(lower);
    }
    return true;
  });

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

  const getUserMonthStats = (empId) => {
    const mRecords = records.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year && (r.employeeId === empId || r.employeeId === users.find(u => u.employeeId === empId)?.id);
    });
    
    let stats = { totalWork: 0, checkedIn: 0, leaveFull: 0, leaveHalf: 0, late: 0, early: 0, absent: 0 };
    
    mRecords.forEach(r => {
      stats.totalWork += (Number(r.workUnit) || 0);
      if (['present','late','early_leave'].includes(r.status)) stats.checkedIn++;
      if (r.status === 'leave_full') stats.leaveFull++;
      if (['leave_morning','leave_afternoon'].includes(r.status)) stats.leaveHalf++;
      if (r.status === 'late') stats.late++;
      if (r.status === 'early_leave') stats.early++;
      if (r.status === 'absent') stats.absent++;
    });

    const pendingReqs = requests.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year && (r.employeeId === empId || r.employeeId === users.find(u => u.employeeId === empId)?.id) && r.status === 'pending';
    }).length;

    return { ...stats, pendingReqs };
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const handleApprove = (req) => {
    const workUnitMap = {
      leave_full: 0,
      leave_morning: 0.5,
      leave_afternoon: 0.5,
      late: 1,
      early_leave: 1
    };

    const existingRecord = records.find(r => r.employeeId === req.employeeId && r.date === req.date);
    const workUnit = workUnitMap[req.requestType];

    if (existingRecord) {
      updateAttendanceRecord(existingRecord.id, {
        status: req.requestType,
        workUnit: workUnit,
        updatedBy: user.employeeId || user.id
      });
    } else {
      createAttendanceRecord({
        employeeId: req.employeeId,
        date: req.date,
        status: req.requestType,
        workUnit: workUnit,
        createdBy: user.employeeId || user.id
      });
    }

    updateAttendanceRequest(req.id, { status: 'approved', approvedBy: user.employeeId || user.id });
    toast.success('Đã duyệt yêu cầu.');
    loadData();
  };

  const openRejectModal = (req) => {
    setRequestToReject(req);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    updateAttendanceRequest(requestToReject.id, { 
      status: 'rejected', 
      adminNote: rejectReason, 
      updatedBy: user.employeeId || user.id 
    });
    toast.success('Đã từ chối yêu cầu.');
    setRejectModalOpen(false);
    loadData();
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm.employeeId || !editForm.date || !editForm.status) {
      toast.error('Vui lòng điền đủ thông tin bắt buộc');
      return;
    }

    const existingRecord = records.find(r => r.employeeId === editForm.employeeId && r.date === editForm.date);
    
    const payload = {
      status: editForm.status,
      workUnit: Number(editForm.workUnit) || 0,
      checkInTime: editForm.checkInTime,
      checkOutTime: editForm.checkOutTime,
      note: editForm.note,
      updatedBy: user.employeeId || user.id
    };

    if (existingRecord) {
      updateAttendanceRecord(existingRecord.id, payload);
    } else {
      createAttendanceRecord({
        employeeId: editForm.employeeId,
        date: editForm.date,
        ...payload,
        createdBy: user.employeeId || user.id
      });
    }

    toast.success('Đã cập nhật chấm công.');
    setEditForm({ employeeId: '', date: '', status: '', checkInTime: '', checkOutTime: '', workUnit: 1, note: '' });
    loadData();
  };

  return (
    <>
      <Helmet>
        <title>Quản lý chấm công - Dr Tuấn Hùng</title>
      </Helmet>

      <div className="min-h-screen bg-muted/30 flex flex-col pb-12">
        <Header />
        
        <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Quản lý chấm công</h1>
              <p className="text-muted-foreground mt-1 text-base">Theo dõi và phê duyệt chấm công nhân sự</p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleBulkSync}
              disabled={isBulkSyncing || isSyncing}
              className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors shadow-sm"
            >
              {(isBulkSyncing || isSyncing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Đồng bộ Supabase
            </Button>
          </div>

          <Tabs defaultValue="bang-cham-cong" className="w-full space-y-6">
            <TabsList className="bg-card border shadow-sm p-1 rounded-xl h-auto">
              <TabsTrigger value="bang-cham-cong" className="py-2.5 px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">BẢNG CHẤM CÔNG</TabsTrigger>
              <TabsTrigger value="yeu-cau" className="py-2.5 px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">YÊU CẦU CHỜ DUYỆT {pendingRequests.length > 0 && <Badge variant="destructive" className="ml-2 rounded-full px-1.5 py-0 min-w-5 h-5">{pendingRequests.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="chinh-sua" className="py-2.5 px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">CHỈNH SỬA CÔNG</TabsTrigger>
            </TabsList>

            <TabsContent value="bang-cham-cong">
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="flex items-center gap-2">
                        <Label>Tháng</Label>
                        <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v))}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({length:12}, (_,i) => i+1).map(m => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label>Năm</Label>
                        <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[year-1, year, year+1].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Tìm kiếm..." 
                          className="pl-9"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Select value={deptFilter} onValueChange={setDeptFilter}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Vị trí" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả</SelectItem>
                          <SelectItem value="TELESALE">TELESALE</SelectItem>
                          <SelectItem value="Điều dưỡng">Điều dưỡng</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Media">Media</SelectItem>
                          <SelectItem value="Sale Offline">Sale Offline</SelectItem>
                          <SelectItem value="CSKH">CSKH</SelectItem>
                          <SelectItem value="Trực page">Trực page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-12 text-center">STT</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Họ và tên</TableHead>
                          <TableHead>Vị trí</TableHead>
                          <TableHead className="text-center">Tổng công</TableHead>
                          <TableHead className="text-center">Check in</TableHead>
                          <TableHead className="text-center text-slate-500">Nghỉ full</TableHead>
                          <TableHead className="text-center text-indigo-500">Nghỉ 1/2</TableHead>
                          <TableHead className="text-center text-amber-500">Đi muộn</TableHead>
                          <TableHead className="text-center text-amber-500">Về sớm</TableHead>
                          <TableHead className="text-center text-rose-500">Vắng</TableHead>
                          <TableHead className="text-center text-blue-500">Chờ duyệt</TableHead>
                          <TableHead className="text-center">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Không có dữ liệu</TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((u, idx) => {
                            const stats = getUserMonthStats(u.employeeId);
                            return (
                              <TableRow key={u.id}>
                                <TableCell className="text-center">{idx + 1}</TableCell>
                                <TableCell className="font-medium">{u.employeeId}</TableCell>
                                <TableCell>{u.fullName}</TableCell>
                                <TableCell><Badge variant="outline" className="bg-secondary/40 font-normal">{u.departmentPosition || '-'}</Badge></TableCell>
                                <TableCell className="text-center font-bold text-primary">{stats.totalWork}</TableCell>
                                <TableCell className="text-center">{stats.checkedIn}</TableCell>
                                <TableCell className="text-center">{stats.leaveFull}</TableCell>
                                <TableCell className="text-center">{stats.leaveHalf}</TableCell>
                                <TableCell className="text-center">{stats.late}</TableCell>
                                <TableCell className="text-center">{stats.early}</TableCell>
                                <TableCell className="text-center">{stats.absent}</TableCell>
                                <TableCell className="text-center">
                                  {stats.pendingReqs > 0 ? (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">{stats.pendingReqs}</Badge>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedCalendarUser(u)}>
                                    <CalendarDays className="w-4 h-4 mr-2" /> Xem chi tiết
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="yeu-cau">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Danh sách yêu cầu chờ duyệt</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-12 text-center">STT</TableHead>
                          <TableHead>Ngày gửi</TableHead>
                          <TableHead>Nhân sự</TableHead>
                          <TableHead>Ngày xin</TableHead>
                          <TableHead>Loại yêu cầu</TableHead>
                          <TableHead>Thời gian</TableHead>
                          <TableHead className="w-1/4">Lý do</TableHead>
                          <TableHead className="text-center">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRequests.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Không có yêu cầu nào chờ duyệt.</TableCell>
                          </TableRow>
                        ) : (
                          pendingRequests.map((req, idx) => {
                            const emp = users.find(u => u.employeeId === req.employeeId || u.id === req.employeeId);
                            return (
                              <TableRow key={req.id}>
                                <TableCell className="text-center">{idx + 1}</TableCell>
                                <TableCell className="text-muted-foreground">{formatDateVN(req.createdAt)}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{emp?.fullName}</div>
                                  <div className="text-xs text-muted-foreground">{emp?.employeeId}</div>
                                </TableCell>
                                <TableCell className="font-medium">{formatDateVN(req.date)}</TableCell>
                                <TableCell>
                                  <Badge className={`px-2 py-0.5 shadow-none ${getStatusBadge(req.requestType).class}`}>
                                    {getStatusBadge(req.requestType).label}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatTimeVN(req.requestedTime) || '-'}</TableCell>
                                <TableCell className="text-sm truncate max-w-[200px]" title={req.reason}>{req.reason}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleApprove(req)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                                      <CheckCircle className="w-5 h-5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => openRejectModal(req)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                                      <XCircle className="w-5 h-5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chinh-sua">
              <Card className="border-border shadow-sm max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-lg">Cập nhật chấm công thủ công</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEditSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nhân sự <span className="text-destructive">*</span></Label>
                        <Select value={editForm.employeeId} onValueChange={v => setEditForm({...editForm, employeeId: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn nhân sự" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map(u => (
                              <SelectItem key={u.id} value={u.employeeId}>{u.employeeId} - {u.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Ngày <span className="text-destructive">*</span></Label>
                        <Input 
                          type="date" 
                          value={editForm.date}
                          onChange={e => setEditForm({...editForm, date: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Trạng thái <span className="text-destructive">*</span></Label>
                        <Select value={editForm.status} onValueChange={v => {
                          const wMap = { present:1, leave_full:0, leave_morning:0.5, leave_afternoon:0.5, late:1, early_leave:1, absent:0 };
                          setEditForm({...editForm, status: v, workUnit: wMap[v]});
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn trạng thái" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Số công</Label>
                        <Input 
                          type="number" 
                          step="0.5" 
                          min="0" 
                          max="1"
                          value={editForm.workUnit}
                          onChange={e => setEditForm({...editForm, workUnit: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Giờ Check in</Label>
                        <Input 
                          type="time" 
                          value={editForm.checkInTime}
                          onChange={e => setEditForm({...editForm, checkInTime: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Giờ Check out</Label>
                        <Input 
                          type="time" 
                          value={editForm.checkOutTime}
                          onChange={e => setEditForm({...editForm, checkOutTime: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Ghi chú của Admin</Label>
                      <Textarea 
                        placeholder="Nhập ghi chú (nếu có)..."
                        value={editForm.note}
                        onChange={e => setEditForm({...editForm, note: e.target.value})}
                      />
                    </div>

                    <Button type="submit" className="w-full">Lưu thay đổi</Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        <Dialog open={!!selectedCalendarUser} onOpenChange={(open) => !open && setSelectedCalendarUser(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  currentUserId={selectedCalendarUser.employeeId}
                  isAdmin={true}
                  onSaved={loadData}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Từ chối yêu cầu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Lý do từ chối <span className="text-destructive">*</span></Label>
                <Textarea 
                  placeholder="Nhập lý do từ chối để nhân sự biết..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Hủy</Button>
              <Button variant="destructive" onClick={handleReject}>Xác nhận từ chối</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AdminAttendanceModule;
