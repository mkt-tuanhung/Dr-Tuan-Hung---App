
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target } from 'lucide-react';
import { parseISO } from 'date-fns';
import KPIAdminPageStatsCard from './KPIAdminPageStatsCard.jsx';
import KPIAdminPageTargetForm from './KPIAdminPageTargetForm.jsx';
import KPIAdminPageTable from './KPIAdminPageTable.jsx';
import KPIDetailModal from './KPIDetailModal.jsx';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const TABS = ['Tổng quan', 'Trực page', 'Telesale', 'Sale Offline', 'Marketing', 'CSKH', 'Media', 'Điều dưỡng'];

const KPIAdminPageModule = () => {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [activeTab, setActiveTab] = useState('Trực page');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');

  const [employees, setEmployees] = useState([]);
  const [overallStats, setOverallStats] = useState({});
  const [employeeSummaries, setEmployeeSummaries] = useState([]);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailEmp, setSelectedDetailEmp] = useState(null);
  const [detailRecords, setDetailRecords] = useState([]);

  const loadData = () => {
    const allUsers = getStorageItem('clinic_users', []);
    const trucPageEmps = allUsers.filter(u => u.role === 'Nhân viên' && u.departmentPosition?.toLowerCase().trim() === 'trực page');
    setEmployees(trucPageEmps);

    const allRecords = getStorageItem('pageDailyReports', []);
    const allTargets = getStorageItem('kpiTargets', []);

    const summaries = trucPageEmps
      .filter(e => selectedEmployeeFilter === 'all' || e.id === selectedEmployeeFilter)
      .map(emp => {
        const empRecords = allRecords.filter(r => {
          const d = parseISO(r.date);
          return r.employeeId === emp.id && (d.getMonth() + 1) === month && d.getFullYear() === year;
        });

        const target = allTargets.find(t => t.employeeId === emp.id && t.month === month && t.year === year) || { targetPhones: 0, targetConversionRate: 0 };

        let totalMessages = 0;
        let totalPhones = 0;

        empRecords.forEach(r => {
          totalMessages += (Number(r.totalMessages) || 0);
          totalPhones += (Number(r.totalPhones) || 0);
        });

        const conversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
        const commissionAmount = totalPhones * 20000;
        const kpiCompletion = target.targetPhones > 0 ? (totalPhones / target.targetPhones) * 100 : 0;

        return {
          employee: emp,
          totalMessages,
          totalPhones,
          conversionRate,
          commissionAmount,
          targetPhones: target.targetPhones,
          targetConversionRate: target.targetConversionRate,
          kpiCompletion
        };
      });

    setEmployeeSummaries(summaries);

    let totalMessages = 0;
    let totalPhones = 0;
    let totalCommission = 0;
    let totalTargetPhones = 0;

    summaries.forEach(s => {
      totalMessages += s.totalMessages;
      totalPhones += s.totalPhones;
      totalCommission += s.commissionAmount;
      totalTargetPhones += s.targetPhones;
    });

    const averageConversionRate = totalMessages > 0 ? (totalPhones / totalMessages) * 100 : 0;
    const overallKpiCompletion = totalTargetPhones > 0 ? (totalPhones / totalTargetPhones) * 100 : 0;

    setOverallStats({
      totalEmployees: summaries.length,
      totalMessages,
      totalPhones,
      totalCommission,
      totalTargetPhones,
      averageConversionRate,
      overallKpiCompletion
    });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, selectedEmployeeFilter]);

  const openDetails = (emp) => {
    setSelectedDetailEmp(emp);
    const allRecords = getStorageItem('pageDailyReports', []);
    const empRecords = allRecords.filter(r => {
      const d = parseISO(r.date);
      return r.employeeId === emp.id && (d.getMonth() + 1) === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
    setDetailRecords(empRecords);
    setDetailModalOpen(true);
  };

  const handleEditDetailRecord = (recordId, updatedData) => {
    const allRecords = getStorageItem('pageDailyReports', []);
    const index = allRecords.findIndex(r => r.id === recordId);
    if (index !== -1) {
      allRecords[index] = { ...allRecords[index], ...updatedData, updatedAt: new Date().toISOString() };
      setStorageItem('pageDailyReports', allRecords);
      loadData();
      openDetails(selectedDetailEmp); // refresh details
    }
  };

  const handleDeleteDetailRecord = (recordId) => {
    const allRecords = getStorageItem('pageDailyReports', []);
    const filtered = allRecords.filter(r => r.id !== recordId);
    setStorageItem('pageDailyReports', filtered);
    loadData();
    openDetails(selectedDetailEmp); // refresh details
  };

  const handleEditKPI = (summary) => {
    // This would ideally populate the form, but for simplicity we'll just scroll to it
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">KPI - Hoa hồng</h1>
        <p className="text-muted-foreground mt-1">Hệ thống phân bổ chỉ tiêu và đo lường hiệu suất các bộ phận</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border shadow-sm p-1 rounded-xl h-auto mb-6 flex flex-wrap justify-start">
          {TABS.map(tab => (
            <TabsTrigger key={tab} value={tab} className="py-2.5 px-4 rounded-lg font-medium">{tab}</TabsTrigger>
          ))}
        </TabsList>

        {activeTab === 'Trực page' && (
          <TabsContent value="Trực page" className="m-0 space-y-6">
            <Card className="shadow-sm border-border bg-card">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-32">
                    <Label className="text-xs mb-1 block text-muted-foreground">Tháng</Label>
                    <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 12}, (_,i) => i+1).map(m => <SelectItem key={m} value={m.toString()}>Tháng {m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Label className="text-xs mb-1 block text-muted-foreground">Năm</Label>
                    <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[year-1, year, year+1].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-56">
                    <Label className="text-xs mb-1 block text-muted-foreground">Lọc theo nhân sự</Label>
                    <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                      <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả nhân sự</SelectItem>
                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <KPIAdminPageStatsCard stats={overallStats} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <KPIAdminPageTargetForm employees={employees} month={month} year={year} onSaveSuccess={loadData} />
              <KPIAdminPageTable summaries={employeeSummaries} onOpenDetails={openDetails} onEditKPI={handleEditKPI} />
            </div>
          </TabsContent>
        )}

        {activeTab !== 'Trực page' && (
          <TabsContent value={activeTab} className="m-0">
            <div className="flex flex-col items-center justify-center h-64 bg-card border rounded-xl border-dashed">
              <Target className="w-12 h-12 text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Module {activeTab}</h3>
              <p className="text-muted-foreground mt-1">Module này sẽ được xây dựng ở bước sau.</p>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {detailModalOpen && (
        <KPIDetailModal 
          isOpen={detailModalOpen}
          onClose={() => { setDetailModalOpen(false); setSelectedDetailEmp(null); }}
          employee={selectedDetailEmp}
          month={month}
          year={year}
          records={detailRecords}
          onEditRecord={handleEditDetailRecord}
          onDeleteRecord={handleDeleteDetailRecord}
        />
      )}
    </div>
  );
};

export default KPIAdminPageModule;
