
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import KPIEditModal from './KPIEditModal.jsx';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const KPIPageDailyReportTable = ({ records, month, onDataChange }) => {
  const [editingRecord, setEditingRecord] = useState(null);
  const COMMISSION_RATE = 20000;

  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0);

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa số liệu ngày này không?')) {
      const allRecords = getStorageItem('pageDailyReports', []);
      const filtered = allRecords.filter(r => r.id !== id);
      setStorageItem('pageDailyReports', filtered);
      toast.success('Đã xóa số liệu.');
      if (onDataChange) onDataChange();
    }
  };

  const handleSaveEdit = (updatedData) => {
    const allRecords = getStorageItem('pageDailyReports', []);
    const index = allRecords.findIndex(r => r.id === editingRecord.id);
    if (index !== -1) {
      allRecords[index] = { ...allRecords[index], ...updatedData, updatedAt: new Date().toISOString() };
      setStorageItem('pageDailyReports', allRecords);
      if (onDataChange) onDataChange();
    }
    setEditingRecord(null);
  };

  return (
    <>
      <Card className="lg:col-span-2 shadow-sm border-border">
        <CardHeader>
          <CardTitle className="text-lg">Lịch sử cập nhật Tháng {month}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-xl">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-center">Tin nhắn</TableHead>
                  <TableHead className="text-center">Số điện thoại</TableHead>
                  <TableHead className="text-center">Tỷ lệ (%)</TableHead>
                  <TableHead className="text-right">Hoa hồng (VNĐ)</TableHead>
                  <TableHead className="text-center w-20">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Chưa có số liệu nào được cập nhật trong tháng này.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r, i) => {
                    const conv = r.totalMessages > 0 ? (r.totalPhones / r.totalMessages) * 100 : 0;
                    const comm = r.totalPhones * COMMISSION_RATE;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-center tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          {format(parseISO(r.date), 'EEEE, dd/MM/yyyy', { locale: vi })}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{r.totalMessages}</TableCell>
                        <TableCell className="text-center tabular-nums font-semibold text-primary">{r.totalPhones}</TableCell>
                        <TableCell className="text-center tabular-nums">{conv.toFixed(1)}%</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 font-medium">{formatCurrency(comm)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setEditingRecord(r)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDelete(r.id)}>
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
        </CardContent>
      </Card>

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

export default KPIPageDailyReportTable;
