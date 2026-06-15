
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const AttendanceModal = ({ isOpen, onClose, date, existingRecord, staffId, onSave, onDelete }) => {
  const [status, setStatus] = useState('present');
  const [leaveType, setLeaveType] = useState('full_day');
  const [timeValue, setTimeValue] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingRecord) {
        setStatus(existingRecord.status || 'present');
        setLeaveType(existingRecord.leave_type || 'full_day');
        setTimeValue(existingRecord.time_value || '');
        setNotes(existingRecord.notes || '');
      } else {
        setStatus('present');
        setLeaveType('full_day');
        setTimeValue('');
        setNotes('');
      }
    }
  }, [existingRecord, isOpen]);

  const isValid = () => {
    if ((status === 'late' || status === 'early') && !timeValue) {
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    // 1. Ensure all required fields are populated
    if (!isValid()) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (!staffId || !date || !status) {
      toast.error('Thiếu thông tin bắt buộc (staff_id, date, status).');
      return;
    }

    setIsSubmitting(true);
    
    // Construct payload based on requirements
    const payload = {
      id: existingRecord?.id,
      staff_id: staffId,
      date: date.toISOString(), // Standard format for PocketBase
      status,
      leave_type: status === 'leave' ? leaveType : '',
      time_value: (status === 'late' || status === 'early') ? timeValue : '',
      notes
    };

    // 2. Log the form data before calling createAttendance
    console.log('Form data:', payload);

    try {
      await onSave(payload);
      toast.success('Ghi nhận chấm công thành công.');
      onClose();
    } catch (err) {
      // 3. Add detailed error handling that shows the specific error message to user
      const errorMsg = err.data ? JSON.stringify(err.data) : err.message;
      toast.error(`Lỗi chấm công: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRecord?.id) return;
    
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi chấm công này?')) return;
    
    setIsDeleting(true);
    try {
      await onDelete(existingRecord.id);
      toast.success('Đã xóa dữ liệu chấm công.');
      onClose();
    } catch (err) {
      const errorMsg = err.data ? JSON.stringify(err.data) : err.message;
      toast.error(`Lỗi khi xóa: ${errorMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-card border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Chấm công: <span className="text-primary">{date?.toLocaleDateString('vi-VN')}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <Label>Trạng thái <span className="text-destructive">*</span></Label>
            <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Có mặt</SelectItem>
                <SelectItem value="absent">Vắng mặt</SelectItem>
                <SelectItem value="leave">Nghỉ phép</SelectItem>
                <SelectItem value="late">Đi muộn</SelectItem>
                <SelectItem value="early">Về sớm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'leave' && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
              <Label>Ca nghỉ <span className="text-destructive">*</span></Label>
              <Select value={leaveType} onValueChange={setLeaveType} disabled={isSubmitting}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Sáng</SelectItem>
                  <SelectItem value="afternoon">Chiều</SelectItem>
                  <SelectItem value="full_day">Cả ngày</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(status === 'late' || status === 'early') && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
              <Label>Thời gian (HH:MM) <span className="text-destructive">*</span></Label>
              <Input 
                type="time" 
                value={timeValue} 
                onChange={(e) => setTimeValue(e.target.value)} 
                disabled={isSubmitting}
                className="bg-background"
                required
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>Ghi chú</Label>
            <Input 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Lý do nghỉ, đi muộn..." 
              disabled={isSubmitting}
              className="bg-background"
            />
          </div>
        </div>
        
        <DialogFooter className="flex flex-row justify-between sm:justify-between items-center w-full">
          <div>
            {existingRecord && (
              <Button 
                type="button" 
                variant="destructive" 
                size="icon"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
                className="h-10 w-10"
                title="Xóa chấm công"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting || isDeleting}>Hủy</Button>
            <Button onClick={handleSubmit} disabled={!isValid() || isSubmitting || isDeleting} className="min-w-[100px]">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Lưu lại
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceModal;
