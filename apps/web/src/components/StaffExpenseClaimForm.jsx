
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { saveNewClaim, saveExpenseClaimToSupabase } from '@/utils/staffExpenseClaimsStorage.js';
import { createApprovalNotification } from '@/utils/ApprovalNotificationHelper.js';
import { toast } from 'sonner';
import { Upload, X, Loader2 } from 'lucide-react';
import CurrencyInput from '@/components/CurrencyInput.jsx';

const StaffExpenseClaimForm = ({ isOpen, onClose, users, onSuccess }) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: currentUser?.id || currentUser?.employeeId || '',
    employeeName: currentUser?.fullName || '',
    departmentPosition: currentUser?.departmentPosition || '',
    transactionType: 'advance_expense',
    expenseDate: new Date().toISOString().split('T')[0],
    category: '',
    amount: '',
    description: '',
    supplierName: '',
    paymentMethod: 'Chuyển khoản',
    note: '',
    attachments: []
  });

  const isStaff = currentUser?.role === 'Nhân viên';
  const isAdminOrAccountant = currentUser?.role === 'Admin' || currentUser?.role === 'Kế toán';

  const categories = [
    'Mua vật tư/Trang thiết bị',
    'Văn phòng phẩm',
    'Chi phí công tác',
    'Tiếp khách',
    'Marketing/Quảng cáo',
    'Đồ thờ/cúng',
    'Khác'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    if (name === 'employeeId' && value) {
      const selectedUser = users.find(u => String(u.id) === value || String(u.employeeId) === value);
      if (selectedUser) {
        setFormData(prev => ({
          ...prev,
          employeeId: value,
          employeeName: selectedUser.fullName,
          departmentPosition: selectedUser.departmentPosition || ''
        }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} vượt quá 5MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            size: file.size,
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
    if (!formData.category || !formData.amount || !formData.expenseDate || !formData.description) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setLoading(true);
    try {
      const newClaim = saveNewClaim({
        ...formData,
        amount: Number(formData.amount)
      });
      
      await saveExpenseClaimToSupabase(newClaim);

      await createApprovalNotification(
        newClaim.id,
        'staff_expense_claims',
        'expense_claim',
        'Tạm ứng chi mới',
        `${formData.employeeName} yêu cầu tạm ứng ${Number(formData.amount).toLocaleString('vi-VN')}đ cho ${formData.category}.\nMô tả: ${formData.description}`,
        currentUser.id || currentUser.employeeId,
        currentUser.fullName,
        ['Admin', 'Kế toán']
      );

      toast.success('Đã gửi yêu cầu tạm ứng chi');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Lỗi khi lưu yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto glass-panel border-0">
        <DialogHeader>
          <DialogTitle className="text-xl">Tạo phiếu tạm ứng chi</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Người yêu cầu <span className="text-rose-500">*</span></Label>
              {isAdminOrAccountant ? (
                <Select value={formData.employeeId} onValueChange={(val) => handleSelectChange('employeeId', val)}>
                  <SelectTrigger className="bg-white/50">
                    <SelectValue placeholder="Chọn nhân sự" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formData.employeeName} disabled className="bg-muted/50" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Ngày chi <span className="text-rose-500">*</span></Label>
              <Input 
                type="date" 
                name="expenseDate"
                value={formData.expenseDate}
                onChange={handleInputChange}
                required
                className="bg-white/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Danh mục chi <span className="text-rose-500">*</span></Label>
              <Select value={formData.category} onValueChange={(val) => handleSelectChange('category', val)}>
                <SelectTrigger className="bg-white/50">
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Số tiền (VNĐ) <span className="text-rose-500">*</span></Label>
              <CurrencyInput
                value={formData.amount}
                onChange={(val) => handleSelectChange('amount', val)}
                placeholder="Ví dụ: 500,000"
                className="bg-white/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lý do / Mô tả chi tiết <span className="text-rose-500">*</span></Label>
            <Textarea 
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Nhập chi tiết mục đích chi tiền..."
              rows={3}
              required
              className="bg-white/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nơi mua / Nhà cung cấp</Label>
              <Input 
                name="supplierName"
                value={formData.supplierName}
                onChange={handleInputChange}
                placeholder="Tên cửa hàng, siêu thị..."
                className="bg-white/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Hình thức thanh toán</Label>
              <Select value={formData.paymentMethod} onValueChange={(val) => handleSelectChange('paymentMethod', val)}>
                <SelectTrigger className="bg-white/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chuyển khoản">Chuyển khoản</SelectItem>
                  <SelectItem value="Tiền mặt">Tiền mặt</SelectItem>
                  <SelectItem value="Thẻ tín dụng">Thẻ tín dụng (Công ty)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chứng từ đính kèm (Hóa đơn, bill chuyển khoản...)</Label>
            <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors hover:bg-primary/5 bg-white/30 relative">
              <input 
                type="file" 
                multiple 
                accept="image/*,.pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
              />
              <Upload className="w-8 h-8 text-primary/50 mb-2" />
              <p className="text-sm font-medium text-foreground">Kéo thả hoặc click để tải lên</p>
              <p className="text-xs text-muted-foreground mt-1">Hỗ trợ JPG, PNG, PDF (Max 5MB)</p>
            </div>
            
            {formData.attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {formData.attachments.map(file => (
                  <div key={file.id} className="relative group rounded-lg overflow-hidden border bg-muted/50 aspect-square">
                    {file.type.includes('image') ? (
                      <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs p-2 text-center break-words bg-secondary/30">
                        {file.name}
                      </div>
                    )}
                    <button 
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Hủy</Button>
            <Button type="submit" disabled={loading} className="btn-primary-glass">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StaffExpenseClaimForm;
