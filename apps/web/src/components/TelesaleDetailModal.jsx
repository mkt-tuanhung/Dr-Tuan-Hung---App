
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getTelesaleDailyReports, getCustomerAppointments } from '@/utils/telesaleKpiUtils.js';
import { getRevenueRecords } from '@/utils/userStorage.js';
import { getStaffByPosition } from '@/utils/staffPositionUtils.js';
import { format, parseISO } from 'date-fns';
import { FileText, CalendarCheck, Banknote } from 'lucide-react';

const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(val || 0);

const TelesaleDetailModal = ({ isOpen, onClose, employee, month }) => {
  if (!employee || !month) return null;

  const dailyReports = getTelesaleDailyReports().filter(r => r.employeeId === employee.id && r.month === month)
    .sort((a, b) => b.date.localeCompare(a.date));
    
  const appointments = getCustomerAppointments().filter(a => a.telesaleEmployeeId === employee.id && a.appointmentDate.startsWith(month))
    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
    
  const revenues = getRevenueRecords().filter(r => r.telesaleEmployeeId === employee.id && r.month === month)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const saleStaff = getStaffByPosition('sale offline');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Chi tiết KPI Telesale: {employee.fullName}</DialogTitle>
          <DialogDescription>
            Tháng {month} - Mã NV: {employee.employeeId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 mt-4">
          {/* Daily Reports Table */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Báo cáo ngày
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-16 text-center">STT</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead className="text-center">Số ĐT đã nhận</TableHead>
                    <TableHead className="text-center">Tổng lịch hẹn</TableHead>
                    <TableHead className="text-center">Tỷ lệ chốt</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyReports.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Không có dữ liệu</TableCell></TableRow>
                  ) : (
                    dailyReports.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-center">{i + 1}</TableCell>
                        <TableCell className="font-medium">{format(parseISO(r.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-center">{r.totalPhonesReceived}</TableCell>
                        <TableCell className="text-center font-medium text-emerald-600">{r.totalAppointments}</TableCell>
                        <TableCell className="text-center">
                          {r.totalPhonesReceived > 0 ? ((r.totalAppointments / r.totalPhonesReceived) * 100).toFixed(1) : 0}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.note || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Appointments Table */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-600" /> Lịch hẹn khách hàng
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-emerald-50/50">
                  <TableRow>
                    <TableHead className="w-16 text-center">STT</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Dịch vụ quan tâm</TableHead>
                    <TableHead>Ngày giờ hẹn</TableHead>
                    <TableHead>Sale phụ trách</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Không có dữ liệu</TableCell></TableRow>
                  ) : (
                    appointments.map((a, i) => {
                      const sale = saleStaff.find(s => s.id === a.assignedSaleEmployeeId);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-center">{i + 1}</TableCell>
                          <TableCell className="font-medium">{a.customerName}</TableCell>
                          <TableCell>{a.customerPhone}</TableCell>
                          <TableCell>{a.serviceNeed || '-'}</TableCell>
                          <TableCell>
                            {format(parseISO(a.appointmentDate), 'dd/MM/yyyy')} {a.appointmentTime && `- ${a.appointmentTime}`}
                          </TableCell>
                          <TableCell>{sale ? sale.fullName : '-'}</TableCell>
                          <TableCell>
                            <Badge variant={a.status === 'pending' ? 'outline' : 'default'} className={a.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-500'}>
                              {a.status === 'pending' ? 'Chờ xử lý' : 'Đã xử lý'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Revenue Records Table */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Banknote className="w-5 h-5 text-purple-600" /> Bản ghi doanh thu
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-purple-50/50">
                  <TableRow>
                    <TableHead className="w-16 text-center">STT</TableHead>
                    <TableHead>Thời gian ghi nhận</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead className="text-right">Doanh thu (VNĐ)</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenues.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Không có dữ liệu</TableCell></TableRow>
                  ) : (
                    revenues.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-center">{i + 1}</TableCell>
                        <TableCell>{format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="font-medium">{r.customerName}</TableCell>
                        <TableCell>{r.customerPhone}</TableCell>
                        <TableCell className="text-right font-semibold text-purple-600">
                          {formatCurrency(r.revenueAmount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.note || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelesaleDetailModal;
