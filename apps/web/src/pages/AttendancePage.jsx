
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CalendarCheck, Clock } from 'lucide-react';

const AttendancePage = () => {
  const { currentStaff } = useAuth();
  const navigate = useNavigate();
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [status, setStatus] = useState('Có mặt');
  const [notes, setNotes] = useState('');

  const today = new Date();
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });

  const fetchRecords = async () => {
    try {
      const res = await pb.collection('attendance').getFullList({
        filter: `staff_id = "${currentStaff.id}" && attendance_date >= "${format(startOfMonth(today), 'yyyy-MM-dd')}"`,
        sort: '-attendance_date',
        $autoCancel: false
      });
      setRecords(res);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleDayClick = (day) => {
    if (!isToday(day)) {
      toast.info('Bạn chỉ có thể chấm công cho ngày hôm nay');
      return;
    }
    
    // Check if already checked in
    const existing = records.find(r => isSameDay(new Date(r.attendance_date), day));
    if (existing) {
      toast.info('Bạn đã chấm công hôm nay rồi');
      return;
    }

    setTime(format(new Date(), 'HH:mm'));
    setStatus('Có mặt');
    setNotes('');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!time || !status) return;
    setSubmitting(true);
    try {
      const payload = {
        staff_id: currentStaff.id,
        attendance_date: format(today, 'yyyy-MM-dd') + " 00:00:00.000Z",
        check_in_time: time,
        status,
        notes
      };
      
      await pb.collection('attendance').create(payload, { $autoCancel: false });
      toast.success('Chấm công thành công');
      setModalOpen(false);
      fetchRecords();
    } catch (err) {
      toast.error('Lỗi khi lưu chấm công');
    } finally {
      setSubmitting(false);
    }
  };

  const getRecordForDay = (day) => records.find(r => isSameDay(new Date(r.attendance_date), day));

  return (
    <>
      <Helmet><title>Chấm công - HR Portal</title></Helmet>
      
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4 sticky top-0 z-30 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => navigate('/staff-dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" /> Chấm công tháng {format(today, 'MM/yyyy')}
          </h1>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
          {/* Calendar Grid */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 gap-px bg-border/50">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
                <div key={d} className="bg-muted/30 p-3 text-center text-sm font-semibold text-muted-foreground">{d}</div>
              ))}
              
              {/* Padding days */}
              {Array.from({ length: startOfMonth(today).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="bg-card p-3 min-h-[100px]" />
              ))}
              
              {/* Actual days */}
              {daysInMonth.map(day => {
                const isCurrentDay = isToday(day);
                const record = getRecordForDay(day);
                
                return (
                  <div 
                    key={day.toString()} 
                    onClick={() => handleDayClick(day)}
                    className={`bg-card p-3 min-h-[100px] flex flex-col gap-2 transition-colors
                      ${isCurrentDay ? 'ring-2 ring-primary ring-inset cursor-pointer hover:bg-muted/50' : 'opacity-70'}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                        ${isCurrentDay ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                      `}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    {record && (
                      <div className="mt-auto text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1.5 rounded-md font-medium">
                        <div className="flex items-center gap-1 mb-0.5"><Clock className="w-3 h-3" /> {record.check_in_time}</div>
                        <div>{record.status}</div>
                      </div>
                    )}
                    {isCurrentDay && !record && (
                      <div className="mt-auto text-xs text-center border border-dashed border-primary/40 text-primary py-1 rounded-md">
                        Nhấn để chấm công
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* History Table */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-bold text-lg">Lịch sử chấm công</h2>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Chưa có dữ liệu chấm công tháng này</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Giờ vào</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{format(new Date(record.attendance_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{record.check_in_time}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted">
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{record.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </main>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Chấm công: {format(today, 'dd/MM/yyyy')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="space-y-2">
                <Label>Giờ check-in</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Có mặt">Có mặt</SelectItem>
                    <SelectItem value="Vắng">Vắng</SelectItem>
                    <SelectItem value="Muộn">Muộn</SelectItem>
                    <SelectItem value="Sớm">Sớm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ghi chú (Tùy chọn)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nhập ghi chú nếu có..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Lưu lại
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AttendancePage;
