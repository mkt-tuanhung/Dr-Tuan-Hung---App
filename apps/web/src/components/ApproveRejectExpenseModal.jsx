
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { updateClaimStatus, updateExpenseClaimToSupabase } from '@/utils/staffExpenseClaimsStorage.js';
import { updateNotificationStatus } from '@/utils/ApprovalNotificationHelper.js';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const ApproveRejectExpenseModal = ({ isOpen, onClose, claim, currentUser, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  if (!claim) return null;

  const handleAction = async (isApprove) => {
    if (!isApprove && !reason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    setLoading(true);
    try {
      const status = isApprove ? 'approved' : 'rejected';
      const approverInfo = {
        approvedBy: isApprove ? currentUser.fullName : null,
        approvedAt: isApprove ? new Date().toISOString() : null,
        rejectReason: !isApprove ? reason : null
      };

      const updatedClaim = updateClaimStatus(claim.id, status, approverInfo);
      if (updatedClaim) {
        await updateExpenseClaimToSupabase(claim.id, updatedClaim);
      }
      
      await updateNotificationStatus(claim.id, 'processed', currentUser.id || currentUser.employeeId);

      toast.success(isApprove ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] glass-panel border-0">
        <DialogHeader>
          <DialogTitle>Duyệt / Từ chối yêu cầu</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
            <p className="text-sm font-medium">Phiếu yêu cầu: <span className="font-bold">{claim.category}</span></p>
            <p className="text-sm text-muted-foreground mt-1">Người gửi: {claim.employeeName}</p>
            <p className="text-lg font-bold text-amber-600 mt-2">{claim.amount?.toLocaleString('vi-VN')} đ</p>
          </div>

          <div className="space-y-2">
            <Label>Ghi chú / Lý do từ chối</Label>
            <Textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do nếu từ chối..."
              rows={3}
              className="bg-white/50"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => handleAction(false)} 
            disabled={loading}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 bg-white/50"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
            Từ chối
          </Button>
          <Button 
            onClick={() => handleAction(true)} 
            disabled={loading}
            className="btn-primary-glass"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Phê duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApproveRejectExpenseModal;
