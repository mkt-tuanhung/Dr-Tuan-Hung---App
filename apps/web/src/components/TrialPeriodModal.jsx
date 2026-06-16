import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calculator, CalendarDays, User, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useStaff } from '@/hooks/useStaff.js';

const TrialPeriodModal = ({ isOpen, onClose, staffData, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const { fetchStaff } = useStaff();

  useEffect(() => {
    if (isOpen) {
      const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      setStartDate(localDate);
    }
  }, [isOpen]);

  if (!staffData) return null;

  const basicSalary = Number(staffData.base_salary) || 0;
  const trialSalary = Math.round(basicSalary * 0.85);
  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const handleConfirm = async () => {
    if (!startDate) { toast.error('Vui lòng chọn ngày bắt đầu thử việc'); return; }
    if (staffData.id) {
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            employment_status: 'probation',
            probation_started_at: startDate,
          })
          .eq('id', staffData.id);
        if (error) throw error;
        toast.success('Cập nhật trạng thái thử việc thành công');
        if (fetchStaff) await fetchStaff();
        if (onSuccess) onSuccess();
        onClose();
      } catch (error) {
        toast.error('Lỗi khi cập nhật trạng thái: ' + error.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (onSuccess) onSuccess({ employment_status: 'probation', probation_started_at: startDate });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Xác nhận thử việc</DialogTitle>
          <DialogDescription>
            Bắt đầu giai đoạn thử việc. Hệ thống sẽ tự động tính lương thử việc bằng 85% lương cơ bản.
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
              <CalendarDays className="w-4 h-4" /> Ngày bắt đầu <span className="text-destructive">*</span>
            </Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 font-medium bg-background" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 bg-muted/40 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                <Coins className="w-4 h-4" /> Lương cơ bản
              </div>
              <p className="font-bold text-foreground">{formatCurrency(basicSalary)}</p>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase">
                <Calculator className="w-4 h-4" /> Lương thử việc (85%)
              </div>
              <p className="font-bold text-primary">{formatCurrency(trialSalary)}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl h-11 px-6 font-medium">Hủy</Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting} className="rounded-xl h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TrialPeriodModal;
