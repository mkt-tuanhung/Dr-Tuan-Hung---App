
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { getUsers } from '@/utils/userStorage.js';
import { saveAppointment, updateAppointment, saveAppointmentToSupabase } from '@/utils/appointmentStorage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { normalize, matchId } from '@/utils/kpiPayrollHelper.js';

const AppointmentForm = ({ appointment, onSuccess, onCancel }) => {
  const { user: currentUser } = useAuth();
  const users = useMemo(() => getUsers(), []);
  
  const telesaleStaff = useMemo(() => 
    users.filter(u => u.role === 'Nhân viên' && normalize(u.departmentPosition) === 'telesale'),
  [users]);

  const saleOfflineStaff = useMemo(() => 
    users.filter(u => u.role === 'Nhân viên' && normalize(u.departmentPosition) === 'sale offline'),
  [users]);

  const [formData, setFormData] = useState({
    appointmentDate: format(new Date(), 'yyyy-MM-dd'),
    appointmentTime: '09:00',
    customerName: '',
    service: '',
    referenceInfo: '',
    expectedBill: 0,
    depositPaid: 0,
    testStatus: 'CHƯA XN',
    conditionNote: '',
    telesaleEmployeeId: '',
    saleOfflineEmployeeId: ''
  });

  useEffect(() => {
    if (appointment) {
      const resolvedTele = telesaleStaff.find(s => matchId(appointment.telesaleEmployeeId, s));
      const resolvedSale = saleOfflineStaff.find(s => matchId(appointment.saleOfflineEmployeeId, s));

      setFormData({
        ...appointment,
        telesaleEmployeeId: resolvedTele?.employeeId || appointment.telesaleEmployeeId || '',
        saleOfflineEmployeeId: resolvedSale?.employeeId || appointment.saleOfflineEmployeeId || ''
      });
    } else if (currentUser?.role === 'Nhân viên') {
      const updates = {};
      const pos = normalize(currentUser.departmentPosition);
      if (pos === 'telesale' || pos === 'tele') updates.telesaleEmployeeId = currentUser.employeeId || currentUser.id;
      if (pos === 'sale offline' || pos === 'sale') updates.saleOfflineEmployeeId = currentUser.employeeId || currentUser.id;
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
      }
    }
  }, [currentUser, appointment, telesaleStaff, saleOfflineStaff]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.appointmentDate || !formData.appointmentTime || !formData.customerName || !formData.service) {
      return toast.error('Vui lòng điền đầy đủ thông tin bắt buộc.');
    }

    const month = formData.appointmentDate.substring(0, 7);
    
    const teleStaff = telesaleStaff.find(s => s.employeeId === formData.telesaleEmployeeId);
    const saleStaff = saleOfflineStaff.find(s => s.employeeId === formData.saleOfflineEmployeeId);

    const payload = {
      ...formData,
      month,
      expectedBill: Number(formData.expectedBill) || 0,
      depositPaid: Number(formData.depositPaid) || 0,
      telesaleName: teleStaff ? teleStaff.fullName : formData.telesaleName || '',
      saleOfflineName: saleStaff ? saleStaff.fullName : formData.saleOfflineName || '',
      status: appointment ? appointment.status : 'pending',
      updatedBy: currentUser?.employeeId || currentUser?.id
    };

    try {
      if (appointment) {
        const updatedApp = updateAppointment(appointment.id, payload);
        toast.success('Đã cập nhật lịch hẹn thành công.');
        if (updatedApp) saveAppointmentToSupabase(updatedApp);
      } else {
        payload.createdBy = currentUser?.employeeId || currentUser?.id;
        payload.createdByName = currentUser?.fullName;
        const newApp = saveAppointment(payload);
        toast.success('Đã tạo lịch hẹn mới thành công.');
        if (newApp) saveAppointmentToSupabase(newApp);
      }

      if (!appointment) {
        setFormData(prev => ({
          ...prev,
          customerName: '',
          service: '',
          referenceInfo: '',
          expectedBill: 0,
          depositPaid: 0,
          testStatus: 'CHƯA XN',
          conditionNote: ''
        }));
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu lịch hẹn');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 mt-2">
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Thông tin khách hàng</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Ngày hẹn <span className="text-destructive">*</span></Label>
            <Input type="date" value={formData.appointmentDate} onChange={e => setFormData({...formData, appointmentDate: e.target.value})} required className="w-full" />
          </div>
          <div className="space-y-2">
            <Label>Giờ hẹn <span className="text-destructive">*</span></Label>
            <Input type="time" value={formData.appointmentTime} onChange={e => setFormData({...formData, appointmentTime: e.target.value})} required className="w-full" />
          </div>
          <div className="space-y-2">
            <Label>Tên khách hàng <span className="text-destructive">*</span></Label>
            <Input value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} required placeholder="Nguyễn Văn A" className="w-full" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Chi tiết dịch vụ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Dịch vụ <span className="text-destructive">*</span></Label>
            <Select value={formData.service} onValueChange={v => setFormData({...formData, service: v})} required>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn dịch vụ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cắt mí">Cắt mí</SelectItem>
                <SelectItem value="Nâng mũi">Nâng mũi</SelectItem>
                <SelectItem value="Nâng ngực">Nâng ngực</SelectItem>
                <SelectItem value="Hút mỡ">Hút mỡ</SelectItem>
                <SelectItem value="Tiêm filler">Tiêm filler</SelectItem>
                <SelectItem value="Chăm sóc da">Chăm sóc da</SelectItem>
                <SelectItem value="Khác">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tình trạng xét nghiệm</Label>
            <Select value={formData.testStatus} onValueChange={v => setFormData({...formData, testStatus: v})}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CHƯA XN">Chưa xét nghiệm</SelectItem>
                <SelectItem value="ĐÃ XN">Đã xét nghiệm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bill dự kiến (VNĐ)</Label>
            <CurrencyInput value={formData.expectedBill} onChange={val => setFormData({...formData, expectedBill: val})} className="text-emerald-600 font-medium w-full" />
          </div>
          <div className="space-y-2">
            <Label>Đã cọc (VNĐ)</Label>
            <CurrencyInput value={formData.depositPaid} onChange={val => setFormData({...formData, depositPaid: val})} className="text-primary font-medium w-full" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Phụ trách & Ghi chú</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Telesale phụ trách</Label>
            <Select value={formData.telesaleEmployeeId || 'none'} onValueChange={v => setFormData({...formData, telesaleEmployeeId: v === 'none' ? '' : v})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn Telesale" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Không có --</SelectItem>
                {telesaleStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sale Offline phụ trách</Label>
            <Select value={formData.saleOfflineEmployeeId || 'none'} onValueChange={v => setFormData({...formData, saleOfflineEmployeeId: v === 'none' ? '' : v})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn Sale Offline" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Không có --</SelectItem>
                {saleOfflineStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Thông tin tham khảo (Link FB, Zalo...)</Label>
            <Input value={formData.referenceInfo} onChange={e => setFormData({...formData, referenceInfo: e.target.value})} placeholder="Link profile khách hàng..." className="w-full" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Note tình trạng khách hàng</Label>
            <Textarea 
              value={formData.conditionNote} 
              onChange={e => setFormData({...formData, conditionNote: e.target.value})} 
              placeholder="Ghi chú chi tiết về tình trạng, mong muốn của khách..." 
              className="min-h-[80px] w-full" 
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-6 border-t border-border/50">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="w-full md:w-auto h-12 md:h-10">Hủy</Button>}
        <Button type="submit" className="w-full md:w-auto min-w-[150px] h-12 md:h-10 font-bold text-base md:text-sm">
          {appointment ? 'Cập nhật' : 'Lưu lịch hẹn'}
        </Button>
      </div>
    </form>
  );
};

export default AppointmentForm;
