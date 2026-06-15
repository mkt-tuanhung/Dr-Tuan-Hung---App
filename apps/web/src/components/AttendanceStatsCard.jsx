
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarCheck, Clock, FileWarning, Briefcase, Activity } from 'lucide-react';

const AttendanceStatsCard = ({ records, requests, month, year, employeeId }) => {
  const stats = useMemo(() => {
    const monthRecords = records.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year && r.employeeId === employeeId;
    });

    const monthRequests = requests.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year && r.employeeId === employeeId;
    });

    const totalWorkUnits = monthRecords.reduce((sum, r) => sum + (Number(r.workUnit) || 0), 0);
    const checkedInDays = monthRecords.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'early_leave').length;
    const leaveDays = monthRecords.filter(r => r.status.includes('leave')).length;
    
    const pendingReqs = monthRequests.filter(r => r.status === 'pending').length;
    const rejectedReqs = monthRequests.filter(r => r.status === 'rejected').length;

    return { totalWorkUnits, checkedInDays, leaveDays, pendingReqs, rejectedReqs };
  }, [records, requests, month, year, employeeId]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col items-start gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalWorkUnits}</p>
            <p className="text-xs text-muted-foreground font-medium">Tổng công</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col items-start gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.checkedInDays}</p>
            <p className="text-xs text-muted-foreground font-medium">Ngày đi làm</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col items-start gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.leaveDays}</p>
            <p className="text-xs text-muted-foreground font-medium">Ngày nghỉ</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col items-start gap-2">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.pendingReqs}</p>
            <p className="text-xs text-muted-foreground font-medium">Chờ duyệt</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col items-start gap-2">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
            <FileWarning className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.rejectedReqs}</p>
            <p className="text-xs text-muted-foreground font-medium">Từ chối</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceStatsCard;
