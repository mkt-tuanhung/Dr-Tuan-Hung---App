
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateClaim } from '@/utils/staffExpenseClaimsStorage.js';
import { toast } from 'sonner';

const ConfirmPaymentModal = ({ isOpen, onClose, claim, currentUser, onSuccess }) => {
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Chuyển khoản',
    paymentNote: '',
    paidBy: currentUser?.fullName || currentUser?.name || ''
  });

  if (!claim) return null;

  const handleConfirm = () => {
    updateClaim(claim.id, {
      status: 'paid',
      paidBy: form.paidBy,
      paidAt: form.paymentDate,
      actualPaymentMethod: form.paymentMethod,
      note: form.paymentNote || claim.note
    });
    toast.success('Đã xác nhận chi tiền');
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-emerald-600">Xác nhận đã chi tiền</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-sm space-y-2">
            <p><strong>Người nhận:</strong> {claim.employeeName}</p>
            <p><strong>Số tiền cần chi:</strong> <span className="text-emerald-700 font-bold text-lg">{claim.amount?.toLocaleString('vi-VN')} đ</span></p>
            <p><strong>Hình thức YC:</strong> {claim.paymentMethod}</p>
          </div>
          
          <div className="space-y-2">
            <Label>Người chi</Label>
            <Input 
              value={form.paidBy} 
              onChange={e => setForm({...form, paidBy: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ngày chi</Label>
              <Input 
                type="date" 
                value={form.paymentDate} 
                onChange={e => setForm({...form, paymentDate: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Hình thức chi</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm({...form, paymentMethod: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tiền mặt">Tiền mặt</SelectItem>
                  <SelectItem value="Chuyển khoản">Chuyển khoản</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ghi chú chi tiền (Mã GD...)</Label>
            <Textarea 
              value={form.paymentNote} 
              onChange={e => setForm({...form, paymentNote: e.target.value})} 
              placeholder="Nhập mã giao dịch hoặc ghi chú..." 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white">Xác nhận Đã Chi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPaymentModal;
