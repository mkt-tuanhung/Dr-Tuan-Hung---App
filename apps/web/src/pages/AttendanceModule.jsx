
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useAttendance } from '@/hooks/useAttendance.js';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Loader2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import AttendanceStatsCard from '@/components/AttendanceStatsCard.jsx';
import AttendanceCalendar from '@/components/AttendanceCalendar.jsx';
import AttendanceRequestForm from '@/components/AttendanceRequestForm.jsx';

const AttendanceModule = () => {
  const { user } = useAuth();
  const { 
    isSyncing,
    getAttendanceRecords, 
    getAttendanceRequests, 
    createAttendanceRecord, 
    createAttendanceRequest,
    formatDateVN 
  } = useAttendance();

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  
  const [records, setRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = () => {
    const empId = user?.employeeId || user?.id;
    if (!empId) return;
    setRecords(getAttendanceRecords({ employeeId: empId }));
    setRequests(getAttendanceRequests({ employeeId: empId }));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.employeeId, currentMonth, currentYear, isSyncing]);

  if (user?.role !== 'Nhân viên') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg font-medium text-destructive">Bạn không có quyền truy cập chức năng này.</p>
      </div>
    );
  }

  const handleDayClick = (dateStr) => {
    const selected = new Date(dateStr);
    selected.setHours(0,0,0,0);
    const now = new Date();
    now.setHours(0,0,0,0);

    if (selected < now) {
      toast.info('Ngày trong quá khứ chỉ được xem, không thể chỉnh sửa.');
      return;
    }
    
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

  const handleCheckIn = () => {
    const isCheckedIn = records.some(r => r.date === selectedDate && r.status === 'present');
    if (isCheckedIn) {
      toast.error('Bạn đã check in ngày này.');
      return;
    }

    const empId = user?.employeeId || user?.id;

    createAttendanceRecord({
      employeeId: empId,
      date: selectedDate,
      status: 'present',
      workUnit: 1,
      checkInTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      createdBy: empId
    });
    
    toast.success('Check in thành công.');
    loadData();
    setIsModalOpen(false);
  };

  const handleRequestSubmit = (data) => {
    createAttendanceRequest(data);
    toast.success('Đã gửi yêu cầu, chờ Admin phê duyệt.');
    loadData();
    setIsModalOpen(false);
  };

  const isToday = selectedDate === today.toISOString().split('T')[0];

  return (
    <>
      <Helmet>
        <title>Chấm công cá nhân - Dr Tuấn Hùng</title>
      </Helmet>
      
      <div className="min-h-screen bg-muted/30 flex flex-col pb-12">
        <Header />
        
        <main className="flex-1 container max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Chấm công cá nhân</h1>
              <p className="text-muted-foreground mt-1 text-base">Xem và quản lý lịch làm việc của bạn</p>
            </div>
            {isSyncing && (
              <div className="flex items-center text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang đồng bộ...
              </div>
            )}
          </div>

          <AttendanceStatsCard 
            records={records}
            requests={requests}
            month={currentMonth}
            year={currentYear}
            employeeId={user?.employeeId || user?.id}
          />

          <div className="bg-card border border-border shadow-sm rounded-2xl p-6">
            <AttendanceCalendar
              month={currentMonth}
              year={currentYear}
              onMonthChange={(m, y) => { setCurrentMonth(m); setCurrentYear(y); }}
              records={records}
              requests={requests}
              onDayClick={handleDayClick}
              currentUserId={user?.employeeId || user?.id}
              onSaved={loadData}
              isAdmin={false}
            />
          </div>
        </main>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Ngày {formatDateVN(selectedDate)}</DialogTitle>
              <DialogDescription>
                Lựa chọn thao tác cho ngày này.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {isToday && (
                <div className="bg-muted/50 p-4 rounded-xl border border-border space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MapPin className="w-4 h-4 text-primary" /> Check In Hôm Nay
                  </div>
                  <Button onClick={handleCheckIn} className="w-full h-12 text-base">
                    <Clock className="w-5 h-5 mr-2" /> Nhấn để Check In
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  Tạo yêu cầu báo nghỉ / đi muộn / về sớm
                </div>
                <AttendanceRequestForm 
                  date={selectedDate}
                  employeeId={user?.employeeId || user?.id}
                  existingRequests={requests}
                  onSubmitSuccess={handleRequestSubmit}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AttendanceModule;
