
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseISO } from 'date-fns';
import KPIPageStatsCard from './KPIPageStatsCard.jsx';
import KPIPageDailyReportForm from './KPIPageDailyReportForm.jsx';
import KPIPageDailyReportTable from './KPIPageDailyReportTable.jsx';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const KPIPersonalPageModule = ({ employeeId }) => {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    totalMessages: 0, totalPhones: 0, conversionRate: 0, commissionAmount: 0, targetPhones: 0, kpiCompletion: 0
  });

  const loadData = () => {
    const allRecords = getStorageItem('pageDailyReports', []);
    const monthRecords = allRecords.filter(r => {
      const d = parseISO(r.date);
      return r.employeeId === employeeId && (d.getMonth() + 1) === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    setRecords(monthRecords);

    const targets = getStorageItem('kpiTargets', []);
    const target = targets.find(t => t.employeeId === employeeId && t.month === month && t.year === year) || { targetPhones: 0 };

    let totalMessages = 0;
    let totalPhones = 0;

    monthRecords.forEach(r => {
      totalMessages += (Number(r.totalMessages) || 0);
      totalPhones += (Number(r.totalPhones) || 0);
    });

    const conversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
    const commissionAmount = totalPhones * 20000;
    const kpiCompletion = target.targetPhones > 0 ? (totalPhones / target.targetPhones) * 100 : 0;

    setStats({
      totalMessages,
      totalPhones,
      conversionRate,
      commissionAmount,
      targetPhones: target.targetPhones,
      kpiCompletion
    });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, month, year]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hiệu suất Trực page</h1>
          <p className="text-muted-foreground mt-1">Theo dõi báo cáo và hoa hồng cá nhân hàng ngày</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[120px] bg-card"><SelectValue placeholder="Tháng" /></SelectTrigger>
            <SelectContent>
              {Array.from({length: 12}, (_,i) => i+1).map(m => <SelectItem key={m} value={m.toString()}>Tháng {m}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-card"><SelectValue placeholder="Năm" /></SelectTrigger>
            <SelectContent>
              {[year-1, year, year+1].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <KPIPageStatsCard stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <KPIPageDailyReportForm employeeId={employeeId} onSaveSuccess={loadData} />
        <KPIPageDailyReportTable records={records} month={month} onDataChange={loadData} />
      </div>
    </div>
  );
};

export default KPIPersonalPageModule;
