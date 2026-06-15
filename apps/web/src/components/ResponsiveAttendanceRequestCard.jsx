
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function ResponsiveAttendanceRequestCard({ req, emp, onApprove, onReject, statusBadgeProps }) {
  return (
    <div className="mobile-card relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      <div className="pl-2">
        <div className="flex justify-between items-start mb-2">
          <div className="mobile-text-truncate">
            <h3 className="font-bold text-base text-foreground leading-tight">{emp?.fullName || 'Không rõ'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{emp?.employeeId || 'N/A'}</p>
          </div>
          <Badge className={`px-2 py-0.5 shadow-none text-[10px] font-medium ${statusBadgeProps.class}`}>
            {statusBadgeProps.label}
          </Badge>
        </div>

        <div className="bg-muted/30 p-2.5 rounded-lg border border-dashed text-sm space-y-1.5 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-xs flex items-center gap-1"><Calendar className="w-3 h-3"/> Ngày xin:</span>
            <span className="font-semibold">{format(parseISO(req.date), 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> Thời gian:</span>
            <span className="font-semibold">{req.requestedTime || 'Cả ngày'}</span>
          </div>
          <div className="flex flex-col mt-1 pt-1 border-t border-border/50">
            <span className="text-muted-foreground text-xs mb-0.5">Lý do:</span>
            <span className="text-xs">{req.reason || 'Không có lý do'}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="btn-touch flex-1 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 font-semibold" onClick={() => onApprove(req)}>
            <CheckCircle className="w-4 h-4 mr-2" /> Phê duyệt
          </Button>
          <Button variant="outline" className="btn-touch flex-1 text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold" onClick={() => onReject(req)}>
            <XCircle className="w-4 h-4 mr-2" /> Từ chối
          </Button>
        </div>
      </div>
    </div>
  );
}
