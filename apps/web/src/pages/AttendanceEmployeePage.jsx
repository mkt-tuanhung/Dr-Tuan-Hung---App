
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { format, isBefore, isToday, startOfDay, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createApprovalNotification } from '@/utils/ApprovalNotificationHelper.js';
import { getAttendanceDayStyle } from '@/utils/getAttendanceDayStyle.js';
import { 
  syncAttendanceRecordsWithSupabase, 
  syncAttendanceRequestsWithSupabase,
  saveAttendanceRecordToSupabase,
  saveAttendanceRequestToSupabase
} from '@/services/dataService.js';

import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

const REQUEST_TYPES = [
  { value: 'leave_full', label: 'Xin nghỉ cả ngày' },
  { value: 'leave_morning', label: 'Nghỉ 1/2 ngày sáng' },
  { value: 'leave_afternoon', label: 'Nghỉ 1/2 ngày chiều' },
  { value: 'late', label: 'Xin đi muộn' },
  { value: 'early_leave', label: 'Xin về sớm' }
];

const AttendanceEmployeePage = () => {
  const { user } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [records, setRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('menu');
  const [requestForm, setRequestForm] = useState({ type: '', time: '', reason: '' });
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = () => {
    const empId = user.employeeId || user.id;
    const allRecords = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    const allRequests = JSON.parse(localStorage.getItem('attendanceRequests') || '[]');
    setRecords(allRecords.filter(r => r.employeeId === empId));
    setRequests(allRequests.filter(r => r.employeeId === empId));
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
  }, [user.id, user.employeeId]);

  // Lắng nghe sự kiện realtime từ Supabase
  useEffect(() => {
    window.addEventListener('supabase-data-updated', loadData);
    return () => {
      window.removeEventListener('supabase-data-updated', loadData);
    };
  }, []);

  const stats = useMemo(() => {
    const monthStr = format(currentDate, 'yyyy-MM');
    const monthRecords = records.filter(r => r.date.startsWith(monthStr));
    const monthRequests = requests.filter(r => r.date.startsWith(monthStr));

    const totalWorkUnits = monthRecords.reduce((sum, r) => sum + (Number(r.workUnit) || 0), 0);
    const checkedInDays = monthRecords.filter(r => ['present', 'late', 'early_leave'].includes(r.status)).length;
    const leaveDays = monthRecords.filter(r => r.status.includes('leave')).length;
    const pendingReqs = monthRequests.filter(r => r.status === 'pending').length;

    return { totalWorkUnits, checkedInDays, leaveDays, pendingReqs };
  }, [records, requests, currentDate]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleDayClick = (day) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const todayStart = startOfDay(new Date());

    setSelectedDate(clickedDate);
    
    if (isBefore(clickedDate, todayStart)) {
      setModalMode('view');
    } else {
      setModalMode('menu');
    }
    
    setRequestForm({ type: '', time: '', reason: '' });
    setIsModalOpen(true);
  };

  const handleCheckIn = () => {
    if (!selectedDate) return;
    
    if (!isToday(selectedDate)) {
      toast.error('Chỉ có thể check in cho ngày hôm nay.');
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    const existing = records.find(r => r.date === dateStr && r.status === 'present');
    if (existing) {
      toast.error('Bạn đã check in ngày này.');
      return;
    }

    const allRecords = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    const empId = user.employeeId || user.id;

    const existingAny = allRecords.find(r => r.date === dateStr && r.employeeId === empId);
    let targetRecord = null;
    
    if (existingAny) {
      existingAny.status = 'present';
      existingAny.checkInTime = format(new Date(), 'HH:mm');
      existingAny.workUnit = 1;
      existingAny.updatedAt = new Date().toISOString();
      localStorage.setItem('attendanceRecords', JSON.stringify(allRecords));
      targetRecord = existingAny;
    } else {
      targetRecord = {
        id: crypto.randomUUID(),
        employeeId: empId,
        date: dateStr,
        status: 'present',
        workUnit: 1,
        checkInTime: format(new Date(), 'HH:mm'),
        createdBy: empId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('attendanceRecords', JSON.stringify([...allRecords, targetRecord]));
    }

    if (targetRecord) {
      saveAttendanceRecordToSupabase(targetRecord);
    }

    toast.success('Check in thành công.');
    loadData();
    setIsModalOpen(false);
  };

  const handleRequestSubmit = async () => {
    if (!requestForm.type) {
      toast.error('Vui lòng chọn loại yêu cầu.'); return;
    }
    if (['late', 'early_leave'].includes(requestForm.type) && !requestForm.time) {
      toast.error('Vui lòng nhập thời gian.'); return;
    }
    if (!requestForm.reason.trim()) {
      toast.error('Vui lòng nhập lý do.'); return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const empId = user.employeeId || user.id;

    const existing = requests.find(r => r.date === dateStr && r.requestType === requestForm.type && r.status === 'pending');
    if (existing) {
      toast.error('Bạn đã có yêu cầu tương tự đang chờ duyệt trong ngày này.');
      return;
    }

    const allRequests = JSON.parse(localStorage.getItem('attendanceRequests') || '[]');
    const newRequest = {
      id: crypto.randomUUID(),
      employeeId: empId,
      date: dateStr,
      requestType: requestForm.type,
      requestedTime: requestForm.time || null,
      reason: requestForm.reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('attendanceRequests', JSON.stringify([...allRequests, newRequest]));
    await saveAttendanceRequestToSupabase(newRequest);
    
    const reqTypeLabel = REQUEST_TYPES.find(t => t.value === requestForm.type)?.label || requestForm.type;
    const msg = `${user.fullName} gửi yêu cầu ${reqTypeLabel.toLowerCase()} ngày ${format(selectedDate, 'dd/MM/yyyy')}`;
    
    await createApprovalNotification(
      newRequest.id,
      'attendance_requests',
      'attendance_request',
      'Yêu cầu chấm công mới',
      msg,
      user.id || user.employeeId,
      user.fullName,
      ['Admin', 'Kế toán']
    );

    toast.success('Đã gửi yêu cầu, chờ Admin phê duyệt.');
    loadData();
    setIsModalOpen(false);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getDay(startOfMonth(currentDate));
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const cells = [];
    
    for (let i = 0; i < startOffset; i++) {
      cells.push(<div key={`empty-${i}`} className="aspect-square min-w-0 w-full bg-white border border-gray-100 opacity-50 rounded-2xl"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), day), 'yyyy-MM-dd');
      const isDayToday = isToday(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
      
      const dayRecord = records.find(r => r.date === dateStr);
      const dayPendingReqs = requests.filter(r => r.date === dateStr && r.status === 'pending');
      
      const displayStatus = dayPendingReqs.length > 0 ? 'pending' : (dayRecord?.status || null);
      const style = getAttendanceDayStyle(displayStatus);

      cells.push(
        <div 
          key={day} 
          onClick={() => handleDayClick(day)}
          className={`aspect-square min-w-0 w-full rounded-2xl border flex flex-col items-center justify-center gap-1 overflow-hidden shadow-sm cursor-pointer transition-all duration-200
            ${isDayToday ? 'ring-2 ring-primary/50' : 'hover:opacity-80 hover:-translate-y-0.5'} 
            ${style.classes}
          `}
        >
          <span className={`text-sm sm:text-base font-bold leading-none ${isDayToday && !style.shortLabel ? 'text-primary' : ''}`}>
            {day}
          </span>
          {style.shortLabel && (
            <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md bg-white/50 text-current leading-none">
              {style.shortLabel}
            </span>
          )}
        </div>
      );
    }

    return cells;
  };

  const getSelectedDateRecord = () => {
    if (!selectedDate) return null;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return records.find(r => r.date === dateStr);
  };

  return (
    <>
      <Helmet>
        <title>Chấm công cá nhân - Dr Tuấn Hùng</title>
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-muted/30">
        <Header />
        
        <main className="flex-1 container max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24 md:pb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Chấm công cá nhân</h1>
              <p className="text-muted-foreground mt-1">Theo dõi lịch làm việc và quản lý yêu cầu vắng mặt</p>
            </div>
            {isSyncing && (
              <div className="flex items-center text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang đồng bộ...
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm border-border">
              <CardContent className="p-4 flex flex-col items-start gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.totalWorkUnits}</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tổng công</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm border-border">
              <CardContent className="p-4 flex flex-col items-start gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.checkedInDays}</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ngày Check in</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardContent className="p-4 flex flex-col items-start gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.leaveDays}</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ngày nghỉ</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardContent className="p-4 flex flex-col items-start gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.pendingReqs}</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Yêu cầu chờ</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-border rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-border bg-card">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Tháng {format(currentDate, 'MM/yyyy')}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
                {renderCalendar()}
              </div>
            </CardContent>
          </Card>
        </main>
        
        <Footer />

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl mx-auto">
            <DialogHeader>
              <DialogTitle>
                Ngày {selectedDate && format(selectedDate, 'dd/MM/yyyy')}
              </DialogTitle>
              <DialogDescription>
                {modalMode === 'menu' ? 'Chọn thao tác cho ngày này.' : modalMode === 'view' ? 'Chi tiết chấm công' : 'Điền thông tin yêu cầu'}
              </DialogDescription>
            </DialogHeader>

            {modalMode === 'view' && (
              <div className="space-y-4 py-4">
                {(() => {
                  const record = getSelectedDateRecord();
                  if (!record) {
                    return <div className="text-center text-muted-foreground py-4">Không có dữ liệu chấm công cho ngày này.</div>;
                  }
                  const style = getAttendanceDayStyle(record.status);
                  return (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-sm font-medium text-gray-600">Trạng thái</span>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${style.classes}`}>{style.shortLabel || record.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-xs text-gray-500 block mb-1">Giờ Check in</span>
                          <span className="font-semibold text-gray-900">{record.checkInTime || '--:--'}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-xs text-gray-500 block mb-1">Giờ Check out</span>
                          <span className="font-semibold text-gray-900">{record.checkOutTime || '--:--'}</span>
                        </div>
                      </div>
                      {record.reason && (
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-xs text-gray-500 block mb-1">Ghi chú / Lý do</span>
                          <span className="text-sm text-gray-900">{record.reason}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setIsModalOpen(false)} className="w-full">Đóng</Button>
                </DialogFooter>
              </div>
            )}

            {modalMode === 'menu' && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3 mb-6">
                  <p className="text-sm font-medium text-primary flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Xác nhận có mặt
                  </p>
                  <Button 
                    onClick={handleCheckIn} 
                    disabled={!selectedDate || !isToday(selectedDate)}
                    className="w-full h-11 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Check in {selectedDate && isToday(selectedDate) ? 'hôm nay' : ''}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Tạo yêu cầu</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {REQUEST_TYPES.map(type => (
                      <Button 
                        key={type.value} 
                        variant="outline" 
                        className="justify-start h-10 font-normal"
                        onClick={() => {
                          setRequestForm(prev => ({ ...prev, type: type.value }));
                          setModalMode('request');
                        }}
                      >
                        {type.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {modalMode === 'request' && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Loại yêu cầu</Label>
                  <Select 
                    value={requestForm.type} 
                    onValueChange={(val) => setRequestForm({...requestForm, type: val})}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {['late', 'early_leave'].includes(requestForm.type) && (
                  <div className="space-y-2">
                    <Label>Thời gian dự kiến</Label>
                    <Input 
                      type="time" 
                      value={requestForm.time}
                      onChange={(e) => setRequestForm({...requestForm, time: e.target.value})}
                      className="h-11"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Lý do</Label>
                  <Textarea 
                    placeholder="Nhập lý do chi tiết..."
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
                    className="min-h-[100px] resize-none"
                  />
                </div>
                
                <DialogFooter className="pt-4 flex flex-row justify-between gap-2 sm:justify-between">
                  <Button variant="ghost" onClick={() => setModalMode('menu')} className="mr-auto">
                    Quay lại
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                    <Button onClick={handleRequestSubmit}>Gửi yêu cầu</Button>
                  </div>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AttendanceEmployeePage;
