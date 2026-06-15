
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, Calendar, User, Phone, CheckSquare } from 'lucide-react';

const STATUS_COLORS = { pending: 'bg-amber-100 text-amber-700 border-amber-200', deposit: 'bg-blue-100 text-blue-700 border-blue-200', surgery: 'bg-emerald-100 text-emerald-700 border-emerald-200', bong: 'bg-rose-100 text-rose-700 border-rose-200' };
const STATUS_LABELS = { pending: 'Chờ tư vấn', deposit: 'Đã cọc', surgery: 'Đã phẫu thuật', bong: 'Bong (Không làm)' };

export default function ResponsiveAppointmentCard({ app, onEdit, onEvaluate, onDelete, canEvaluate, canEdit, canDelete }) {
  const sColor = STATUS_COLORS[app.status] || STATUS_COLORS.pending;
  const sLabel = STATUS_LABELS[app.status] || 'Unknown';

  return (
    <div className="mobile-card bg-card p-4 rounded-xl border shadow-sm space-y-3">
      <div className="flex justify-between items-start mb-2 border-b border-border/50 pb-3">
        <div className="mobile-text-truncate pr-2">
          <h3 className="font-bold text-[15px] flex items-center gap-2 text-foreground mb-1">
            <User className="w-4 h-4 text-primary shrink-0" /> {app.customerName}
          </h3>
          <p className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
            <Phone className="w-3 h-3 shrink-0" /> {app.appointmentTime || '--:--'} • {app.service}
          </p>
        </div>
        <Badge variant="outline" className={`${sColor} whitespace-nowrap text-[10px] shrink-0 font-bold px-2 py-0.5`}>{sLabel}</Badge>
      </div>

      <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5 text-xs mb-3 border border-border/60">
        <div className="flex justify-between"><span className="text-muted-foreground">Telesale:</span><span className="font-medium text-blue-700">{app.telesaleName || '-'}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Sale Offline:</span><span className="font-medium text-purple-700">{app.saleOfflineName || '-'}</span></div>
        <div className="flex justify-between mt-1 pt-1 border-t border-border/40">
          <span className="text-muted-foreground">Dự kiến:</span><span className="font-semibold text-emerald-600">{formatVNDDisplay(app.expectedBill)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Đã cọc:</span><span className="font-bold text-primary">{formatVNDDisplay(app.depositPaid)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        {canEvaluate && (
          <Button variant="outline" size="sm" className="btn-touch flex-1 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 font-medium" onClick={() => onEvaluate(app)}>
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Đánh giá
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" size="sm" className="btn-touch w-10 px-0 text-blue-700 border-blue-200 bg-blue-50" onClick={() => onEdit(app)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
        {canDelete && (
          <Button variant="outline" size="sm" className="btn-touch w-10 px-0 text-rose-700 border-rose-200 bg-rose-50" onClick={() => onDelete(app.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
