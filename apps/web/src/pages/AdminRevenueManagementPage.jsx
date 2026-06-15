
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Helmet } from 'react-helmet';
import RevenueForm from '@/components/RevenueForm.jsx';
import RevenueRecordTable from '@/components/RevenueRecordTable.jsx';
import RevenueFilterBar from '@/components/RevenueFilterBar.jsx';
import RevenueStatsCards from '@/components/RevenueStatsCards.jsx';
import RevenueCharts from '@/components/RevenueCharts.jsx';
import { getRevenueRecords } from '@/utils/userStorage.js';
import { syncRevenueRecordsWithSupabase } from '@/services/dataService.js';
import { Banknote, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { isTelesale, isSaleOffline } from '@/utils/permissionHelper.js';

const AdminRevenueManagementPage = ({ isNested = false }) => {
  const { user: currentUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [editRevRecord, setEditRevRecord] = useState(null);
  const [rawRecords, setRawRecords] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const role = String(currentUser?.role || '');
  const isUserTelesale = isTelesale(currentUser);
  const isUserSaleOffline = isSaleOffline(currentUser);
  const isRestrictedStaff = role !== 'Admin' && (isUserTelesale || isUserSaleOffline);

  const [filters, setFilters] = useState({
    monthYear: '',
    dateFrom: '',
    dateTo: '',
    saleOfflineId: 'all',
    telesaleId: 'all',
    serviceGroup: 'all',
    customerSource: 'all',
    customerFileType: 'all',
    search: ''
  });

  const loadData = useCallback(() => {
    setRawRecords(getRevenueRecords());
  }, []);

  useEffect(() => {
    const initSync = async () => {
      setIsSyncing(true);
      await syncRevenueRecordsWithSupabase();
      loadData();
      setIsSyncing(false);
    };
    initSync();
  }, [loadData]);

  useEffect(() => {
    window.addEventListener('supabase-data-updated', loadData);
    return () => {
      window.removeEventListener('supabase-data-updated', loadData);
    };
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [refreshKey, loadData]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const filteredRecords = useMemo(() => {
    let baseRecords = rawRecords;

    if (isRestrictedStaff) {
      const ids = [currentUser?.employeeId, currentUser?.id].filter(Boolean).map(String);
      baseRecords = baseRecords.filter(r => {
        let allow = false;
        if (isUserTelesale && ids.includes(String(r.telesaleEmployeeId))) allow = true;
        if (isUserSaleOffline && ids.includes(String(r.saleOfflineEmployeeId))) allow = true;
        return allow;
      });
    }

    return baseRecords.filter(record => {
      if (filters.monthYear && record.month !== filters.monthYear) return false;
      if (filters.dateFrom && record.revenueDate < filters.dateFrom) return false;
      if (filters.dateTo && record.revenueDate > filters.dateTo) return false;

      if (filters.telesaleId !== 'all' && record.telesaleEmployeeId !== filters.telesaleId) return false;
      if (filters.saleOfflineId !== 'all' && record.saleOfflineEmployeeId !== filters.saleOfflineId) return false;

      if (filters.serviceGroup !== 'all' && record.serviceGroup !== filters.serviceGroup) return false;
      if (filters.customerSource !== 'all' && record.customerSource !== filters.customerSource) return false;
      if (filters.customerFileType !== 'all' && record.customerFileType !== filters.customerFileType) return false;

      if (filters.search) {
        const query = filters.search.toLowerCase();
        const nameMatch = (record.customerName || '').toLowerCase().includes(query);
        const phoneMatch = (record.customerPhone || '').includes(query);
        if (!nameMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [rawRecords, filters, isRestrictedStaff, isUserTelesale, isUserSaleOffline, currentUser]);

  const handleEditRequest = (record) => {
    if (isRestrictedStaff) {
      toast.error('Bạn chỉ có quyền xem doanh thu.');
      return;
    }
    setEditRevRecord(record);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  if (role === 'Nhân viên' && !isUserTelesale && !isUserSaleOffline) {
    return (
      <div className={`flex items-center justify-center bg-muted/20 ${isNested ? 'h-full' : 'min-h-screen'}`}>
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-red-100 max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-bold text-lg">Bạn không có quyền truy cập.</p>
        </div>
      </div>
    );
  }

  const content = (
    <main className="flex-1 container max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-8 h-full">
      <div className="mb-8 border-b border-border pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Banknote className="w-8 h-8 text-emerald-600" />
            Quản lý doanh thu
            {isSyncing && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Quản lý và thống kê chi tiết toàn bộ doanh thu, nguồn khách, và hiệu suất nhân sự
          </p>
        </div>
      </div>

      {isRestrictedStaff && (
        <div className="bg-blue-50 text-blue-700 p-4 rounded-xl flex items-center gap-3 border border-blue-200 text-sm font-medium animate-in fade-in duration-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Chế độ xem: Chỉ hiển thị doanh thu khách hàng được gán cho bạn.
        </div>
      )}

      <RevenueFilterBar filters={filters} setFilters={setFilters} />
      
      <RevenueStatsCards data={filteredRecords} />
      
      <RevenueCharts data={filteredRecords} />

      <div className="border-t border-border my-12"></div>

      <div className="space-y-8 flex flex-col w-full">
        {!isRestrictedStaff && (
          <RevenueForm 
            editRecord={editRevRecord} 
            onSave={() => { setEditRevRecord(null); refresh(); }}
            onCancel={() => setEditRevRecord(null)}
          />
        )}
        
        <div className={isRestrictedStaff ? "pointer-events-auto [&_td:last-child]:hidden [&_th:last-child]:hidden" : ""}>
          <RevenueRecordTable 
            records={filteredRecords} 
            onEdit={handleEditRequest} 
            onRefresh={refresh}
            readOnly={isRestrictedStaff}
          />
        </div>
      </div>
    </main>
  );

  if (isNested) {
    return <div className="h-full bg-muted/20 flex flex-col">{content}</div>;
  }

  return (
    <>
      <Helmet>
        <title>Quản lý Doanh thu - Dr Tuấn Hùng</title>
      </Helmet>
      <div className="min-h-screen flex flex-col bg-muted/20">
        <Header />
        {content}
        <Footer />
      </div>
    </>
  );
};

export default AdminRevenueManagementPage;
