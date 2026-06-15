
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, LayoutList as ListCollapse } from 'lucide-react';

const KPIAdminPageTable = ({ summaries, onOpenDetails, onEditKPI }) => {
  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0);

  return (
    <Card className="lg:col-span-3 shadow-sm border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10 text-center">STT</TableHead>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-center">Tin nhắn</TableHead>
                <TableHead className="text-center">SĐT</TableHead>
                <TableHead className="text-center">Tỷ lệ (%)</TableHead>
                <TableHead className="text-center text-primary bg-primary/5">KPI SĐT</TableHead>
                <TableHead className="text-center text-primary bg-primary/5">% Hoàn thành</TableHead>
                <TableHead className="text-right text-emerald-700">Hoa hồng (VNĐ)</TableHead>
                <TableHead className="text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Không có dữ liệu nhân sự.</TableCell>
                </TableRow>
              ) : (
                summaries.map((summary, idx) => (
                  <TableRow key={summary.employee.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{summary.employee.fullName}</div>
                      <div className="text-xs text-muted-foreground">{summary.employee.employeeId}</div>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{summary.totalMessages}</TableCell>
                    <TableCell className="text-center tabular-nums font-semibold">{summary.totalPhones}</TableCell>
                    <TableCell className="text-center tabular-nums">{summary.conversionRate.toFixed(1)}%</TableCell>
                    
                    <TableCell className="text-center tabular-nums font-bold text-primary bg-primary/5 border-l border-primary/10">
                      {summary.targetPhones || 0}
                    </TableCell>
                    <TableCell className="text-center tabular-nums font-bold text-primary bg-primary/5 border-r border-primary/10">
                      {summary.kpiCompletion.toFixed(1)}%
                    </TableCell>
                    
                    <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                      {formatCurrency(summary.commissionAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={() => onOpenDetails(summary.employee)}>
                          <ListCollapse className="w-4 h-4 mr-1" /> Chi tiết
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Sửa KPI" onClick={() => onEditKPI(summary)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default KPIAdminPageTable;
