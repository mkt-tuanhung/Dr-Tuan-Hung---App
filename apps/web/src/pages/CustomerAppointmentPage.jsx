
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import AppointmentFilterBar from '@/components/AppointmentFilterBar.jsx';
import AppointmentStatsCards from '@/components/AppointmentStatsCards.jsx';
import AppointmentCharts from '@/components/AppointmentCharts.jsx';
import AppointmentForm from '@/components/AppointmentForm.jsx';
import AppointmentListByDay from '@/components/AppointmentListByDay.jsx';
import AppointmentEvaluationModal from '@/components/AppointmentEvaluationModal.jsx';
import AppointmentEditModal from '@/components/AppointmentEditModal.jsx';
import { 
  getAppointments, 
  syncAppointmentsWithSupabase, 
  uploadAllAppointmentsToSupabase 
} from '@/utils/appointmentStorage.js';
import { mergeSurgicalAssignmentsWithSupabase } from '@/utils/surgicalCareAssignments.js';
import { mergePagePhoneAssignmentsWithSupabase } from '@/utils/userStorage.js';
import { CalendarDays, Plus, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { canManageAppointment } from '@/utils/permissionHelper.js';
import { toast } from 'sonner';

const CustomerAppointmentPage = ({ hideLayout = false }) => {
  const { user } = useAuth();
  const [rawAppointments, setRawAppointments] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  
  const [filters, setFilters] = useState({
    date: '',
    month: new Date().toISOString().slice(0, 7),
    status: 'all',
    telesaleId: 'all',
    saleOfflineId: 'all',
    search: ''
  });

  const [evalModal, setEvalModal] = useState({ isOpen: false, appointment: null });
  const [editModal, setEditModal] = useState({ isOpen: false, appointment: null });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const authorizedToManage = canManageAppointment(user);

  useEffect(() => {
    const initSync = async () => {
      setIsSyncing(true);
      try {
        await Promise.all([
          syncAppointmentsWithSupabase(),
          mergeSurgicalAssignmentsWithSupabase(),
          mergePagePhoneAssignmentsWithSupabase()
        ]);
        setRawAppointments(getAppointments());
      } catch (error) {
        toast.warning('Hoạt động ngoại tuyến. Dữ liệu chưa được đồng bộ mới nhất.');
        setRawAppointments(getAppointments());
      } finally {
        setIsSyncing(false);
      }
    };
    initSync();
  }, []);

  const refresh = useCallback(() => {
    setRawAppointments(getAppointments());
  }, []);

  useEffect(() => {
    window.addEventListener('supabase-data-updated', refresh);
    return () => {
      window.removeEventListener('supabase-data-updated', refresh);
    };
  }, [refresh]);

  const filteredAppointments = useMemo(() => {
    return rawAppointments.filter(app => {
      if (filters.date && app.appointmentDate !== filters.date) return false;
      if (filters.month && !filters.date && (!app.appointmentDate || !app.appointmentDate.startsWith(filters.month))) return false;
      if (filters.status !== 'all' && app.status !== filters.status) return false;
      if (filters.telesaleId !== 'all' && app.telesaleEmployeeId !== filters.telesaleId) return false;
      if (filters.saleOfflineId !== 'all' && app.saleOfflineEmployeeId !== filters.saleOfflineId) return false;
      
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const nameMatch = (app.customerName || '').toLowerCase().includes(query);
        if (!nameMatch) return false;
      }
      return true;
    });
  }, [rawAppointments, filters]);

  const handleAddClick = (e) => {
    if (!authorizedToManage) {
      e.preventDefault();
      toast.error('Bạn chỉ có quyền xem lịch hẹn.');
      return;
    }
    setIsFormOpen(true);
  };

  const handleEditClick = (app) => {
    if (!authorizedToManage) {
      toast.error('Bạn chỉ có quyền xem lịch hẹn.');
      return;
    }
    setEditModal({ isOpen: true, appointment: app });
  };

  const handleEvaluateClick = (app) => {
    if (!authorizedToManage) {
      toast.error('Bạn chỉ có quyền xem lịch hẹn.');
      return;
    }
    setEvalModal({ isOpen: true, appointment: app });
  };

  const handleBulkUpload = async () => {
    setIsBulkSyncing(true);
    const res = await uploadAllAppointmentsToSupabase();
    if (res.fail > 0) {
      toast.error(`Đồng bộ thất bại: ${res.fail} bản ghi.`);
    } else {
      toast.success(`Đã đồng bộ ${res.success} lịch hẹn lên Supabase.`);
    }
    setIsBulkSyncing(false);
  };

  const content = (
    <div className={`space-y-8 ${hideLayout ? '' : 'container max-w-[1400px] mx-auto px-4 sm:px-6 py-8 flex-1'}`}>
      <div className="mb-8 border-b border-border pb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-primary" />
            Lịch hẹn khách hàng
            {isSyncing && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Theo dõi, phân công và đánh giá trạng thái lịch hẹn từ Telesale đến Sale Offline
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {user?.role === 'Admin' && (
            <Button 
              variant="outline" 
              onClick={handleBulkUpload} 
              disabled={isBulkSyncing || isSyncing}
              className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors shadow-sm"
            >
              {(isBulkSyncing || isSyncing) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Đồng bộ Supabase
            </Button>
          )}

          {authorizedToManage && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleAddClick}>
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm lịch hẹn
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Thêm lịch hẹn mới</DialogTitle>
                </DialogHeader>
                <AppointmentForm onSuccess={() => { refresh(); setIsFormOpen(false); }} onCancel={() => setIsFormOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <AppointmentFilterBar filters={filters} setFilters={setFilters} />
      
      <AppointmentStatsCards appointments={filteredAppointments} />
      
      <AppointmentCharts appointments={filteredAppointments} />

      <div className="border-t border-border my-8"></div>

      <div className={!authorizedToManage ? "[&_td:last-child]:hidden [&_th:last-child]:hidden pointer-events-auto" : ""}>
        <AppointmentListByDay 
          appointments={filteredAppointments} 
          onEdit={handleEditClick}
          onEvaluate={handleEvaluateClick}
          onRefresh={refresh}
          canEditAppointment={() => authorizedToManage}
          canEvaluateAppointment={() => authorizedToManage}
          canDeleteAppointment={() => authorizedToManage && user?.role === 'Admin'}
        />
      </div>

      <AppointmentEvaluationModal 
        isOpen={evalModal.isOpen}
        onClose={() => setEvalModal({ isOpen: false, appointment: null })}
        appointment={evalModal.appointment}
        onSuccess={refresh}
      />

      <AppointmentEditModal 
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, appointment: null })}
        appointment={editModal.appointment}
        onSuccess={refresh}
      />
    </div>
  );

  if (hideLayout) {
    return content;
  }

  return (
    <>
      <Helmet>
        <title>Lịch hẹn khách hàng - Dr Tuấn Hùng</title>
      </Helmet>
      <div className="min-h-screen flex flex-col bg-muted/20">
        <Header />
        <main className="flex-1">
          {content}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default CustomerAppointmentPage;
