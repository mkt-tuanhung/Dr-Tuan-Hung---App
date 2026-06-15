
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { usePayroll } from '@/hooks/usePayroll.js';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat.js';
import PayrollChart from '@/components/PayrollChart.jsx';
import PayslipModal from '@/components/PayslipModal.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Loader2, DollarSign } from 'lucide-react';

const PayrollPage = () => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const { payrolls, loading, calculatePayrollForMonth } = usePayroll();
  const { formatCurrency } = useCurrencyFormat();
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  useEffect(() => { calculatePayrollForMonth(month, year); }, [month, year, calculatePayrollForMonth]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const formatVND = (value) => `${formatCurrency(value)} đ`;

  return (
    <>
      <Helmet><title>Lương thưởng - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-0 pb-safe-nav">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-border pb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-2 tracking-tight"><DollarSign className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" /> Bảng tính lương</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">Tính toán lương tự động dựa trên ngày công</p>
            </div>
            <div className="flex flex-col sm:flex-row w-full md:w-auto items-center gap-3">
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="flex-1 md:w-[120px] bg-card h-11"><SelectValue placeholder="Tháng" /></SelectTrigger>
                <SelectContent>{months.map(m => <SelectItem key={m} value={m.toString()}>Tháng {m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="flex-1 md:w-[100px] bg-card h-11"><SelectValue placeholder="Năm" /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {!loading && payrolls.length > 0 && <div className="mb-6 w-full h-[300px]"><PayrollChart data={payrolls} /></div>}

          {loading ? (
            <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : payrolls.length > 0 ? (
            <>
              <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow><TableHead>Nhân viên</TableHead><TableHead className="text-right">Lương CB</TableHead><TableHead className="text-right">Phụ cấp</TableHead><TableHead className="text-center">Ngày công</TableHead><TableHead className="text-center">Vắng</TableHead><TableHead className="text-right font-bold text-emerald-600">Thực lãnh</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrolls.map((r) => (
                      <TableRow key={r.staff_id}>
                        <TableCell><div className="font-bold">{r.staff_name}</div>{r.probation && <Badge variant="outline" className="bg-amber-50 text-amber-600 mt-1">Thử việc</Badge>}</TableCell>
                        <TableCell className="text-right font-medium">{formatVND(r.effective_basic_salary)}</TableCell>
                        <TableCell className="text-right">{formatVND(r.allowances_total)}</TableCell>
                        <TableCell className="text-center text-primary font-bold">{r.working_days}</TableCell>
                        <TableCell className="text-center text-rose-500 font-medium">{r.absent_days}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 text-lg">{formatVND(r.net_salary)}</TableCell>
                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setSelectedPayroll(r)}><FileText className="w-4 h-4 mr-1" /> Phiếu</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3">
                {payrolls.map(r => (
                  <div key={r.staff_id} className="mobile-card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="mobile-text-truncate">
                        <h3 className="font-bold text-base">{r.staff_name}</h3>
                        {r.probation && <Badge className="bg-amber-100 text-amber-700 border-none px-1.5 py-0 text-[10px] mt-1">Thử việc</Badge>}
                      </div>
                      <Button variant="outline" size="sm" className="btn-touch h-8 bg-blue-50 text-blue-700 border-blue-200" onClick={() => setSelectedPayroll(r)}><FileText className="w-3.5 h-3.5 mr-1" /> Phiếu</Button>
                    </div>
                    <div className="bg-muted/20 p-2.5 rounded-lg border border-border/50 text-sm space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted-foreground">Lương CB:</span><span className="font-medium">{formatVND(r.effective_basic_salary)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Phụ cấp:</span><span className="font-medium">{formatVND(r.allowances_total)}</span></div>
                      <div className="flex justify-between pt-1 mt-1 border-t"><span className="text-muted-foreground">Công/Vắng:</span><span className="font-semibold text-primary">{r.working_days} / <span className="text-rose-500">{r.absent_days}</span></span></div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-bold uppercase text-muted-foreground">Thực lãnh</span>
                      <span className="text-xl font-black text-emerald-600 tabular-nums tracking-tight">{formatVND(r.net_salary)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state-mobile">Không có dữ liệu lương trong kỳ này.</div>
          )}
        </main>
        <Footer />
        <PayslipModal isOpen={!!selectedPayroll} onClose={() => setSelectedPayroll(null)} payroll={selectedPayroll} />
      </div>
    </>
  );
};

export default PayrollPage;
