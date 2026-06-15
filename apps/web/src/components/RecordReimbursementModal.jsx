
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAvailableClaimsForReimbursement, createReimbursementRecord, saveExpenseClaimToSupabase, getClaims } from '@/utils/staffExpenseClaimsStorage.js';
import { createApprovalNotification } from '@/utils/ApprovalNotificationHelper.js';
import CurrencyInput from '@/components/CurrencyInput.jsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Upload, X, Loader2 } from 'lucide-react';

const RecordReimbursementModal = ({ isOpen, onClose, currentUser, onSuccess, initialClaimId = '' }) => {
  const [loading, setLoading] = useState(false);
  const [availableClaims, setAvailableClaims] = useState([]);
  
  const [formData, setFormData] = useState({
    sourceClaimId: '',
    expenseDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: 'Chuyển khoản',
    note: '',
    attachments: []
  });

  useEffect(() => {
    if (isOpen) {
      const claims = getAvailableClaimsForReimbursement();
      setAvailableClaims(claims);
      
      setFormData({
        sourceClaimId: initialClaimId || '',
        expenseDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMethod: 'Chuyển khoản',
        note: '',
        attachments: []
      });

      if (initialClaimId) {
        const claim = claims.find(c => c.id === initialClaimId);
        if (claim) {
          setFormData(prev => ({ ...prev, amount: claim.remainingAmount.toString() }));
        }
      }
    }
  }, [isOpen, initialClaimId]);

  const selectedClaim = formData.sourceClaimId 
    ? availableClaims.find(c => c.id === formData.sourceClaimId) 
    : null;

  const handleSourceClaimChange = (val) => {
    const claim = availableClaims.find(c => c.id === val);
    setFormData(prev => ({ 
      ...prev, 
      sourceClaimId: val,
      amount: claim ? claim.remainingAmount.toString() : ''
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            dataUrl: event.target.result
          }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== id)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.sourceClaimId) {
      toast.error('Vui lòng chọn phiếu tạm ứng cần hoàn');
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Số tiền hoàn không hợp lệ');
      return;
    }

    if (selectedClaim && Number(formData.amount) > selectedClaim.remainingAmount) {
      toast.error('Số tiền hoàn không được vượt quá số còn thiếu');
      return;
    }

    setLoading(true);
    try {
      const recordData = {
        ...formData,
        employeeId: selectedClaim.employeeId,
        employeeName: selectedClaim.employeeName,
        departmentPosition: selectedClaim.departmentPosition,
        paidBy: currentUser.fullName
      };

      const newReimbursement = createReimbursementRecord(recordData);
      await saveExpenseClaimToSupabase(newReimbursement);

      // Sync the source claim since its status and remaining amount may have changed
      const sourceClaim = getClaims().find(c => c.id === recordData.sourceClaimId);
      if (sourceClaim) {
        await saveExpenseClaimToSupabase(sourceClaim);
      }

      await createApprovalNotification(
        newReimbursement.id,
        'staff_expense_claims',
        'reimbursement_recorded',
        'Ghi nhận hoàn ứng',
        `Kế toán đã hoàn ứng ${Number(formData.amount).toLocaleString('vi-VN')}đ cho phiếu ${selectedClaim.category}.`,
        currentUser.id || currentUser.employeeId,
        currentUser.fullName,
        [],
        selectedClaim.employeeId
      );

      toast.success('Đã ghi nhận hoàn ứng thành công');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] glass-panel border-0">
        <DialogHeader>
          <DialogTitle>Ghi nhận hoàn ứng (Thanh toán)</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Chọn phiếu tạm ứng cần hoàn <span className="text-rose-500">*</span></Label>
            <Select value={formData.sourceClaimId} onValueChange={handleSourceClaimChange}>
              <SelectTrigger className="bg-white/50">
                <SelectValue placeholder="-- Chọn phiếu yêu cầu --" />
              </SelectTrigger>
              <SelectContent>
                {availableClaims.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">Không có phiếu nào cần hoàn</div>
                ) : (
                  availableClaims.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.employeeName} - {c.category} - Còn thiếu: {c.remainingAmount.toLocaleString('vi-VN')}đ
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedClaim && (
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 text-sm grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Người YC:</span> <span className="font-medium">{selectedClaim.employeeName}</span></div>
              <div><span className="text-muted-foreground">Ngày YC:</span> <span className="font-medium">{format(new Date(selectedClaim.expenseDate), 'dd/MM/yyyy')}</span></div>
              <div><span className="text-muted-foreground">Đã chi:</span> <span className="font-bold text-amber-600">{selectedClaim.amount.toLocaleString('vi-VN')}đ</span></div>
              <div><span className="text-muted-foreground">Cần hoàn:</span> <span className="font-bold text-rose-600">{selectedClaim.remainingAmount.toLocaleString('vi-VN')}đ</span></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ngày hoàn tiền <span className="text-rose-500">*</span></Label>
              <Input 
                type="date" 
                value={formData.expenseDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expenseDate: e.target.value }))}
                required
                className="bg-white/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Số tiền hoàn (VNĐ) <span className="text-rose-500">*</span></Label>
              <CurrencyInput
                value={formData.amount}
                onChange={(val) => setFormData(prev => ({ ...prev, amount: val }))}
                placeholder="Nhập số tiền..."
                className="bg-white/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hình thức chuyển</Label>
              <Select value={formData.paymentMethod} onValueChange={(val) => setFormData(prev => ({ ...prev, paymentMethod: val }))}>
                <SelectTrigger className="bg-white/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chuyển khoản">Chuyển khoản</SelectItem>
                  <SelectItem value="Tiền mặt">Tiền mặt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea 
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              placeholder="VD: Chuyển khoản Techcombank đợt 1..."
              rows={2}
              className="bg-white/50"
            />
          </div>

          <div className="space-y-2">
            <Label>Chứng từ (UNC, Phiếu chi...)</Label>
            <div className="border-2 border-dashed border-primary/30 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors hover:bg-primary/5 bg-white/30 relative">
              <input 
                type="file" 
                multiple 
                accept="image/*,.pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
              />
              <Upload className="w-6 h-6 text-primary/50 mb-1" />
              <p className="text-xs text-muted-foreground">Click để tải lên</p>
            </div>
            {formData.attachments.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {formData.attachments.map(file => (
                  <div key={file.id} className="relative group rounded-md overflow-hidden border aspect-square">
                    {file.type.includes('image') ? (
                      <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] p-1 text-center break-words bg-muted">
                        {file.name}
                      </div>
                    )}
                    <button 
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="bg-white/50">Hủy</Button>
            <Button type="submit" disabled={loading} className="btn-primary-glass">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xác nhận hoàn ứng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecordReimbursementModal;
