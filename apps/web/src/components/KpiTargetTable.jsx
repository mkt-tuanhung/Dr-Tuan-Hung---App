
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatVND } from '@/utils/currencyFormat.js';
import { deleteKpiTarget } from '@/utils/userStorage.js';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';

const TYPE_MAP = {
  'telesale': 'Telesale',
  'sale_offline': 'Sale Offline',
  'direct_page': 'Trực Page',
  'page': 'Trực Page'
};

const KpiTargetTable = ({ targets, onEdit, onRefresh }) => {
  const sortedTargets = [...targets].sort((a, b) => b.month.localeCompare(a.month) || a.employeeName.localeCompare(b.employeeName));

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa KPI này không?')) {
      deleteKpiTarget(id);
      toast.success('Đã xóa KPI.');
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-12 text-center">STT</TableHead>
              <TableHead>Tháng</TableHead>
              <TableHead>Nhân sự</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Loại KPI</TableHead>
              <TableHead className="text-right">KPI Doanh thu / SĐT</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="text-center w-24">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Chưa có KPI nào được giao.
                </TableCell>
              </TableRow>
            ) : (
              sortedTargets.map((t, idx) => (
                <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-center text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{t.month}</TableCell>
                  <TableCell className="font-medium">{t.employeeName || t.fullName}</TableCell>
                  <TableCell className="text-sm">{t.departmentPosition || t.position || '-'}</TableCell>
                  <TableCell className="text-sm font-medium">{TYPE_MAP[t.targetType] || t.targetType}</TableCell>
                  <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                    {t.targetType === 'page' ? (t.targetPhones || 0) : formatVND(t.targetValue || t.targetRevenue || 0)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={t.note}>
                    {t.note || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => onEdit && onEdit(t)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default KpiTargetTable;
