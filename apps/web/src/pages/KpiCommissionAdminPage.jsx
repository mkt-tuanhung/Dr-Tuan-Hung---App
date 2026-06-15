
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { mergeSurgicalAssignmentsWithSupabase } from '@/utils/surgicalCareAssignments.js';
import { mergePagePhoneAssignmentsWithSupabase } from '@/utils/userStorage.js';

import KpiOverallAdminDashboard from '@/components/KpiOverallAdminDashboard.jsx';
import KpiPageAdminModule from '@/components/KpiPageAdminModule.jsx';
import KpiTelesaleAdminModule from '@/components/KpiTelesaleAdminModule.jsx';
import KpiTelesaleAdminProgressModule from '@/components/KpiTelesaleAdminProgressModule.jsx';
import KpiSaleOfflineAdminModule from '@/components/KpiSaleOfflineAdminModule.jsx';
import KpiSaleOfflineAdminProgressModule from '@/components/KpiSaleOfflineAdminProgressModule.jsx';
import MediaKpiAdminClean from '@/components/MediaKpiAdminClean.jsx';
import KpiMediaAdminProgressModule from '@/components/KpiMediaAdminProgressModule.jsx';
import CskhKpiAdminClean from '@/components/CskhKpiAdminClean.jsx';
import KpiCskhAdminProgressModule from '@/components/KpiCskhAdminProgressModule.jsx';
import MarketingKpiAdminClean from '@/components/MarketingKpiAdminClean.jsx';
import KpiMarketingAdminProgressModule from '@/components/KpiMarketingAdminProgressModule.jsx';
import NursingKpiAdminClean from '@/components/NursingKpiAdminClean.jsx';
import KpiNursingAdminProgressModule from '@/components/KpiNursingAdminProgressModule.jsx';

const TABS = ['Tổng quan', 'Trực page', 'Telesale', 'Sale Offline', 'Marketing', 'CSKH', 'Media', 'Điều dưỡng'];

const KpiCommissionAdminPage = () => {
  const [activeTab, setActiveTab] = useState('Tổng quan');
  const [isSyncing, setIsSyncing] = useState(true);
  
  const [globalMonth, setGlobalMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const initSync = async () => {
      try {
        await Promise.all([
          mergeSurgicalAssignmentsWithSupabase(),
          mergePagePhoneAssignmentsWithSupabase()
        ]);
      } catch (error) {
        toast.warning('Hoạt động ngoại tuyến. Dữ liệu chưa được đồng bộ mới nhất.');
      } finally {
        setIsSyncing(false);
      }
    };
    initSync();
  }, []);

  const renderContent = () => {
    if (isSyncing) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-card rounded-2xl border border-dashed border-border mt-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50 mb-4" />
          <p className="text-muted-foreground font-medium">Đang tải dữ liệu và đồng bộ...</p>
        </div>
      );
    }

    if (activeTab === 'Tổng quan') return <KpiOverallAdminDashboard selectedMonth={globalMonth} />;
    
    if (activeTab === 'Trực page') return <KpiPageAdminModule />;
    
    if (activeTab === 'Telesale') return (
      <Tabs defaultValue="assign" className="w-full animate-in fade-in duration-300">
        <TabsList className="mb-6 bg-muted/50 border border-border shadow-sm p-1 rounded-xl h-auto flex flex-wrap justify-start gap-1">
          <TabsTrigger value="assign" className="py-2 px-4 rounded-lg font-medium transition-all duration-200">Giao KPI & Danh sách</TabsTrigger>
          <TabsTrigger value="progress" className="py-2 px-4 rounded-lg font-medium transition-all duration-200 text-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">Theo dõi Tiến độ</TabsTrigger>
        </TabsList>
        <TabsContent value="assign" className="mt-0"><KpiTelesaleAdminModule /></TabsContent>
        <TabsContent value="progress" className="mt-0"><KpiTelesaleAdminProgressModule /></TabsContent>
      </Tabs>
    );

    if (activeTab === 'Sale Offline') return (
      <Tabs defaultValue="assign" className="w-full animate-in fade-in duration-300">
        <TabsList className="mb-6 bg-muted/50 border border-border shadow-sm p-1 rounded-xl h-auto flex flex-wrap justify-start gap-1">
          <TabsTrigger value="assign" className="py-2 px-4 rounded-lg font-medium transition-all duration-200">Giao KPI & Danh sách</TabsTrigger>
          <TabsTrigger value="progress" className="py-2 px-4 rounded-lg font-medium transition-all duration-200 text-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">Theo dõi Tiến độ</TabsTrigger>
        </TabsList>
        <TabsContent value="assign" className="mt-0"><KpiSaleOfflineAdminModule /></TabsContent>
        <TabsContent value="progress" className="mt-0"><KpiSaleOfflineAdminProgressModule /></TabsContent>
      </Tabs>
    );

    if (activeTab === 'Marketing') return (
      <Tabs defaultValue="progress" className="w-full animate-in fade-in duration-300">
        <TabsList className="mb-6 bg-muted/50 border border-border shadow-sm p-1 rounded-xl h-auto flex flex-wrap justify-start gap-1">
          <TabsTrigger value="progress" className="py-2 px-4 rounded-lg font-medium transition-all duration-200 text-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">Theo dõi Tiến độ</TabsTrigger>
          <TabsTrigger value="assign" className="py-2 px-4 rounded-lg font-medium transition-all duration-200">Giao KPI & Danh sách</TabsTrigger>
        </TabsList>
        <TabsContent value="progress" className="mt-0"><KpiMarketingAdminProgressModule selectedMonth={globalMonth} /></TabsContent>
        <TabsContent value="assign" className="mt-0"><MarketingKpiAdminClean selectedMonth={globalMonth} /></TabsContent>
      </Tabs>
    );

    if (activeTab === 'CSKH') return (
      <Tabs defaultValue="progress" className="w-full animate-in fade-in duration-300">
        <TabsList className="mb-6 bg-muted/50 border border-border shadow-sm p-1 rounded-xl h-auto flex flex-wrap justify-start gap-1">
          <TabsTrigger value="progress" className="py-2 px-4 rounded-lg font-medium transition-all duration-200 text-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">Theo dõi Tiến độ</TabsTrigger>
          <TabsTrigger value="assign" className="py-2 px-4 rounded-lg font-medium transition-all duration-200">Giao KPI & Danh sách</TabsTrigger>
        </TabsList>
        <TabsContent value="progress" className="mt-0"><KpiCskhAdminProgressModule selectedMonth={globalMonth} /></TabsContent>
        <TabsContent value="assign" className="mt-0"><CskhKpiAdminClean selectedMonth={globalMonth} /></TabsContent>
      </Tabs>
    );

    if (activeTab === 'Media') return (
      <Tabs defaultValue="progress" className="w-full animate-in fade-in duration-300">
        <TabsList className="mb-6 bg-muted/50 border border-border shadow-sm p-1 rounded-xl h-auto flex flex-wrap justify-start gap-1">
          <TabsTrigger value="progress" className="py-2 px-4 rounded-lg font-medium transition-all duration-200 text-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">Theo dõi Tiến độ</TabsTrigger>
          <TabsTrigger value="assign" className="py-2 px-4 rounded-lg font-medium transition-all duration-200">Giao KPI & Danh sách</TabsTrigger>
        </TabsList>
        <TabsContent value="progress" className="mt-0"><KpiMediaAdminProgressModule selectedMonth={globalMonth} /></TabsContent>
        <TabsContent value="assign" className="mt-0"><MediaKpiAdminClean selectedMonth={globalMonth} /></TabsContent>
      </Tabs>
    );

    if (activeTab === 'Điều dưỡng') return (
      <Tabs defaultValue="progress" className="w-full animate-in fade-in duration-300">
        <TabsList className="mb-6 bg-muted/50 border border-border shadow-sm p-1 rounded-xl h-auto flex flex-wrap justify-start gap-1">
          <TabsTrigger value="progress" className="py-2 px-4 rounded-lg font-medium transition-all duration-200 text-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">Theo dõi Tiến độ</TabsTrigger>
          <TabsTrigger value="assign" className="py-2 px-4 rounded-lg font-medium transition-all duration-200">Giao KPI & Danh sách</TabsTrigger>
        </TabsList>
        <TabsContent value="progress" className="mt-0"><KpiNursingAdminProgressModule selectedMonth={globalMonth} /></TabsContent>
        <TabsContent value="assign" className="mt-0"><NursingKpiAdminClean selectedMonth={globalMonth} /></TabsContent>
      </Tabs>
    );

    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card border rounded-xl border-dashed">
        <Target className="w-12 h-12 text-muted-foreground opacity-30 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Module {activeTab}</h3>
        <p className="text-muted-foreground mt-1">Module này đang được xây dựng hoặc cập nhật.</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">KPI - Hoa hồng</h1>
          <p className="text-muted-foreground mt-1">Hệ thống phân bổ chỉ tiêu và đo lường hiệu suất các bộ phận</p>
        </div>
        {['Tổng quan', 'Marketing', 'CSKH', 'Media', 'Điều dưỡng'].includes(activeTab) && (
          <div className="w-[180px] animate-in fade-in duration-300">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tháng theo dõi</label>
            <Input type="month" value={globalMonth} onChange={(e) => setGlobalMonth(e.target.value)} />
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border shadow-sm p-1 rounded-xl h-auto mb-6 flex flex-wrap justify-start gap-1">
          {TABS.map(tab => (
            <TabsTrigger 
              key={tab} 
              value={tab} 
              className="py-2 px-4 rounded-lg font-medium transition-all duration-200"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          {renderContent()}
        </div>
      </Tabs>
    </div>
  );
};

export default KpiCommissionAdminPage;
