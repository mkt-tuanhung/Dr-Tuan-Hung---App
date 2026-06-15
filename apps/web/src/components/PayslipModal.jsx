
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer } from 'lucide-react';

const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const PayslipModal = ({ isOpen, onClose, payroll }) => {
  if (!payroll) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-card border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between no-print">
          <DialogTitle>Phiếu lương chi tiết</DialogTitle>
          <Button variant="ghost" size="icon" onClick={handlePrint} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Printer className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="print-section p-6 bg-background rounded-xl text-foreground">
          <div className="text-center mb-6 border-b border-border pb-6">
            <h2 className="text-2xl font-bold uppercase tracking-wider mb-2 text-primary">Phiếu Lương</h2>
            <p className="text-muted-foreground">Tháng {payroll.month} Năm {payroll.year}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Nhân viên:</p>
              <p className="font-semibold text-lg">{payroll.staff_name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Mã NV:</p>
              <p className="font-medium">{payroll.staff_id}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-muted/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 border-b border-border pb-2 text-primary">Thời gian làm việc</h3>
              <div className="flex justify-between text-sm mb-2">
                <span>Số ngày công:</span>
                <span className="font-medium">{payroll.working_days} ngày</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Số ngày nghỉ:</span>
                <span className="font-medium">{payroll.absent_days} ngày</span>
              </div>
            </div>

            <div className="bg-muted/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 border-b border-border pb-2 text-primary">Thu nhập</h3>
              <div className="flex justify-between text-sm mb-2">
                <span>Lương cơ bản:</span>
                <span className="font-medium">{formatVND(payroll.basic_salary)}</span>
              </div>
              
              {payroll.allowances_detail?.length > 0 && (
                <div className="pl-4 border-l-2 border-primary/20 space-y-2 my-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase">Phụ cấp chi tiết:</p>
                  {payroll.allowances_detail.map((allowance, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                      <span>- {allowance.name}:</span>
                      <span>{formatVND(allowance.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-border/50 font-semibold">
                <span>Tổng phụ cấp:</span>
                <span>{formatVND(payroll.allowances_total)}</span>
              </div>
            </div>

            <div className="bg-primary/10 p-5 rounded-lg border border-primary/20 mt-6">
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-primary-foreground">THỰC LÃNH:</span>
                <span className="text-primary">{formatVND(payroll.net_salary)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayslipModal;
