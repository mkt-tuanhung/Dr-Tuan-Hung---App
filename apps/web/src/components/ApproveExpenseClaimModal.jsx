
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { updateClaim } from '@/utils/staffExpenseClaimsStorage.js';
import { toast } from 'sonner';

const ApproveExpenseClaimModal = ({ isOpen, onClose, claim, currentUser, onSuccess }) => {
  const [note, setNote] = useState('');
  const [approvedBy, setApprovedBy] = useState(currentUser?.fullName || currentUser?.name || '');

  if (!claim) return null;

  const handleApprove = () => {
    updateClaim(claim.id, {
      status: 'approved',
      approvedBy: approvedBy || currentUser?.fullName,
      approvedAt: new Date().toISOString(),
      note: note
    });
    toast.success('Đã duyệt yêu cầu chi');
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Duyệt yêu cầu chi</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-2">
            <p><strong>Người yêu cầu:</strong> {claim.employeeName}</p>
            <p><strong>Số tiền:</strong> <span className="text-primary font-bold">{claim.amount?.toLocaleString('vi-VN')} đ</span></p>
            <p><strong>Lý do:</strong> {claim.description}</p>
          </div>
          <div className="space-y-2">
            <Label>Người duyệt</Label>
            <Input 
              value={approvedBy} 
              onChange={e => setApprovedBy(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label>Ghi chú duyệt (Không bắt buộc)</Label>
            <Textarea 
              value={note} 
              onChange={e => setNote(e.target.value)} 
              placeholder="Nhập ghi chú nếu cần..." 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleApprove} className="bg-blue-600 hover:bg-blue-700 text-white">Xác nhận Duyệt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApproveExpenseClaimModal;
