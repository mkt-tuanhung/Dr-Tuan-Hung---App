
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Receipt, ArrowDownRight, ArrowUpRight, Wallet, ArrowRight } from 'lucide-react';

const EmployeeSummaryCard = ({ summary, onClick }) => {
  const isSettled = summary.remaining <= 0;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all duration-200 border-border hover:border-primary/30 rounded-2xl"
      onClick={() => onClick(summary)}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-[length:var(--mobile-card-title,16px)] sm:text-base truncate">
                {summary.employeeName}
              </h3>
              <p className="text-[length:var(--mobile-label,13px)] sm:text-sm text-muted-foreground truncate">
                {summary.departmentPosition || 'Nhân viên'}
              </p>
            </div>
          </div>
          <Badge 
            variant={isSettled ? 'outline' : 'destructive'} 
            className={`shrink-0 ${isSettled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}`}
          >
            {isSettled ? 'Đã đủ' : 'Còn thiếu'}
          </Badge>
        </div>

        {/* Body */}
        <div className="space-y-3 flex flex-col flex-1">
          <div className="flex justify-between items-center text-[length:var(--mobile-label,13px)] sm:text-sm">
            <div className="flex items-center text-muted-foreground">
              <ArrowUpRight className="w-4 h-4 mr-1 text-amber-500 shrink-0" />
              Tổng tạm ứng
            </div>
            <span className="font-medium text-[length:var(--mobile-currency,16px)] sm:text-base">
              {summary.totalAdvance.toLocaleString('vi-VN')} đ
            </span>
          </div>
          
          <div className="flex justify-between items-center text-[length:var(--mobile-label,13px)] sm:text-sm">
            <div className="flex items-center text-muted-foreground">
              <ArrowDownRight className="w-4 h-4 mr-1 text-emerald-500 shrink-0" />
              Đã hoàn ứng
            </div>
            <span className="font-medium text-[length:var(--mobile-currency,16px)] sm:text-base">
              {summary.totalReimbursement.toLocaleString('vi-VN')} đ
            </span>
          </div>

          <div className="pt-3 mt-auto border-t border-border/50 flex justify-between items-center">
            <div className="flex items-center text-muted-foreground text-[length:var(--mobile-label,13px)] sm:text-sm">
              <Wallet className="w-4 h-4 mr-1 shrink-0" />
              Số dư còn lại
            </div>
            <span className={`font-bold text-[length:var(--mobile-currency,18px)] sm:text-lg ${isSettled ? 'text-emerald-600' : 'text-rose-600'}`}>
              {summary.remaining.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="flex items-center text-[length:var(--mobile-label,13px)] text-muted-foreground">
            <Receipt className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
            {summary.claimCount} giao dịch
          </span>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-primary hover:text-primary/80 hover:bg-primary/5">
            Xem chi tiết <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeSummaryCard;
