import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calculator, CalendarDays, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

const TrialEndConfirmationModal = ({ isOpen, onClose, staffData, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      setEndDate(localDate);
    }
  }, [isOpen]);

  if (!staffData) return null;

  const basicSalary = Number(staffData.base_salary) || 0;
  const trialSalary = basicSalary * 0.85;
  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const handleConfirm = async () => {
    if (!endDate) { toast.error('Vui lòng chọn ngày kết thúc thử việc'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          employment_status: 'official',
          official_started_at: endDate,
        })
        .eq('id', staffData.id);
      if (error) throw error;
      toast.success('Kết thúc thử việc thành công. Đã cập nhật mức lương chính thức.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error('Lỗi khi cập nhật trạng thái: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Kết thúc thử việc</DialogTitle>
          <DialogDescription>
            Xác nhận kết thúc thời gian thử việc. Hệ thống sẽ cập nhật trạng thái nhân sự thành chính thức (100% lương cơ bản).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border">
            <User className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Họ và tên nhân sự</p>
              <p className="font-bold text-foreground">{staffData.full_name || 'Chưa cập nhật'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-muted/40 rounded-xl border border-border">
            <Label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
              <CalendarDays className="w-4 h-4" /> Ngày kết thúc <span className="text-destructive">*</span>
            </Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 font-medium bg-background" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 bg-muted/40 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                <Calculator className="w-4 h-4" /> Lương thử việc (85%)
              </div>
              <p className="font-bold text-muted-foreground line-through">{formatCurrency(trialSalary)}</p>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase">
                <CheckCircle2 className="w-4 h-4" /> Lương chính thức
              </div>
              <p className="font-bold text-emerald-600">{formatCurrency(basicSalary)}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl h-11 px-6 font-medium">Hủy</Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting} className="rounded-xl h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TrialEndConfirmationModal;
