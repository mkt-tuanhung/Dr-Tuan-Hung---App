
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, Calendar, User, Phone } from 'lucide-react';

export default function ResponsiveRevenueCard({ r, onEdit, onDelete }) {
  return (
    <div className="mobile-card relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
      <div className="pl-2">
        <div className="flex justify-between items-start mb-3 border-b border-border/50 pb-3">
          <div className="mobile-text-truncate pr-2">
            <h3 className="font-bold text-[15px] flex items-center gap-2 text-foreground mb-1 leading-tight">
              <User className="w-4 h-4 text-primary shrink-0" /> {r.customerName}
            </h3>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Phone className="w-3 h-3 shrink-0" /> {r.customerPhone || 'N/A'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="block font-black text-[15px] text-emerald-600 tabular-nums">{formatVNDDisplay(r.revenueAmount)}</span>
            {r.upsaleRevenue > 0 && <span className="block text-[10px] text-primary font-bold tabular-nums">+{formatVNDDisplay(r.upsaleRevenue)} up</span>}
          </div>
        </div>

        <div className="bg-muted/20 rounded-lg p-2.5 space-y-1.5 text-xs mb-3 border border-border/60">
          <div className="flex justify-between"><span className="text-muted-foreground">Ngày:</span><span className="font-medium text-foreground">{r.revenueDate ? format(parseISO(r.revenueDate), 'dd/MM/yyyy') : '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sale Offline:</span><span className="font-medium text-purple-700">{r.saleOfflineName || '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Telesale:</span><span className="font-medium text-blue-700">{r.telesaleName || '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Dịch vụ:</span><span className="font-medium text-foreground text-right">{r.serviceUsed || '-'}</span></div>
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[9px] bg-background text-muted-foreground px-1.5 py-0 rounded">{r.serviceGroup}</Badge>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded">{r.customerSource}</Badge>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-8 w-8 px-0 btn-touch text-blue-700 bg-blue-50 border-blue-200" onClick={() => onEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="sm" className="h-8 w-8 px-0 btn-touch text-rose-700 bg-rose-50 border-rose-200" onClick={() => onDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
