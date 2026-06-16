import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CalendarOff } from 'lucide-react';

const LeaveRequestPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [reason, setReason] = useState('');

  const today = new Date();
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', profile.id)
        .eq('status', 'leave')
        .gte('date', format(startOfMonth(today), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(today), 'yyyy-MM-dd'))
        .order('date', { ascending: false });
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu xin nghỉ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleDayClick = (day) => {
    const existing = records.find(r => isSameDay(new Date(r.date), day));
    if (existing) { toast.info('Đã có đơn xin nghỉ cho ngày này'); return; }
    setSelectedDate(day);
    setReason('');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !reason.trim()) { toast.error('Vui lòng nhập lý do'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('attendance').insert({
        staff_id: profile.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        status: 'leave',
        notes: reason,
      });
      if (error) throw error;
      toast.success('Gửi đơn xin nghỉ thành công');
      setModalOpen(false);
      fetchRecords();
    } catch (err) {
      toast.error('Lỗi khi gửi đơn xin nghỉ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getRecordForDay = (day) => records.find(r => isSameDay(new Date(r.date), day));

  return (
    <>
      <Helmet><title>Xin nghỉ phép - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen bg-background pb-12">
        <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4 sticky top-0 z-30 shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => navigate('/staff-dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-secondary" /> Xin nghỉ phép tháng {format(today, 'MM/yyyy')}
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
                const record = getRecordForDay(day);
                return (
                  <div
                    key={day.toString()}
                    onClick={() => handleDayClick(day)}
                    className="bg-card p-2 min-h-[80px] flex flex-col gap-1 transition-colors cursor-pointer hover:bg-muted/50"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-foreground">
                      {format(day, 'd')}
                    </span>
                    {record && (
                      <span className="text-xs bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded font-medium mt-auto">
                        Đã xin nghỉ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-bold text-lg">Lịch sử xin nghỉ phép</h2>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Chưa có dữ liệu xin nghỉ tháng này</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày xin nghỉ</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{format(new Date(record.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{record.notes}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(record.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </main>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-0">
            <div className="bg-gradient-to-r from-secondary to-blue-500 p-6 text-white">
              <DialogTitle className="text-xl text-white">Tạo đơn xin nghỉ</DialogTitle>
              <p className="opacity-90 text-sm mt-1">Ngày: {selectedDate && format(selectedDate, 'dd/MM/yyyy')}</p>
            </div>
            <div className="p-6 space-y-4 bg-card">
              <div className="space-y-2">
                <Label>Ngày nghỉ</Label>
                <Input type="date" value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Lý do xin nghỉ <span className="text-destructive">*</span></Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Nhập lý do chi tiết..." className="min-h-[120px]" />
              </div>
            </div>
            <DialogFooter className="p-4 bg-muted/30 border-t border-border">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={submitting || !reason.trim()} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Gửi yêu cầu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default LeaveRequestPage;
