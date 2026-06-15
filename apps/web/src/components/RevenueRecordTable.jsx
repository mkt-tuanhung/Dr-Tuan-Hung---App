
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { deleteRevenueRecord } from '@/utils/userStorage.js';
import { softDeleteRevenueRecordToSupabase } from '@/services/dataService.js';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, List } from 'lucide-react';
import ResponsiveRevenueCard from '@/components/ResponsiveRevenueCard.jsx';

const RevenueRecordTable = ({ records, onEdit, onRefresh }) => {
  const [page, setPage] = useState(1);
  const [mobileMonth, setMobileMonth] = useState(format(new Date(), 'yyyy-MM'));
  const itemsPerPage = 5;

  const sortedRecords = [...records].sort((a, b) => {
    return new Date(b.revenueDate || b.createdAt) - new Date(a.revenueDate || a.createdAt);
  });

  const mobileFiltered = sortedRecords.filter(r => (r.month || r.revenueDate?.substring(0,7)) === mobileMonth);
  const totalPages = Math.ceil(mobileFiltered.length / itemsPerPage);
  const paginated = mobileFiltered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleDelete = async (id) => {
    if (window.confirm('Xóa bản ghi doanh thu này?')) {
      const deletedRecord = deleteRevenueRecord(id);
      if (deletedRecord) {
        toast.success('Đã xóa dữ liệu cục bộ.');
        await softDeleteRevenueRecordToSupabase(id);
        if (onRefresh) onRefresh();
      }
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-lg md:text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
        <List className="w-5 h-5 text-primary" /> Danh sách doanh thu
      </h2>
      
      {/* Desktop View */}
      <div className="hidden md:block">
        <Card className="shadow-sm border-border bg-card overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] w-full">
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-20 shadow-sm">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Ngày</TableHead>
                  <TableHead className="min-w-[160px]">Khách hàng</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Sale Offline</TableHead>
                  <TableHead>Telesale</TableHead>
                  <TableHead>Dịch vụ</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead className="text-center w-[100px] sticky right-0 bg-muted/40 z-20">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8">Không có dữ liệu</TableCell></TableRow> : sortedRecords.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.revenueDate ? format(parseISO(r.revenueDate), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="font-semibold">{r.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.customerPhone || '-'}</TableCell>
                    <TableCell className="text-purple-600">{r.saleOfflineName || '-'}</TableCell>
                    <TableCell className="text-blue-600">{r.telesaleName || '-'}</TableCell>
                    <TableCell className="text-sm">{r.serviceUsed || '-'}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{formatVNDDisplay(r.revenueAmount)}</TableCell>
                    <TableCell className="text-center sticky right-0 bg-card border-l">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="text-blue-600" onClick={() => onEdit(r)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4 pb-safe-nav">
        <div className="bg-card p-3 rounded-xl border border-border flex items-center gap-3">
          <span className="text-sm font-medium whitespace-nowrap">Lọc tháng:</span>
          <Input type="month" value={mobileMonth} onChange={e => {setMobileMonth(e.target.value); setPage(1);}} className="h-11 bg-background" />
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state-mobile">Chưa có bản ghi doanh thu trong tháng này</div>
        ) : (
          <div className="space-y-3">
            {paginated.map(r => <ResponsiveRevenueCard key={r.id} r={r} onEdit={onEdit} onDelete={handleDelete} />)}
          </div>
        )}

        {totalPages > 0 && (
          <div className="flex items-center justify-between mt-6 bg-card p-2 rounded-lg border border-border shadow-sm">
            <Button variant="outline" className="btn-touch px-6" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</Button>
            <span className="text-sm font-semibold text-muted-foreground">Trang {page}/{totalPages}</span>
            <Button variant="outline" className="btn-touch px-6" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Tiếp</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueRecordTable;
