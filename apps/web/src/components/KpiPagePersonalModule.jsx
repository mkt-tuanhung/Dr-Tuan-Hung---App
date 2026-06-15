
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { getKpiTargetByEmployeeAndMonth, getPageDailyReports } from '@/utils/userStorage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { MessageSquare, PhoneCall, Percent, Target, Banknote, CheckCircle2, AlertCircle, Clock, Info } from 'lucide-react';
import { formatVND } from '@/utils/currencyFormat.js';
import { format, parseISO } from 'date-fns';

const COMMISSION_PER_PHONE = 20000;

const KpiPagePersonalModule = () => {
  const { user: currentUser } = useAuth();
  
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState((today.getMonth() + 1).toString().padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());

  const monthYearKey = `${selectedYear}-${selectedMonth}`;

  const target = useMemo(() => {
    return getKpiTargetByEmployeeAndMonth(currentUser?.id, monthYearKey, 'page');
  }, [monthYearKey, currentUser?.id]);

  const dailyReports = useMemo(() => {
    const allReports = getPageDailyReports();
    return allReports
      .filter(r => r.employeeId === currentUser?.id && r.date && r.date.startsWith(monthYearKey))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [monthYearKey, currentUser?.id]);

  const stats = useMemo(() => {
    const totalMessages = dailyReports.reduce((sum, r) => sum + (Number(r.totalMessages) || Number(r.messagesCount) || 0), 0);
    const totalPhones = dailyReports.reduce((sum, r) => sum + (Number(r.totalPhones) || Number(r.phonesReceived) || 0), 0);
    const actualConversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
    const commission = totalPhones * COMMISSION_PER_PHONE;

    const safeTarget = target || {};
    const targetPhones = Number(safeTarget.targetPhones) || 0;
    const targetConversionRate = Number(safeTarget.targetConversionRate) || 0;
    
    const completionPercent = targetPhones > 0 ? (totalPhones / targetPhones) * 100 : 0;
    const phonesRemaining = Math.max(0, targetPhones - totalPhones);

    return { 
      totalMessages,
      totalPhones, 
      actualConversionRate, 
      commission,
      targetPhones, 
      targetConversionRate, 
      completionPercent,
      phonesRemaining,
      hasTarget: !!target && targetPhones > 0
    };
  }, [dailyReports, target]);

  const getProgressStatus = (percent) => {
    if (percent < 50) return { label: 'Cần cố gắng', color: 'bg-rose-500', textClass: 'text-rose-600', bgClass: 'bg-rose-50', icon: AlertCircle };
    if (percent < 100) return { label: 'Đang tiến triển', color: 'bg-amber-500', textClass: 'text-amber-600', bgClass: 'bg-amber-50', icon: Clock };
    return { label: 'Đã hoàn thành KPI', color: 'bg-emerald-500', textClass: 'text-emerald-600', bgClass: 'bg-emerald-50', icon: CheckCircle2 };
  };

  const status = getProgressStatus(stats.completionPercent);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
        <h2 className="text-xl font-bold tracking-tight">Hiệu suất Trực page</h2>
        <div className="flex items-center gap-3 bg-card p-2 rounded-xl shadow-sm border border-border">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[120px] bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => (
                <SelectItem key={m} value={m}>Tháng {m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="col-span-2 lg:col-span-2 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-none shadow-md overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Banknote className="w-16 h-16" /></div>
          <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
            <div className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Hoa hồng tạm tính</div>
            <div className="text-3xl font-extrabold tabular-nums tracking-tight">{formatVND(stats.commission)}</div>
            <div className="mt-4 text-xs opacity-80 flex gap-4">
              <span>{stats.totalPhones} SĐT × {formatVND(COMMISSION_PER_PHONE)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg w-fit mb-2"><MessageSquare className="w-4 h-4" /></div>
            <p className="text-xl font-bold tabular-nums">{stats.totalMessages}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Tổng TN/Comment</p>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg w-fit mb-2"><PhoneCall className="w-4 h-4" /></div>
            <p className="text-xl font-bold tabular-nums text-amber-600">{stats.totalPhones}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase mt-1">SĐT thu về</p>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm border-border">
          <CardContent className="p-4 flex flex-col justify-center h-full">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit mb-2"><Percent className="w-4 h-4" /></div>
            <p className="text-xl font-bold tabular-nums text-purple-600">{stats.actualConversionRate.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Tỷ lệ xin số</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-border overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Tiến độ KPI Tháng {selectedMonth}/{selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {stats.hasTarget ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">KPI SĐT mục tiêu</p>
                  <p className="text-xl font-bold text-primary">{stats.targetPhones}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">SĐT đạt được</p>
                  <p className="text-xl font-bold text-emerald-600">{stats.totalPhones}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">SĐT còn thiếu</p>
                  <p className="text-xl font-bold text-rose-600">{stats.phonesRemaining}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">KPI Tỷ lệ xin số</p>
                  <p className="text-xl font-bold text-foreground">
                    <span className={stats.actualConversionRate >= stats.targetConversionRate ? 'text-emerald-600' : 'text-amber-600'}>
                      {stats.actualConversionRate.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground text-sm font-normal ml-1">/ {stats.targetConversionRate}%</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border">
                <div className="flex justify-between items-end">
                  <Label className="font-semibold text-base">Mức độ hoàn thành KPI SĐT</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-primary tabular-nums tracking-tight">
                      {stats.completionPercent.toFixed(1)}%
                    </span>
                    <Badge className={`${status.bgClass} ${status.textClass} hover:${status.bgClass} border-transparent flex items-center gap-1.5 px-2.5 py-1`}>
                      <StatusIcon className="w-3.5 h-3.5" /> {status.label}
                    </Badge>
                  </div>
                </div>
                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-700 ease-in-out ${status.color}`} 
                    style={{ width: `${Math.min(100, stats.completionPercent)}%` }} 
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Bạn chưa được giao KPI cho tháng này.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold tracking-tight">Chi tiết số liệu ngày</h3>
        <Card className="shadow-sm border-border">
          <CardContent className="p-0 overflow-x-auto rounded-xl">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-center">Tổng TN/Comment</TableHead>
                  <TableHead className="text-center">SĐT thu về</TableHead>
                  <TableHead className="text-center">Tỷ lệ xin số</TableHead>
                  <TableHead className="text-right">Hoa hồng (VNĐ)</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Không có báo cáo ngày nào trong tháng này.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailyReports.map((r, idx) => {
                    const messages = Number(r.totalMessages) || Number(r.messagesCount) || 0;
                    const phones = Number(r.totalPhones) || Number(r.phonesReceived) || 0;
                    const rate = messages > 0 ? (phones / messages) * 100 : 0;
                    const commission = phones * COMMISSION_PER_PHONE;

                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-center tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(parseISO(r.date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{messages}</TableCell>
                        <TableCell className="text-center font-bold tabular-nums text-indigo-600">{phones}</TableCell>
                        <TableCell className="text-center tabular-nums text-amber-600 font-medium">{rate.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">{formatVND(commission)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.note}>{r.note || '-'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default KpiPagePersonalModule;
