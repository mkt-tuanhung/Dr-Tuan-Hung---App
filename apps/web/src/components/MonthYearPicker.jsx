import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = [
  'Thg 1', 'Thg 2', 'Thg 3', 'Thg 4',
  'Thg 5', 'Thg 6', 'Thg 7', 'Thg 8',
  'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'
];

const MonthYearPicker = ({ value, onChange, className }) => {
  // value is expected in 'YYYY-MM' format
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => {
    if (value) {
      const [y] = value.split('-');
      return parseInt(y, 10);
    }
    return new Date().getFullYear();
  });

  useEffect(() => {
    if (value && !open) {
      const [y] = value.split('-');
      setYear(parseInt(y, 10));
    }
  }, [value, open]);

  const handleMonthSelect = (m) => {
    const newMonthStr = String(m).padStart(2, '0');
    onChange(`${year}-${newMonthStr}`);
    setOpen(false);
  };

  const displayText = value 
    ? `Tháng ${parseInt(value.split('-')[1], 10)} năm ${value.split('-')[0]}`
    : 'Chọn tháng';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-medium bg-background hover:bg-muted/50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 bg-transparent"
            onClick={() => setYear(y => y - 1)}
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="font-semibold text-sm">{year}</div>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 bg-transparent"
            onClick={() => setYear(y => y + 1)}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((mName, i) => {
            const m = i + 1;
            const isSelected = value === `${year}-${String(m).padStart(2, '0')}`;
            return (
              <Button
                key={m}
                variant={isSelected ? "default" : "ghost"}
                className={cn("h-9 font-normal text-sm", isSelected && "font-medium text-primary-foreground")}
                onClick={() => handleMonthSelect(m)}
              >
                {mName}
              </Button>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border flex justify-end">
            <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-primary" onClick={() => {
                const now = new Date();
                setYear(now.getFullYear());
                handleMonthSelect(now.getMonth() + 1);
            }}>
                Tháng hiện tại
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MonthYearPicker;
