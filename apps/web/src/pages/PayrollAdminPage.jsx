
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatVNDDisplay } from '@/utils/currencyFormat.js';
import { Calculator, Search, ShieldCheck, BarChart3, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getMonthlyPayrollsWithSync, lockPayrollInSupabase, saveOrUpdatePayroll, savePayrollToSupabase } from '@/utils/PayrollStorageUtils.js';
import { calculateMonthlyPayrollAllUsersForMonth, generatePayrollForUser } from '@/utils/PayrollCalculationEngine.js';
import { getUsers } from '@/utils/userStorage.js';
import { refreshPayrollsFromSupabase } from '@/services/dataService.js';

import PayrollSummaryStats from '@/components/PayrollSummaryStats.jsx';
import ResponsivePayrollCard from '@/components/ResponsivePayrollCard.jsx';
import PayrollDetailModal from '@/components/PayrollDetailModal.jsx';
import MonthYearPicker from '@/components/MonthYearPicker.jsx';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];

const PayrollAdminPage = ({ hideLayout = false }) => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [payrolls, setPayrolls] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [detailModal, setDetailModal] = useState({ isOpen: false, data: null });

  const loadData = useCallback(async () => {
    try {
      const all = await getMonthlyPayrollsWithSync();
      setPayrolls(all.filter(p => p.month === selectedMonth));
    } catch (e) {
      console.error(e);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
    const handleSync = (e) => {
      if (!e.detail || !e.detail.table || e.detail.table === 'monthly_payrolls') {
        loadData();
      }
    };
    window.addEventListener('supabase-data-updated', handleSync);
    return () => window.removeEventListener('supabase-data-updated', handleSync);
  }, [loadData, refreshKey]);

  const filteredPayrolls = useMemo(() => {
    if (!searchQuery) return payrolls;
    const q = searchQuery.toLowerCase();
    return payrolls.filter(p => 
      p.fullName.toLowerCase().includes(q) || 
      p.employeeId.toLowerCase().includes(q) ||
      (p.position || '').toLowerCase().includes(q)
    );
  }, [payrolls, searchQuery]);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const updated = calculateMonthlyPayrollAllUsersForMonth(selectedMonth);
      if (updated && updated.length > 0) {
         await Promise.all(updated.map(p => savePayrollToSupabase(p)));
         toast.success(`Đã tính và đồng bộ lương cho ${updated.length} nhân sự tháng ${selectedMonth}`);
      } else {
         toast.success(`Không có bản ghi lương nào được tạo mới hoặc cập nhật`);
      }
      await loadData();
    } catch (error) {
      toast.error('Lỗi khi tính lương: ' + error.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRefreshSupabase = async () => {
    setIsRefreshing(true);
    const success = await refreshPayrollsFromSupabase();
    if (success) {
      await loadData();
    }
    setIsRefreshing(false);
  };

  const handleToggleLock = async (payroll) => {
    if (payroll.status === 'locked') {
      const updated = await lockPayrollInSupabase(payroll.id, false);
      if (updated) toast.success(`Đã mở khóa lương của ${payroll.fullName}`);
    } else {
      const updated = await lockPayrollInSupabase(payroll.id, true, user?.id);
      if (updated) toast.success(`Đã chốt lương của ${payroll.fullName}`);
    }
    
    if (detailModal.isOpen && detailModal.data?.id === payroll.id) {
      setDetailModal({ 
        isOpen: true, 
        data: { ...payroll, status: payroll.status === 'locked' ? 'draft' : 'locked' } 
      });
    }
    
    await loadData();
  };

  const handleSaveDetail = async (id, updates) => {
    const p = payrolls.find(x => x.id === id);
    if (!p) return;
    
    const users = getUsers();
    const u = users.find(x => x.employeeId === p.employeeId);
    if (!u) return toast.error('Không tìm thấy thông tin nhân viên gốc.');

    const localUpdated = saveOrUpdatePayroll(p.employeeId, selectedMonth, { ...p, ...updates });
    await savePayrollToSupabase(localUpdated);
    
    const calculatedData = generatePayrollForUser(u, selectedMonth);
    const finalLocal = saveOrUpdatePayroll(u.employeeId, selectedMonth, calculatedData);
    await savePayrollToSupabase(finalLocal);
    
    setDetailModal({ isOpen: false, data: null });
    await loadData();
    toast.success('Đã cập nhật, tính lại lương và đồng bộ thành công!');
  };

  const deptData = useMemo(() => {
    const map = {};
    payrolls.forEach(p => {
      const pos = p.position || 'Khác';
      map[pos] = (map[pos] || 0) + p.netSalary;
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k] })).sort((a,b) => b.value - a.value);
  }, [payrolls]);

  const structureData = useMemo(() => {
    let fixed = 0, comm = 0, bonus = 0, ded = 0;
    payrolls.forEach(p => {
      fixed += p.fixedSalary;
      comm += p.totalCommission;
      bonus += p.otherBonus;
      ded += p.totalDeductions;
    });
    return [
      { name: 'Cố định', value: fixed },
      { name: 'Hoa hồng', value: comm },
      { name: 'Thưởng', value: bonus },
      { name: 'Khấu trừ', value: ded }
    ].filter(d => d.value > 0);
  }, [payrolls]);

  const content = (
    <div className={`space-y-6 ${hideLayout ? '' : 'container max-w-[1400px] mx-auto px-4 sm:px-6 py-8 flex-1'}`}>
      <div className="mb-6 border-b border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[28px] sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Calculator className="w-8 h-8 text-primary" />
            Bảng Lương Tổng Hợp
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Quản lý, tính toán và chốt bảng lương hàng tháng
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
          <Button onClick={handleRefreshSupabase} disabled={isRefreshing || isCalculating} variant="outline" className="w-full sm:w-auto">
            {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} 
            Làm mới Supabase
          </Button>
          <MonthYearPicker 
            value={selectedMonth}
            onChange={setSelectedMonth}
            className="w-full sm:w-[200px] bg-background"
          />
          <Button onClick={handleCalculate} disabled={isCalculating || isRefreshing} className="w-full sm:w-auto bg-primary hover:bg-primary/90 whitespace-nowrap">
            {isCalculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />} 
            {isCalculating ? 'Đang tính...' : 'Tính Lương'}
          </Button>
        </div>
      </div>

      <PayrollSummaryStats payrolls={payrolls} isLoading={isCalculating || isRefreshing} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 shadow-sm border-border bg-card min-w-0 w-full">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Chi phí lương theo bộ phận</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 w-full h-[300px] sm:h-[400px]">
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => (v/1000000).toFixed(0) + 'M'} />
                  <RechartsTooltip formatter={(v) => formatVNDDisplay(v)} cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-sm border-border bg-card min-w-0 w-full">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Cơ cấu thu nhập</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 w-full h-[300px] sm:h-[400px]">
            {structureData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={structureData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {structureData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v) => formatVNDDisplay(v)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border bg-card overflow-hidden min-w-0 w-full">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center gap-3">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Tìm nhân viên..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Bộ phận</TableHead>
                <TableHead className="text-center">Ngày công</TableHead>
                <TableHead className="text-right">Cố định</TableHead>
                <TableHead className="text-right">DT / Upsale (Sale)</TableHead>
                <TableHead className="text-right">Hoa hồng / Thưởng</TableHead>
                <TableHead className="text-right">Khấu trừ</TableHead>
                <TableHead className="text-right text-primary font-bold">Thực lãnh</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
                <TableHead className="text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayrolls.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Không có dữ liệu bảng lương tháng này.</TableCell></TableRow>
              ) : (
                filteredPayrolls.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{p.fullName}</div>
                      <div className="text-xs text-muted-foreground">{p.employeeId}</div>
                    </TableCell>
                    <TableCell>{p.position}</TableCell>
                    <TableCell className="text-center font-medium">{p.paidWorkDays} / {p.standardWorkDays}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatVNDDisplay(p.fixedSalary)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {(p.position || '').toLowerCase().includes('sale offline') || (p.position || '').toLowerCase().includes('sale') ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-purple-600 font-medium bg-purple-50 px-1.5 rounded" title="Doanh thu">DT: {formatVNDDisplay(p.saleOfflineRevenueAmount || 0)}</span>
                          <span className="text-blue-600 font-medium bg-blue-50 px-1.5 rounded" title="Upsale">Up: {formatVNDDisplay(p.saleOfflineUpsaleAmount || 0)}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 font-medium">{formatVNDDisplay(p.totalCommission)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600 font-medium">{formatVNDDisplay(p.totalDeductions)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-primary">{formatVNDDisplay(p.netSalary)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={p.status === 'locked' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'}>
                        {p.status === 'locked' ? 'Đã chốt' : 'Bản nháp'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => setDetailModal({ isOpen: true, data: p })}>Chi tiết</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col p-4 gap-3 bg-muted/10">
          {filteredPayrolls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Không có dữ liệu.</div>
          ) : (
            filteredPayrolls.map(p => (
              <ResponsivePayrollCard 
                key={p.id} 
                payroll={p} 
                onViewDetail={(data) => setDetailModal({ isOpen: true, data })} 
                onToggleLock={handleToggleLock}
              />
            ))
          )}
        </div>
      </Card>

      <PayrollDetailModal 
        isOpen={detailModal.isOpen} 
        onClose={() => setDetailModal({ isOpen: false, data: null })}
        payroll={detailModal.data}
        onSave={handleSaveDetail}
        onToggleLock={handleToggleLock}
      />
    </div>
  );

  if (hideLayout) return content;

  return (
    <>
      <Helmet><title>Bảng Lương - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen flex flex-col bg-muted/20">
        <Header />
        <main className="flex-1">{content}</main>
        <Footer />
      </div>
    </>
  );
};

export default PayrollAdminPage;
