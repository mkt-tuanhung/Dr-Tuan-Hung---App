import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CalendarCheck, Clock } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Có mặt' },
  { value: 'leave', label: 'Xin nghỉ phép' },
  { value: 'late', label: 'Đi muộn' },
  { value: 'early_leave', label: 'Về sớm' },
];

const LEAVE_TYPES = [
  { value: 'full_day', label: 'Nghỉ cả ngày' },
  { value: 'morning', label: 'Nghỉ sáng' },
  { value: 'afternoon', label: 'Nghỉ chiều' },
];

const AttendancePage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const [status, setStatus] = useState('present');
  const [leaveType, setLeaveType] = useState('full_day');
  const [lateTime, setLateTime] = useState('');
  const [earlyTime, setEarlyTime] = useState('');
  const [notes, setNotes] = useState('');

  const today = new Date();
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', profile.id)
        .gte('date', format(startOfMonth(today), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(today), 'yyyy-MM-dd'))
        .order('date', { ascending: false });
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleDayClick = (day) => {
    // Nhân viên chỉ được chấm công ngày hôm nay trở đi
    if (day < new Date(new Date().setHours(0,0,0,0))) {
      toast.info('Bạn chỉ có thể chấm công từ ngày hôm nay trở đi');
      return;
    }
    const existing = records.find(r => isSameDay(new Date(r.date), day));
    if (existing) { toast.info('Đã có dữ liệu chấm công ngày này'); return; }
    setSelectedDay(day);
    setStatus('present');
    setLeaveType('full_day');
    setLateTime('');
    setEarlyTime('');
    setNotes('');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!status) return;
    setSubmitting(true);
    try {
      const payload = {
        staff_id: profile.id,
        date: format(selectedDay, 'yyyy-MM-dd'),
        status,
        leave_type: status === 'leave' ? leaveType : null,
        late_time: status === 'late' ? lateTime : null,
        early_time: status === 'early_leave' ? earlyTime : null,
        notes,
      };
      const { error } = await supabase.from('attendance').insert(payload);
      if (error) throw error;
      toast.success('Chấm công thành công');
      setModalOpen(false);
      fetchRecords();
    } catch (err) {
      toast.error('Lỗi khi lưu chấm công: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getRecordForDay = (day) => records.find(r => isSameDay(new Date(r.date), day));

  const statusLabel = { present: 'Có mặt', leave: 'Nghỉ phép', late: 'Đi muộn', early_leave: 'Về sớm', absent: 'Vắng' };
  const statusColor = { present: 'bg-green-100 text-green-700', leave: 'bg-yellow-100 text-yellow-700', late: 'bg-orange-100 text-orange-700', early_leave: 'bg-blue-100 text-blue-700', absent: 'bg-red-100 text-red-700' };

  return (
    <>
      <Helmet><title>Chấm công - Dr Tuấn Hùng</title></Helmet>
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
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 gap-px bg-border/50">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
                <div key={d} className="bg-muted/30 p-3 text-center text-sm font-semibold text-muted-foreground">{d}</div>
              ))}
              {Array.from({ length: startOfMonth(today).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="bg-card p-3 min-h-[80px]" />
              ))}
              {daysInMonth.map(day => {
                const isCurrentDay = isToday(day);
                const isFuture = day >= new Date(new Date().setHours(0,0,0,0));
                const record = getRecordForDay(day);
                return (
                  <div
                    key={day.toString()}
                    onClick={() => handleDayClick(day)}
                    className={`bg-card p-2 min-h-[80px] flex flex-col gap-1 transition-colors
                      ${isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''}
                      ${isFuture ? 'cursor-pointer hover:bg-muted/50' : 'opacity-60'}
                    `}
                  >
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                      ${isCurrentDay ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                    `}>
                      {format(day, 'd')}
                    </span>
                    {record && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-auto ${statusColor[record.status] || 'bg-muted'}`}>
                        {statusLabel[record.status] || record.status}
                      </span>
                    )}
                    {isCurrentDay && !record && (
                      <span className="text-xs text-center border border-dashed border-primary/40 text-primary py-0.5 rounded mt-auto">
                        Chấm công
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Chi tiết</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{format(new Date(record.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${statusColor[record.status] || 'bg-muted'}`}>
                          {statusLabel[record.status] || record.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.leave_type && LEAVE_TYPES.find(l => l.value === record.leave_type)?.label}
                        {record.late_time && `Muộn: ${record.late_time}`}
                        {record.early_time && `Về sớm: ${record.early_time}`}
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
              <DialogTitle>Chấm công: {selectedDay ? format(selectedDay, 'dd/MM/yyyy') : ''}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {status === 'leave' && (
                <div className="space-y-2">
                  <Label>Loại nghỉ</Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {status === 'late' && (
                <div className="space-y-2">
                  <Label>Giờ đến (dự kiến)</Label>
                  <Input type="time" value={lateTime} onChange={e => setLateTime(e.target.value)} />
                </div>
              )}
              {status === 'early_leave' && (
                <div className="space-y-2">
                  <Label>Giờ về sớm</Label>
                  <Input type="time" value={earlyTime} onChange={e => setEarlyTime(e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Ghi chú (Tùy chọn)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nhập lý do nếu có..." />
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
