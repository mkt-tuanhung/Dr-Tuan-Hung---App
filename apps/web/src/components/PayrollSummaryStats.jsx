
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { Banknote, WrapText as ReceiptText, Target, ShieldCheck, PieChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PayrollSummaryStats = ({ payrolls, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className={`min-w-0 w-full shadow-sm rounded-2xl border-none ${i === 1 ? 'bg-primary/10' : 'bg-card'}`}>
            <CardContent className="p-6">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-10 w-full max-w-[200px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalFund = payrolls.reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
  const totalBase = payrolls.reduce((sum, p) => sum + (Number(p.fixedSalary) || 0), 0);
  const totalCommission = payrolls.reduce((sum, p) => sum + (Number(p.totalCommission) || 0), 0);
  const lockedCount = payrolls.filter(p => p.status === 'locked').length;
  const isFullyLocked = lockedCount === payrolls.length && payrolls.length > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Primary Highlight Card for Total Fund */}
      <Card className="min-w-0 w-full overflow-visible shadow-lg border-none bg-primary text-primary-foreground rounded-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none rounded-2xl" />
        <CardContent className="p-6 sm:p-8 flex flex-col justify-center h-full relative z-10">
          <div className="flex items-center gap-2 mb-3 opacity-90">
            <div className="p-2 bg-primary-foreground/20 rounded-lg">
              <Banknote className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium uppercase tracking-wider">Tổng Quỹ Lương</p>
          </div>
          <p className="text-[20px] sm:text-2xl lg:text-3xl font-bold tabular-nums leading-tight tracking-tight break-words whitespace-normal overflow-visible" data-edit-disabled>
            {formatVNDDisplay(totalFund)}
          </p>
        </CardContent>
      </Card>
      
      {/* Secondary Cards */}
      <Card className="min-w-0 w-full overflow-hidden shadow-sm border-border bg-card rounded-2xl group hover:shadow-md transition-all duration-300">
        <CardContent className="p-6 flex flex-col justify-center h-full">
          <div className="flex items-center gap-2 mb-3 text-muted-foreground">
            <div className="p-1.5 bg-secondary rounded-md group-hover:bg-secondary/80 transition-colors">
              <ReceiptText className="w-4 h-4 text-secondary-foreground" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider">Lương cố định</p>
          </div>
          <p className="text-[20px] sm:text-2xl lg:text-3xl font-bold tabular-nums text-foreground break-words whitespace-normal overflow-visible">
            {formatVNDDisplay(totalBase)}
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0 w-full overflow-hidden shadow-sm border-border bg-card rounded-2xl group hover:shadow-md transition-all duration-300">
        <CardContent className="p-6 flex flex-col justify-center h-full">
          <div className="flex items-center gap-2 mb-3 text-muted-foreground">
            <div className="p-1.5 bg-emerald-500/10 rounded-md group-hover:bg-emerald-500/20 transition-colors">
              <Target className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider">Hoa hồng</p>
          </div>
          <p className="text-[20px] sm:text-2xl lg:text-3xl font-bold tabular-nums text-emerald-600 break-words whitespace-normal overflow-visible">
            {formatVNDDisplay(totalCommission)}
          </p>
        </CardContent>
      </Card>

      <Card className="min-w-0 w-full overflow-hidden shadow-sm border-border bg-card rounded-2xl group hover:shadow-md transition-all duration-300">
        <CardContent className="p-6 flex flex-col justify-center h-full">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="p-1.5 bg-secondary rounded-md">
                <PieChart className="w-4 h-4 text-secondary-foreground" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider">Trạng thái chốt</p>
            </div>
            <ShieldCheck className={`w-5 h-5 transition-colors ${isFullyLocked ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
          </div>
          <div className="flex items-baseline gap-1.5 break-words whitespace-normal overflow-visible">
            <p className="text-[20px] sm:text-2xl lg:text-3xl font-bold tabular-nums text-foreground">{lockedCount}</p>
            <span className="text-sm font-medium text-muted-foreground">/ {payrolls.length} hồ sơ</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayrollSummaryStats;
