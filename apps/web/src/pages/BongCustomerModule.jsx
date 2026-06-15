
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getCustomerAppointments } from '@/utils/userStorage.js';
import { savePageDailyReportToSupabase } from '@/services/dataService.js';
import { Users, PhoneCall, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const BongCustomerModule = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportPhones, setReportPhones] = useState('');

  const loadData = useCallback(() => {
    const all = getCustomerAppointments();
    const bong = all.filter(a => {
      const s = (a.status || '').toLowerCase();
      return s === 'bong' || s === 'bỏng';
    });
    setAppointments(bong);
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('supabase-data-updated', loadData);
    return () => window.removeEventListener('supabase-data-updated', loadData);
  }, [loadData]);

  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!reportPhones || Number(reportPhones) < 0) return toast.error('Vui lòng nhập số hợp lệ.');

    const d = new Date();
    const payload = {
      id: crypto.randomUUID(),
      employeeId: user?.employeeId || user?.id,
      fullName: user?.fullName,
      date: format(d, 'yyyy-MM-dd'),
      month: format(d, 'yyyy-MM'),
      totalPhones: Number(reportPhones),
      totalMessages: 0,
      conversionRate: 0,
      commissionAmount: Number(reportPhones) * 20000,
      note: 'Nhập từ module Khách Bong',
      createdBy: user?.id,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString()
    };

    const localReports = getStorageItem('pageDailyReports', []);
    localReports.push(payload);
    setStorageItem('pageDailyReports', localReports);

    const success = await savePageDailyReportToSupabase(payload);
    if (success) {
      toast.success('Đã lưu báo cáo SĐT lên hệ thống.');
      setReportModalOpen(false);
      setReportPhones('');
    }
  };

  return (
    <>
      <Helmet><title>Khách Bong - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen flex flex-col bg-muted/20">
        <Header />
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <Users className="w-8 h-8 text-orange-500" /> Quản lý khách Bong
              </h1>
              <p className="text-muted-foreground mt-1">Danh sách khách hàng đang ở trạng thái Bong</p>
            </div>
            
            <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PhoneCall className="w-4 h-4 mr-2" /> Báo cáo SĐT (Page)
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Báo cáo số điện thoại (Page)</DialogTitle></DialogHeader>
                <form onSubmit={handleSaveReport} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Số điện thoại thu được</Label>
                    <Input type="number" min="0" value={reportPhones} onChange={e => setReportPhones(e.target.value)} required />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setReportModalOpen(false)}>Hủy</Button>
                    <Button type="submit">Lưu báo cáo</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base">Danh sách khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Ngày hẹn</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Telesale</TableHead>
                    <TableHead>Sale Offline</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Không có dữ liệu khách Bong.</TableCell></TableRow>
                  ) : (
                    appointments.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.appointmentDate ? format(parseISO(a.appointmentDate), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-semibold">{a.customerName}</TableCell>
                        <TableCell className="text-muted-foreground">{a.telesaleName || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{a.saleOfflineName || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-transparent">Khách Bong</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default BongCustomerModule;
