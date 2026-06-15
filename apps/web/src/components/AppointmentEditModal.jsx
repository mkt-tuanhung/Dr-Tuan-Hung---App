
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { getUsers } from '@/utils/userStorage.js';
import { updateAppointment, saveAppointmentToSupabase } from '@/utils/appointmentStorage.js';
import { normalize, matchId } from '@/utils/kpiPayrollHelper.js';
import { toast } from 'sonner';

const AppointmentEditModal = ({ isOpen, onClose, appointment, onSuccess }) => {
  const users = useMemo(() => getUsers(), []);
  
  const telesaleStaff = useMemo(() => 
    users.filter(u => u.role === 'Nhân viên' && normalize(u.departmentPosition) === 'telesale'),
  [users]);

  const saleOfflineStaff = useMemo(() => 
    users.filter(u => u.role === 'Nhân viên' && normalize(u.departmentPosition) === 'sale offline'),
  [users]);

  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (appointment) {
      const resolvedTele = telesaleStaff.find(s => matchId(appointment.telesaleEmployeeId, s));
      const resolvedSale = saleOfflineStaff.find(s => matchId(appointment.saleOfflineEmployeeId, s));
      
      setFormData({ 
        ...appointment,
        telesaleEmployeeId: resolvedTele?.employeeId || appointment.telesaleEmployeeId || '',
        saleOfflineEmployeeId: resolvedSale?.employeeId || appointment.saleOfflineEmployeeId || ''
      });
    }
  }, [appointment, telesaleStaff, saleOfflineStaff]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.appointmentDate || !formData.appointmentTime || !formData.customerName || !formData.service) {
      return toast.error('Vui lòng điền đầy đủ thông tin bắt buộc.');
    }

    const teleStaff = telesaleStaff.find(s => s.employeeId === formData.telesaleEmployeeId);
    const saleStaff = saleOfflineStaff.find(s => s.employeeId === formData.saleOfflineEmployeeId);

    const payload = {
      ...formData,
      expectedBill: Number(formData.expectedBill) || 0,
      depositPaid: Number(formData.depositPaid) || 0,
      telesaleName: teleStaff ? teleStaff.fullName : formData.telesaleName,
      saleOfflineName: saleStaff ? saleStaff.fullName : formData.saleOfflineName,
    };

    try {
      const updatedApp = updateAppointment(appointment.id, payload);
      toast.success('Đã cập nhật lịch hẹn thành công.');
      
      // Async sync to Supabase
      if (updatedApp) {
        saveAppointmentToSupabase(updatedApp);
      }
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi cập nhật.');
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa lịch hẹn</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          <div className="space-y-2">
            <Label>Ngày hẹn <span className="text-destructive">*</span></Label>
            <Input type="date" value={formData.appointmentDate || ''} onChange={e => setFormData({...formData, appointmentDate: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label>Giờ hẹn <span className="text-destructive">*</span></Label>
            <Input type="time" value={formData.appointmentTime || ''} onChange={e => setFormData({...formData, appointmentTime: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label>Tên khách hàng <span className="text-destructive">*</span></Label>
            <Input value={formData.customerName || ''} onChange={e => setFormData({...formData, customerName: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label>Dịch vụ <span className="text-destructive">*</span></Label>
            <Select value={formData.service || ''} onValueChange={v => setFormData({...formData, service: v})} required>
              <SelectTrigger><SelectValue placeholder="Chọn dịch vụ" /></SelectTrigger>
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
            <Label>Bill dự kiến (VNĐ)</Label>
            <CurrencyInput 
              value={formData.expectedBill || 0} 
              onChange={val => setFormData({...formData, expectedBill: val})} 
              className="text-emerald-600 font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label>Đã cọc (VNĐ)</Label>
            <CurrencyInput 
              value={formData.depositPaid || 0} 
              onChange={val => setFormData({...formData, depositPaid: val})} 
              className="text-primary font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label>Tình trạng xét nghiệm</Label>
            <Select value={formData.testStatus || 'CHƯA XN'} onValueChange={v => setFormData({...formData, testStatus: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CHƯA XN">Chưa xét nghiệm</SelectItem>
                <SelectItem value="ĐÃ XN">Đã xét nghiệm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Telesale phụ trách</Label>
            <Select value={formData.telesaleEmployeeId || 'none'} onValueChange={v => setFormData({...formData, telesaleEmployeeId: v === 'none' ? '' : v})}>
              <SelectTrigger><SelectValue placeholder="Chọn Telesale" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Không có --</SelectItem>
                {telesaleStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sale Offline phụ trách</Label>
            <Select value={formData.saleOfflineEmployeeId || 'none'} onValueChange={v => setFormData({...formData, saleOfflineEmployeeId: v === 'none' ? '' : v})}>
              <SelectTrigger><SelectValue placeholder="Chọn Sale Offline" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Không có --</SelectItem>
                {saleOfflineStaff.map(s => <SelectItem key={s.id} value={s.employeeId}>{s.fullName} ({s.employeeId})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label>Thông tin tham khảo (Link FB, Zalo...)</Label>
            <Input value={formData.referenceInfo || ''} onChange={e => setFormData({...formData, referenceInfo: e.target.value})} />
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <Label>Note tình trạng khách hàng</Label>
            <Textarea 
              value={formData.conditionNote || ''} 
              onChange={e => setFormData({...formData, conditionNote: e.target.value})} 
              className="min-h-[60px]" 
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" className="min-w-[150px]">Lưu thay đổi</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentEditModal;
