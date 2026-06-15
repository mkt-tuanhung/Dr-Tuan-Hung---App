
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle } from 'lucide-react';

export default function ResponsiveAttendanceCard({ u, stats, onDetail }) {
  return (
    <div className="attendance-card-mobile">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-base text-foreground leading-tight">{u.fullName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{u.employeeId}</span>
            {u.departmentPosition && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-md font-normal bg-muted/80">
                {u.departmentPosition}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs shrink-0 rounded-lg text-primary border-primary/20 hover:bg-primary/10" onClick={onDetail}>
          <UserCircle className="w-3.5 h-3.5 mr-1" /> Chi tiết
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="mini-card-stat mini-card-total">
          <span className="stat-label">Tổng công</span>
          <span className="stat-value">{stats.totalWork}</span>
        </div>
        <div className="mini-card-stat mini-card-checkin">
          <span className="stat-label">Check-in</span>
          <span className="stat-value">{stats.checkedIn}</span>
        </div>
        <div className="mini-card-stat mini-card-late">
          <span className="stat-label">Sớm/Muộn</span>
          <span className="stat-value">{stats.late + stats.early}</span>
        </div>
        <div className="mini-card-stat mini-card-absent">
          <span className="stat-label">Vắng</span>
          <span className="stat-value">{stats.absent}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border/50">
        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 rounded-md px-2 py-0.5">
          Nghỉ full: {stats.leaveFull}
        </Badge>
        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900 rounded-md px-2 py-0.5">
          Nghỉ 1/2: {stats.leaveHalf}
        </Badge>
        
        {stats.pending > 0 && (
          <Badge className="ml-auto bg-blue-100 text-blue-700 hover:bg-blue-100 px-2 py-0.5 border-none font-medium rounded-md">
             {stats.pending} Chờ duyệt
          </Badge>
        )}
      </div>
    </div>
  );
}
