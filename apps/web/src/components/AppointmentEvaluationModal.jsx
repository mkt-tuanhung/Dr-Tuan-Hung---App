
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { updateAppointment, saveAppointmentToSupabase } from '@/utils/appointmentStorage.js';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AppointmentEvaluationModal = ({ isOpen, onClose, appointment, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('bong');
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (appointment) {
      setFormData({
        bongNote: appointment.bongReason || appointment.bongNote || '',
        depositDate: appointment.depositDate || format(new Date(), 'yyyy-MM-dd'),
        depositAmount: appointment.depositAmount || appointment.depositPaid || 0,
        depositServiceUsed: appointment.depositServiceUsed || appointment.service || '',
        expectedSurgeryDate: appointment.expectedSurgeryDate || '',
        surgeryDate: appointment.surgeryDate || format(new Date(), 'yyyy-MM-dd'),
        surgeryRevenue: appointment.surgeryRevenue || appointment.expectedBill || 0,
        surgeryUpsaleRevenue: appointment.surgeryUpsaleRevenue || 0,
        surgeryServiceUsed: appointment.surgeryServiceUsed || appointment.service || ''
      });
      
      if (appointment.status === 'deposit' || appointment.evaluationStatus === 'deposit') setActiveTab('surgery');
      else if (appointment.status === 'pending' || appointment.evaluationStatus === 'pending') setActiveTab('bong');
    }
  }, [appointment]);

  const handleEvaluate = (type) => {
    let updates = { status: type, evaluationStatus: type };
    let successMsg = '';

    if (type === 'bong') {
      if (!formData.bongNote) return toast.error('Vui lòng nhập lý do bong.');
      updates.bongNote = formData.bongNote;
      updates.bongReason = formData.bongNote;
      successMsg = 'Đã ghi nhận khách Bong.';
    } 
    else if (type === 'deposit') {
      if (!formData.depositAmount || !formData.depositDate) return toast.error('Vui lòng nhập số tiền và ngày cọc.');
      updates.depositDate = formData.depositDate;
      updates.depositPaid = Number(formData.depositAmount);
      updates.depositAmount = Number(formData.depositAmount);
      updates.depositServiceUsed = formData.depositServiceUsed;
      updates.expectedSurgeryDate = formData.expectedSurgeryDate;
      successMsg = 'Đã ghi nhận khách Cọc.';
    } 
    else if (type === 'surgery') {
      if (!formData.surgeryRevenue || !formData.surgeryDate) return toast.error('Vui lòng nhập doanh thu và ngày phẫu thuật.');
      updates.surgeryDate = formData.surgeryDate;
      updates.surgeryRevenue = Number(formData.surgeryRevenue);
      updates.surgeryUpsaleRevenue = Number(formData.surgeryUpsaleRevenue);
      updates.surgeryServiceUsed = formData.surgeryServiceUsed;
      successMsg = 'Đã ghi nhận khách Phẫu thuật.';
    }

    try {
      const updatedApp = updateAppointment(appointment.id, updates);
      toast.success(successMsg);
      
      // Async sync to Supabase
      if (updatedApp) {
        saveAppointmentToSupabase(updatedApp);
      }
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu đánh giá.');
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Đánh giá lịch hẹn: {appointment.customerName}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bong" className="data-[state=active]:bg-rose-100 data-[state=active]:text-rose-700">Bong</TabsTrigger>
            <TabsTrigger value="deposit" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">Cọc</TabsTrigger>
            <TabsTrigger value="surgery" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">Phẫu thuật</TabsTrigger>
          </TabsList>

          <TabsContent value="bong" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Lý do khách bong <span className="text-destructive">*</span></Label>
              <Textarea 
                value={formData.bongNote} 
                onChange={e => setFormData({...formData, bongNote: e.target.value})}
                placeholder="Ghi rõ lý do khách không làm dịch vụ..."
                className="min-h-[100px]"
              />
            </div>
            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-rose-50" onClick={() => handleEvaluate('bong')}>
              Xác nhận khách Bong
            </Button>
          </TabsContent>

          <TabsContent value="deposit" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ngày cọc <span className="text-destructive">*</span></Label>
                <Input type="date" value={formData.depositDate} onChange={e => setFormData({...formData, depositDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Số tiền cọc (VNĐ) <span className="text-destructive">*</span></Label>
                <CurrencyInput value={formData.depositAmount} onChange={v => setFormData({...formData, depositAmount: v})} className="text-blue-600 font-medium" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dịch vụ chốt cọc</Label>
              <Input value={formData.depositServiceUsed} onChange={e => setFormData({...formData, depositServiceUsed: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Ngày dự kiến phẫu thuật</Label>
              <Input type="date" value={formData.expectedSurgeryDate} onChange={e => setFormData({...formData, expectedSurgeryDate: e.target.value})} />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-blue-50" onClick={() => handleEvaluate('deposit')}>
              Xác nhận khách Cọc
            </Button>
          </TabsContent>

          <TabsContent value="surgery" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ngày phẫu thuật <span className="text-destructive">*</span></Label>
                <Input type="date" value={formData.surgeryDate} onChange={e => setFormData({...formData, surgeryDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Doanh thu (VNĐ) <span className="text-destructive">*</span></Label>
                <CurrencyInput value={formData.surgeryRevenue} onChange={v => setFormData({...formData, surgeryRevenue: v})} className="text-emerald-600 font-medium" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Doanh thu Upsale (VNĐ)</Label>
              <CurrencyInput value={formData.surgeryUpsaleRevenue} onChange={v => setFormData({...formData, surgeryUpsaleRevenue: v})} className="text-primary font-medium" />
            </div>
            <div className="space-y-2">
              <Label>Dịch vụ thực tế làm</Label>
              <Input value={formData.surgeryServiceUsed} onChange={e => setFormData({...formData, surgeryServiceUsed: e.target.value})} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-emerald-50" onClick={() => handleEvaluate('surgery')}>
              Xác nhận khách Phẫu thuật
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentEvaluationModal;
