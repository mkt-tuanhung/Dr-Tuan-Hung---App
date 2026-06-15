
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAttendance } from '@/hooks/useAttendance.js';
import { getAttendanceDayStyle } from '@/utils/getAttendanceDayStyle.js';
import AttendanceDetailSheet from '@/components/AttendanceDetailSheet.jsx';

const AttendanceCalendar = ({ month, year, onMonthChange, records, requests, currentUserId, onSaved, isAdmin = false }) => {
  const { getAttendanceByDate } = useAttendance();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const getDaysInMonth = (m, y) => new Date(y, m, 0).getDate();
  const getFirstDayOfMonth = (m, y) => {
    const day = new Date(y, m - 1, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0, Sunday is 6
  };

  const daysInMonth = getDaysInMonth(month, year);
  const startOffset = getFirstDayOfMonth(month, year);
  
  const handlePrev = () => {
    if (month === 1) onMonthChange(12, year - 1);
    else onMonthChange(month - 1, year);
  };

  const handleNext = () => {
    if (month === 12) onMonthChange(1, year + 1);
    else onMonthChange(month + 1, year);
  };

  const handleDayClick = (dateStr) => {
    setSelectedDate(new Date(dateStr));
    setIsSheetOpen(true);
  };

  const handleSheetSaved = () => {
    onSaved?.();
  };

  const gridCells = [];
  
  for (let i = 0; i < startOffset; i++) {
    gridCells.push(
      <div 
        key={`empty-${i}`} 
        className="aspect-square min-w-0 w-full bg-[#FFFFFF] border border-gray-100 rounded-2xl pointer-events-none opacity-50"
      />
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if there is an active record
    const record = getAttendanceByDate(currentUserId, dateStr);
    
    // Check if there is a pending request
    const pendingReq = requests?.find(r => r.date === dateStr && r.employeeId === currentUserId && r.status === 'pending');
    
    const displayStatus = pendingReq ? 'pending' : (record?.status || null);
    const style = getAttendanceDayStyle(displayStatus);

    gridCells.push(
      <div 
        key={`day-${day}`} 
        onClick={() => handleDayClick(dateStr)}
        className={`aspect-square min-w-0 w-full rounded-2xl border flex flex-col items-center justify-center gap-1 overflow-hidden shadow-sm cursor-pointer transition-all duration-200 hover:opacity-80 hover:-translate-y-0.5 ${style.classes}`}
      >
        <span className="text-sm sm:text-base font-bold leading-none">{day}</span>
        {style.shortLabel && (
          <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md bg-white/50 text-current leading-none">
            {style.shortLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Tháng {month} <span className="text-muted-foreground font-medium">/ {year}</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 rounded-xl" 
            onClick={handlePrev}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 rounded-xl" 
            onClick={handleNext}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      <div className="w-full">
        <div className="grid grid-cols-7 gap-1.5 w-full">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-semibold text-muted-foreground py-2 uppercase tracking-wider">
              {day}
            </div>
          ))}
          {gridCells}
        </div>
      </div>

      <AttendanceDetailSheet 
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        date={selectedDate}
        employeeId={currentUserId}
        onSaved={handleSheetSaved}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default AttendanceCalendar;
