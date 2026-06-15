
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { WrapText as ReceiptText, CalendarDays, Eye, TrendingUp, Coins as HandCoins, MinusCircle, Wallet, CalendarClock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getMonthlyPayrollsWithSync } from '@/utils/PayrollStorageUtils.js';
import { normalize } from '@/utils/userMatchHelper.js';

import PayrollDetailModal from '@/components/PayrollDetailModal.jsx';

const PayrollEmployeePage = ({ hideLayout = false }) => {
  const { user } = useAuth();
  
  const [myPayrolls, setMyPayrolls] = useState([]);
  const [latestPayroll, setLatestPayroll] = useState(null);
  const [detailModal, setDetailModal] = useState({ isOpen: false, data: null });

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const all = await getMonthlyPayrollsWithSync();
      const normalizedEmpId = normalize(user.employeeId);
      const normalizedUserId = normalize(user.id);
      
      const mine = all.filter(p => {
        const pId = normalize(p.employeeId);
        return pId === normalizedEmpId || pId === normalizedUserId;
      });
      
      const sorted = mine.sort((a,b) => b.month.localeCompare(a.month)); // Newest first
      setMyPayrolls(sorted);
      
      if (sorted.length > 0) {
        setLatestPayroll(sorted[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    const handleSync = (e) => {
      if (!e.detail || !e.detail.table || e.detail.table === 'monthly_payrolls') {
        loadData();
      }
    };
    window.addEventListener('supabase-data-updated', handleSync);
    return () => window.removeEventListener('supabase-data-updated', handleSync);
  }, [loadData]);

  const content = (
    <div className={`space-y-6 ${hideLayout ? '' : 'container max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1'}`}>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <ReceiptText className="w-8 h-8 text-[hsl(var(--primary))]" />
          Phiếu Lương Cá Nhân
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Theo dõi chi tiết thu nhập của bạn
        </p>
      </div>

      {latestPayroll ? (
        <>
          <div className="flex items-center justify-between bg-card border border-border rounded-xl shadow-sm p-4 mb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[hsl(var(--primary))]" />
              <span className="font-semibold text-lg">Kỳ lương tháng {latestPayroll.month}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${latestPayroll.status === 'locked' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                {latestPayroll.status === 'locked' ? 'Đã chốt' : 'Tạm tính'}
              </span>
              {myPayrolls.length > 1 && (
                <select 
                  className="text-sm border-border rounded-lg bg-background"
                  value={latestPayroll.id}
                  onChange={(e) => setLatestPayroll(myPayrolls.find(p => p.id === e.target.value))}
                >
                  {myPayrolls.map(p => (
                    <option key={p.id} value={p.id}>Tháng {p.month}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="shadow-sm border-none bg-blue-50 text-blue-700 rounded-xl">
              <CardContent className="p-5 flex flex-col justify-center h-full">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <TrendingUp className="w-4 h-4" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Tổng thu nhập</p>
                </div>
                <p className="text-2xl font-bold tabular-nums break-words">{formatVNDDisplay(latestPayroll.grossIncome)}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-rose-50 text-rose-700 rounded-xl">
              <CardContent className="p-5 flex flex-col justify-center h-full">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <MinusCircle className="w-4 h-4" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Tổng khấu trừ</p>
                </div>
                <p className="text-2xl font-bold tabular-nums break-words">{formatVNDDisplay(latestPayroll.totalDeductions)}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-amber-50 text-amber-700 rounded-xl">
              <CardContent className="p-5 flex flex-col justify-center h-full">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <CalendarClock className="w-4 h-4" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Công thực tế</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold tabular-nums">{latestPayroll.paidWorkDays}</p>
                  <span className="text-sm opacity-70">/ {latestPayroll.standardWorkDays}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none bg-gradient-to-br from-primary to-[hsl(var(--primary)/0.8)] text-primary-foreground rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                <Wallet className="w-16 h-16" />
              </div>
              <CardContent className="p-5 flex flex-col justify-center h-full relative z-10">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-90">Thực lãnh</p>
                <p className="text-3xl font-extrabold tabular-nums break-words">{formatVNDDisplay(latestPayroll.netSalary)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
            <div className="p-5 bg-muted/20 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-lg">Chi tiết thu nhập</h3>
              <Button onClick={() => setDetailModal({ isOpen: true, data: latestPayroll })} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Eye className="w-4 h-4 mr-2" /> Xem phiếu đầy đủ
              </Button>
            </div>
            <div className="p-0">
              <div className="divide-y divide-border">
                <div className="flex justify-between items-center p-4 hover:bg-muted/30 transition-colors">
                  <span className="text-muted-foreground font-medium">Lương cơ bản</span>
                  <span className="font-semibold tabular-nums">{formatVNDDisplay(latestPayroll.baseSalary)}</span>
                </div>
                <div className="flex justify-between items-center p-4 hover:bg-muted/30 transition-colors">
                  <span className="text-muted-foreground font-medium">Lương theo ngày công</span>
                  <span className="font-semibold tabular-nums">{formatVNDDisplay(latestPayroll.salaryByAttendance)}</span>
                </div>
                <div className="flex justify-between items-center p-4 hover:bg-muted/30 transition-colors">
                  <span className="text-muted-foreground font-medium">Phụ cấp</span>
                  <span className="font-semibold tabular-nums">{formatVNDDisplay(latestPayroll.allowance)}</span>
                </div>
                <div className="flex justify-between items-center p-4 hover:bg-emerald-50 transition-colors bg-emerald-50/30 text-emerald-700">
                  <span className="font-semibold flex items-center gap-2">
                    <HandCoins className="w-4 h-4" /> Hoa hồng & Thưởng
                  </span>
                  <span className="font-bold tabular-nums">+{formatVNDDisplay(latestPayroll.totalCommission + latestPayroll.otherBonus)}</span>
                </div>
                {latestPayroll.totalDeductions > 0 && (
                  <div className="flex justify-between items-center p-4 hover:bg-rose-50 transition-colors bg-rose-50/30 text-rose-700">
                    <span className="font-semibold flex items-center gap-2">
                      <MinusCircle className="w-4 h-4" /> Khấu trừ & Tạm ứng
                    </span>
                    <span className="font-bold tabular-nums">-{formatVNDDisplay(latestPayroll.totalDeductions)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-card border border-border rounded-2xl flex flex-col items-center justify-center">
          <ReceiptText className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">Chưa có dữ liệu</h3>
          <p className="text-muted-foreground">Bạn chưa có phiếu lương nào trên hệ thống.</p>
        </div>
      )}

      <PayrollDetailModal 
        isOpen={detailModal.isOpen} 
        onClose={() => setDetailModal({ isOpen: false, data: null })}
        payroll={detailModal.data}
      />
    </div>
  );

  if (hideLayout) return content;

  return (
    <>
      <Helmet><title>Phiếu Lương - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen flex flex-col bg-muted/20">
        <Header />
        <main className="flex-1">{content}</main>
        <Footer />
      </div>
    </>
  );
};

export default PayrollEmployeePage;
