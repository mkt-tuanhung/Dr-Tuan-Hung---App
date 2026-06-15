
import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';
import { getUsers } from '@/utils/userStorage.js';

const STATUS_MAP = {
  'pending': { label: 'Chờ tư vấn', color: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
  'bong': { label: 'Bong', color: 'bg-rose-100 text-rose-800 hover:bg-rose-200' },
  'deposit': { label: 'Cọc', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
  'surgery': { label: 'Phẫu thuật', color: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' }
};

const AppointmentDetailModal = ({ isOpen, onClose, title, appointments }) => {
  const users = useMemo(() => getUsers(), []);

  const getUserName = (id) => {
    const user = users.find(u => u.id === id);
    return user ? user.fullName : '-';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto mt-4 border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead className="whitespace-nowrap">Ngày giờ</TableHead>
                <TableHead className="min-w-[150px]">Khách hàng</TableHead>
                <TableHead>Dịch vụ</TableHead>
                <TableHead>Telesale</TableHead>
                <TableHead>Sale Offline</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
                <TableHead className="text-right">Bill dự kiến</TableHead>
                <TableHead className="text-right">Đã cọc</TableHead>
                <TableHead className="min-w-[150px]">Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((app, idx) => {
                  const statusInfo = STATUS_MAP[app.status] || STATUS_MAP['pending'];
                  return (
                    <TableRow key={app.id}>
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{app.appointmentDate ? format(parseISO(app.appointmentDate), 'dd/MM/yyyy') : '-'}</div>
                        <div className="text-xs text-muted-foreground">{app.appointmentTime}</div>
                      </TableCell>
                      <TableCell className="font-semibold">{app.customerName}</TableCell>
                      <TableCell className="text-sm">{app.service}</TableCell>
                      <TableCell className="text-sm text-purple-600">{getUserName(app.telesaleEmployeeId)}</TableCell>
                      <TableCell className="text-sm text-blue-600">{getUserName(app.saleOfflineEmployeeId)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className={statusInfo.color}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatVNDDisplay(app.expectedBill)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatVNDDisplay(app.depositPaid)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={app.conditionNote}>
                        {app.conditionNote || '-'}
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
  );
};

export default AppointmentDetailModal;
