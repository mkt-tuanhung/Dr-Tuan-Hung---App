
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pencil, Trash2 } from 'lucide-react';

export default function ResponsiveKPICard({ t, metrics, progress, statusBadge, onEdit, onDelete }) {
  return (
    <div className="mobile-card">
      <div className="flex justify-between items-start mb-1">
        <div className="mobile-text-truncate">
          <h3 className="font-bold text-base text-primary leading-tight">{t.fullName}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t.employeeId} • {t.position || t.targetType}</p>
        </div>
        {statusBadge && <Badge className={`${statusBadge.className} text-[10px] font-medium shadow-none ml-2 shrink-0 whitespace-nowrap`}>{statusBadge.label}</Badge>}
      </div>
      
      <div className="grid grid-cols-2 gap-3 my-2">
        {metrics.map((m, i) => (
          <div key={i} className={`bg-muted/20 p-2.5 rounded-lg border border-border/60 ${m.colSpan ? 'col-span-2' : ''}`}>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">{m.label}</p>
            <p className={`font-bold text-sm md:text-base ${m.valueClass || 'text-foreground'}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {progress && (
        <div className="space-y-1.5 mt-1 mb-2 bg-card p-3 rounded-lg border shadow-sm">
          <div className="flex justify-between text-xs items-center">
            <span className="font-medium text-muted-foreground">{progress.label}</span>
            <span className="font-bold text-sm">{progress.percent.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(100, progress.percent)} className="h-2" indicatorColor={progress.percent >= 100 ? 'bg-emerald-500' : 'bg-primary'} />
        </div>
      )}
      
      {t.note && (
        <div className="text-xs bg-amber-50 text-amber-800 p-2.5 rounded-lg mt-1 border border-amber-100 flex flex-col gap-1">
          <span className="font-bold uppercase text-[10px] opacity-70">Ghi chú</span>
          <span>{t.note}</span>
        </div>
      )}

      {(onEdit || onDelete) && (
        <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-border/50">
          {onEdit && <Button variant="outline" size="sm" className="btn-touch h-9 flex-1 text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 font-medium" onClick={() => onEdit(t)}><Pencil className="w-3.5 h-3.5 mr-2" /> Sửa KPI</Button>}
          {onDelete && <Button variant="outline" size="sm" className="btn-touch h-9 w-12 px-0 text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100" onClick={() => onDelete(t.id)}><Trash2 className="w-4 h-4" /></Button>}
        </div>
      )}
    </div>
  );
}
