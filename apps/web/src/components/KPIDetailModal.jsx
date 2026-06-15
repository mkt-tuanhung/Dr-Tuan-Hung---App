
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import KPIEditModal from './KPIEditModal.jsx';

const KPIDetailModal = ({ isOpen, onClose, employee, month, year, records, onEditRecord, onDeleteRecord }) => {
  const [editingRecord, setEditingRecord] = useState(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa số liệu ngày này không?')) {
      onDeleteRecord(id);
    }
  };

  const handleSaveEdit = (updatedData) => {
    onEditRecord(editingRecord.id, updatedData);
    setEditingRecord(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Chi tiết KPI Trực page - {employee?.fullName}
              <span className="text-sm font-normal text-muted-foreground ml-2">Tháng {month}/{year}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-auto flex-1 mt-4 border rounded-xl bg-card">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-24">Ngày</TableHead>
                  <TableHead className="text-center">Tổng tin nhắn</TableHead>
                  <TableHead className="text-center">Số điện thoại</TableHead>
                  <TableHead className="text-center">Tỷ lệ xin số (%)</TableHead>
                  <TableHead className="text-right">Hoa hồng (VNĐ)</TableHead>
                  <TableHead className="max-w-[150px]">Ghi chú</TableHead>
                  <TableHead className="text-center w-24">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Chưa có dữ liệu trong tháng này.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map(record => {
                    const conversion = record.totalMessages > 0 ? (record.totalPhones / record.totalMessages) * 100 : 0;
                    const commission = record.totalPhones * 20000;
                    
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(parseISO(record.date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{record.totalMessages}</TableCell>
                        <TableCell className="text-center tabular-nums font-semibold text-primary">{record.totalPhones}</TableCell>
                        <TableCell className="text-center tabular-nums">{conversion.toFixed(1)}%</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                          {formatCurrency(commission)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]" title={record.note}>
                          {record.note || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setEditingRecord(record)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDelete(record.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {editingRecord && (
        <KPIEditModal 
          isOpen={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          record={editingRecord}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
};

export default KPIDetailModal;
