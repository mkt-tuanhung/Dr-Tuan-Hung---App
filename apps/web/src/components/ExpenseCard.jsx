
import React from 'react';
import { Calendar, User, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

const ExpenseCard = ({ expense, onClick }) => {
  const categoryColors = {
    'MKT': 'bg-purple-100 text-purple-700',
    'Vật tư': 'bg-blue-100 text-blue-700',
    'Văn phòng': 'bg-green-100 text-green-700',
    'Nhân công': 'bg-orange-100 text-orange-700',
    'Khác': 'bg-gray-100 text-gray-700'
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-1 rounded-2xl overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col gap-[var(--mobile-card-gap,12px)]">
        {/* Line 1: Type Badge + Title + Status Badge */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Badge className={`shrink-0 border-none ${categoryColors[expense.category] || categoryColors['Khác']}`}>
              {expense.category || 'Khác'}
            </Badge>
            <span className="font-semibold text-[length:var(--mobile-card-title,16px)] text-foreground truncate">
              {expense.description || 'Chi phí'}
            </span>
          </div>
          <Badge variant="outline" className="shrink-0">{expense.status || 'Hoàn thành'}</Badge>
        </div>
        
        {/* Line 2: Date + Staff Info */}
        <div className="text-[length:var(--mobile-label,13px)] text-muted-foreground flex items-center flex-wrap gap-1">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{format(new Date(expense.date || new Date()), 'dd/MM/yyyy')}</span>
          <span className="mx-1">•</span>
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[120px]">{expense.staff_id || 'Không rõ'}</span>
        </div>
        
        {/* Line 3: Amount */}
        <div className="text-[length:var(--mobile-currency,20px)] font-bold text-primary">
          {expense.amount?.toLocaleString('vi-VN')} đ
        </div>
        
        {/* Line 4: Action Button */}
        <Button variant="outline" className="w-full h-10 text-sm mt-1" onClick={onClick}>
          Xem chi tiết <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExpenseCard;
