
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateClaim } from '@/utils/staffExpenseClaimsStorage.js';
import { toast } from 'sonner';

const RejectExpenseClaimModal = ({ isOpen, onClose, claim, currentUser, onSuccess }) => {
  const [reason, setReason] = useState('');

  if (!claim) return null;

  const handleReject = () => {
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    updateClaim(claim.id, {
      status: 'rejected',
      rejectedBy: currentUser?.fullName || currentUser?.name,
      rejectedAt: new Date().toISOString(),
      rejectReason: reason
    });
    toast.success('Đã từ chối yêu cầu chi');
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-rose-600">Từ chối yêu cầu chi</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-2">
            <p><strong>Người yêu cầu:</strong> {claim.employeeName}</p>
            <p><strong>Số tiền:</strong> {claim.amount?.toLocaleString('vi-VN')} đ</p>
          </div>
          <div className="space-y-2">
            <Label>Lý do từ chối <span className="text-destructive">*</span></Label>
            <Textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="Nhập lý do từ chối..." 
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="destructive" onClick={handleReject}>Xác nhận Từ chối</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RejectExpenseClaimModal;
