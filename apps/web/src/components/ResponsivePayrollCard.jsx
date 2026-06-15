
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { Eye, Lock, Unlock } from 'lucide-react';

const ResponsivePayrollCard = ({ payroll, onViewDetail, onToggleLock }) => {
  const isLocked = payroll.status === 'locked';

  return (
    <div className="mobile-card">
      <div className="flex justify-between items-start mb-1 border-b border-border/50 pb-3">
        <div className="mobile-text-truncate pr-2">
          <h3 className="font-bold text-[15px] text-foreground mb-0.5">{payroll.fullName}</h3>
          <p className="text-[12px] font-medium text-muted-foreground">{payroll.position || 'Nhân viên'}</p>
        </div>
        <Badge variant="outline" className={`${isLocked ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-blue-100 text-blue-700 border-blue-200'} whitespace-nowrap text-[10px] font-bold px-2 py-0.5`}>
          {isLocked ? 'Đã chốt' : 'Bản nháp'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-1 bg-muted/20 p-2.5 rounded-lg border border-border/50">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Công thực tế</span>
          <span className="font-semibold">{payroll.paidWorkDays} / {payroll.standardWorkDays}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground">Hoa hồng/Bonus</span>
          <span className="font-semibold text-emerald-600">{formatVNDDisplay(payroll.totalCommission)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center bg-primary/5 p-2.5 rounded-lg border border-primary/20 mb-2">
        <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Thực lãnh</span>
        <span className="font-bold text-lg text-primary">{formatVNDDisplay(payroll.netSalary)}</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="btn-touch flex-1 text-blue-700 border-blue-200 bg-blue-50" onClick={() => onViewDetail(payroll)}>
          <Eye className="w-4 h-4 mr-1.5" /> Chi tiết
        </Button>
        {onToggleLock && (
          <Button 
            variant="outline" 
            size="sm" 
            className={`btn-touch w-12 px-0 ${isLocked ? 'text-slate-600 bg-slate-100' : 'text-rose-600 bg-rose-50 border-rose-200'}`} 
            onClick={() => onToggleLock(payroll)}
          >
            {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ResponsivePayrollCard;
