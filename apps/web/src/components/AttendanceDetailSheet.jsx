
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAttendance } from '@/hooks/useAttendance.js';
import { isBefore, isAfter, startOfDay, format } from 'date-fns';
import { toast } from 'sonner';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Đã check in' },
  { value: 'leave_full', label: 'Nghỉ phép (Cả ngày)' },
  { value: 'leave_morning', label: 'Nghỉ sáng (1/2 ngày)' },
  { value: 'leave_afternoon', label: 'Nghỉ chiều (1/2 ngày)' },
  { value: 'late', label: 'Đi muộn' },
  { value: 'early_leave', label: 'Về sớm' },
  { value: 'absent', label: 'Vắng' },
];

const AttendanceDetailSheet = ({ isOpen, onClose, date, employeeId, onSaved, isAdmin = false }) => {
  const isMobile = useIsMobile();
  const { getAttendanceByDate, saveOrUpdateAttendance } = useAttendance();

  const [form, setForm] = useState({
    status: 'present',
    checkInTime: '',
    checkOutTime: '',
    requestedTime: '',
    reason: '',
    workUnit: 1
  });

  const [mode, setMode] = useState('view'); // 'view', 'edit', 'future', 'today'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen && date && employeeId) {
      const today = startOfDay(new Date());
      const selectedDay = startOfDay(date);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const record = getAttendanceByDate(employeeId, dateStr);

      if (record) {
        setForm({
          status: record.status || 'present',
          checkInTime: record.checkInTime || '',
          checkOutTime: record.checkOutTime || '',
          requestedTime: record.requestedTime || '',
          reason: record.reason || record.note || '',
          workUnit: record.workUnit ?? 1
        });
      } else {
        setForm({
          status: 'present',
          checkInTime: '',
          checkOutTime: '',
          requestedTime: '',
          reason: '',
          workUnit: 1
        });
      }

      if (isAdmin) {
        setMode('edit');
        setMessage('Admin: Đang chỉnh sửa công nhân sự');
      } else {
        if (isAfter(selectedDay, today)) {
          setMode('future');
          setMessage('Tạo yêu cầu vắng mặt/đi muộn/về sớm cho ngày này.');
          if (!record) {
            setForm(f => ({ ...f, status: 'leave_full' }));
          }
        } else if (isBefore(selectedDay, today)) {
          setMode('view');
          setMessage('Ngày đã qua, chỉ được xem chi tiết, không thể chỉnh sửa.');
        } else {
          setMode('today');
          setMessage('');
        }
      }
    }
  }, [isOpen, date, employeeId, getAttendanceByDate, isAdmin]);

  const handleSave = () => {
    if (mode !== 'edit' && mode !== 'today') return;

    if (!form.status) {
      toast.error('Vui lòng chọn trạng thái.');
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    let workUnit = Number(form.workUnit);
    
    // Auto-calculate workUnit for regular employees, let Admin override
    if (!isAdmin) {
      workUnit = 1;
      if (form.status === 'leave_full' || form.status === 'absent') workUnit = 0;
      if (form.status === 'leave_morning' || form.status === 'leave_afternoon') workUnit = 0.5;
    }

    saveOrUpdateAttendance(employeeId, dateStr, {
      status: form.status,
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      requestedTime: form.requestedTime,
      reason: form.reason,
      note: form.reason,
      workUnit
    });

    toast.success('Lưu chi tiết chấm công thành công.');
    if (onSaved) onSaved();
    onClose();
  };

  const submitRequest = () => {
    if (!form.status || form.status === 'present') {
      toast.error('Vui lòng chọn loại yêu cầu khác "Đã check in".');
      return;
    }
    if ((form.status === 'late' || form.status === 'early_leave') && !form.requestedTime) {
      toast.error('Vui lòng nhập thời gian xin phép.');
      return;
    }
    if (!form.reason.trim()) {
      toast.error('Vui lòng nhập lý do/ghi chú.');
      return;
    }

    const allReqs = getStorageItem('attendanceRequests', []);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const newReq = {
      id: crypto.randomUUID(),
      employeeId: employeeId,
      date: dateStr,
      requestType: form.status,
      requestedTime: form.requestedTime,
      reason: form.reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setStorageItem('attendanceRequests', [...allReqs, newReq]);
    toast.success('Gửi yêu cầu thành công.');
    if (onSaved) onSaved();
    onClose();
  };

  const showCheckInOut = isAdmin || mode === 'today' || mode === 'view';
  const isReadOnly = mode === 'view';

  const Content = (
    <div className="space-y-5 py-4 px-4 sm:px-2">
      {message && (
        <div className={`p-3 rounded-xl text-sm border ${isAdmin ? 'bg-primary/10 border-primary/20 text-primary font-medium' : mode === 'future' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          {message}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-gray-700 font-semibold">Trạng thái / Yêu cầu</Label>
          <Select 
            value={form.status} 
            onValueChange={(v) => {
              const autoWorkUnit = (v === 'leave_full' || v === 'absent') ? 0 : (v === 'leave_morning' || v === 'leave_afternoon') ? 0.5 : 1;
              setForm({ ...form, status: v, workUnit: autoWorkUnit });
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger className="h-11 rounded-xl bg-gray-50/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {STATUS_OPTIONS.map(opt => {
                // Hide "Đã check in" and "Vắng" for future requests unless Admin
                if (!isAdmin && mode === 'future' && (opt.value === 'present' || opt.value === 'absent')) return null;
                return <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        {showCheckInOut && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold">Giờ Check in</Label>
              <Input 
                type="time" 
                value={form.checkInTime} 
                onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                disabled={isReadOnly}
                className="h-11 rounded-xl bg-gray-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold">Giờ Check out</Label>
              <Input 
                type="time" 
                value={form.checkOutTime} 
                onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                disabled={isReadOnly}
                className="h-11 rounded-xl bg-gray-50/50"
              />
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-2">
            <Label className="text-gray-700 font-semibold">Số công ghi nhận (WorkUnit)</Label>
            <Select 
              value={String(form.workUnit)} 
              onValueChange={(v) => setForm({ ...form, workUnit: Number(v) })}
            >
              <SelectTrigger className="h-11 rounded-xl bg-gray-50/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="1">1 công</SelectItem>
                <SelectItem value="0.5">0.5 công</SelectItem>
                <SelectItem value="0">0 công</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {(form.status === 'late' || form.status === 'early_leave') && (
          <div className="space-y-2">
            <Label className="text-gray-700 font-semibold">Thời gian xin phép {form.status === 'late' ? '(Đến lúc)' : '(Về lúc)'}</Label>
            <Input 
              type="time" 
              value={form.requestedTime} 
              onChange={(e) => setForm({ ...form, requestedTime: e.target.value })}
              disabled={isReadOnly}
              className="h-11 rounded-xl bg-gray-50/50"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-gray-700 font-semibold">Lý do / Ghi chú</Label>
          <Textarea 
            value={form.reason} 
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            disabled={isReadOnly}
            placeholder={mode === 'future' ? "Nhập lý do chi tiết..." : "Nhập lý do đi muộn, về sớm hoặc ghi chú..."}
            className="min-h-[100px] rounded-xl bg-gray-50/50 resize-none"
          />
        </div>
      </div>
    </div>
  );

  const titleText = date ? `Chi tiết: ${format(date, 'dd/MM/yyyy')}` : 'Chi tiết chấm công';

  const ActionButtons = () => (
    <>
      {isAdmin && mode === 'edit' && (
        <Button onClick={handleSave} className="h-11 sm:h-10 rounded-xl w-full sm:w-auto">Lưu thay đổi</Button>
      )}
      {!isAdmin && mode === 'future' && (
        <Button onClick={submitRequest} className="h-11 sm:h-10 rounded-xl w-full sm:w-auto">Gửi yêu cầu</Button>
      )}
      {!isAdmin && mode === 'today' && (
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="secondary" onClick={submitRequest} className="h-11 sm:h-10 rounded-xl flex-1 sm:flex-none">Gửi yêu cầu</Button>
          <Button onClick={handleSave} className="h-11 sm:h-10 rounded-xl flex-1 sm:flex-none">Lưu Check-in</Button>
        </div>
      )}
      <Button variant="outline" onClick={onClose} className="h-11 sm:h-10 rounded-xl w-full sm:w-auto mt-2 sm:mt-0">Đóng</Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="rounded-t-3xl border-teal-100 bg-white shadow-2xl max-h-[90vh]">
          <DrawerHeader className="text-left border-b border-gray-100 pb-4">
            <DrawerTitle className="text-xl text-teal-900">{titleText}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto">
            {Content}
          </div>
          <DrawerFooter className="pt-4 border-t border-gray-100">
            <div className="flex flex-col gap-2">
              <ActionButtons />
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-2xl border border-teal-100 bg-white shadow-2xl p-6">
        <DialogHeader className="border-b border-gray-100 pb-4">
          <DialogTitle className="text-xl text-teal-900">{titleText}</DialogTitle>
        </DialogHeader>
        {Content}
        <DialogFooter className="pt-4 border-t border-gray-100 flex-row justify-end gap-2">
          <ActionButtons />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceDetailSheet;
