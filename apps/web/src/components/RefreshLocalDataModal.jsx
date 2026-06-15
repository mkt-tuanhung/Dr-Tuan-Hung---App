
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services/supabaseClient.js';
import { 
  refreshRevenueRecordsFromSupabase, 
  getKpiTargetsFromSupabase, 
  getPageDailyReportsFromSupabase, 
  refreshExpenseClaimsFromSupabase,
  refreshApprovalNotificationsFromSupabase 
} from '@/services/dataService.js';
import { mergeSurgicalAssignmentsWithSupabase } from '@/utils/surgicalCareAssignments.js';
import { mergePagePhoneAssignmentsWithSupabase } from '@/utils/userStorage.js';

const RefreshLocalDataModal = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefreshAll = async () => {
    setIsLoading(true);
    try {
      const [usersRes, recRes, reqRes, apptRes, revRes] = await Promise.all([
        supabase.from('clinic_users').select('*').is('deleted_at', null),
        supabase.from('attendance_records').select('*').is('deleted_at', null),
        supabase.from('attendance_requests').select('*').is('deleted_at', null),
        supabase.from('customer_appointments').select('*').is('deleted_at', null),
        supabase.from('revenue_records').select('*').is('deleted_at', null)
      ]);

      if (usersRes.error) throw usersRes.error;
      if (recRes.error) throw recRes.error;
      if (reqRes.error) throw reqRes.error;
      if (apptRes.error) throw apptRes.error;
      if (revRes.error) throw revRes.error;

      const localUsers = usersRes.data.map(row => row.data);
      const localAttRecords = recRes.data.map(row => row.data);
      const localAttRequests = reqRes.data.map(row => row.data);
      const localAppointments = apptRes.data.map(row => row.data);
      const localRevenues = revRes.data.map(row => row.data);

      localStorage.setItem('clinic_users', JSON.stringify(localUsers));
      localStorage.setItem('attendanceRecords', JSON.stringify(localAttRecords));
      localStorage.setItem('attendanceRequests', JSON.stringify(localAttRequests));
      localStorage.setItem('customerAppointments', JSON.stringify(localAppointments));
      localStorage.setItem('revenueRecords', JSON.stringify(localRevenues));

      // Refresh KPI & Others
      await getKpiTargetsFromSupabase();
      await getPageDailyReportsFromSupabase();
      await refreshExpenseClaimsFromSupabase();
      
      // Refresh Notifications
      localStorage.removeItem('approvalNotifications');
      await refreshApprovalNotificationsFromSupabase();
      
      // Refresh Assignments
      await mergeSurgicalAssignmentsWithSupabase();
      await mergePagePhoneAssignmentsWithSupabase();

      toast.success('Đã làm mới toàn bộ dữ liệu từ Supabase');
      onClose();
      
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (error) {
      console.error('Lỗi khi tải lại dữ liệu từ Supabase:', error);
      toast.error('Có lỗi xảy ra khi tải dữ liệu từ Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshRevenueOnly = async () => {
    setIsLoading(true);
    const success = await refreshRevenueRecordsFromSupabase();
    if (success) {
      onClose();
      window.dispatchEvent(new Event('supabase-data-updated'));
    }
    setIsLoading(false);
  };

  const handleRefreshKPI = async () => {
    setIsLoading(true);
    try {
      localStorage.removeItem('kpiTargets');
      localStorage.removeItem('pageDailyReports');
      
      await getKpiTargetsFromSupabase();
      await getPageDailyReportsFromSupabase();
      
      toast.success('Dữ liệu KPI đã được làm mới từ Supabase');
      onClose();
      window.dispatchEvent(new Event('supabase-data-updated'));
    } catch (error) {
      console.error('Refresh KPI error:', error);
      toast.error('Có lỗi khi làm mới KPI');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshAssignments = async () => {
    setIsLoading(true);
    try {
      toast.loading('Đang tải dữ liệu phân công...', { id: 'sync-assignments' });
      await mergeSurgicalAssignmentsWithSupabase();
      await mergePagePhoneAssignmentsWithSupabase();
      toast.success('Đã làm mới dữ liệu Phân công', { id: 'sync-assignments' });
      onClose();
      window.dispatchEvent(new Event('supabase-data-updated'));
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu phân công', { id: 'sync-assignments' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" /> Làm mới dữ liệu
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-relaxed">
            Thao tác này chỉ xóa dữ liệu local trên thiết bị hiện tại và tải lại từ Supabase. <strong className="text-foreground">Không xóa dữ liệu Supabase.</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
           <Button onClick={handleRefreshRevenueOnly} disabled={isLoading} variant="outline" className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Chỉ làm mới Doanh thu
          </Button>
          <Button onClick={handleRefreshKPI} disabled={isLoading} variant="outline" className="w-full text-purple-700 border-purple-200 hover:bg-purple-50">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Chỉ làm mới KPI & Báo cáo
          </Button>
          <Button onClick={handleRefreshAssignments} disabled={isLoading} variant="outline" className="w-full text-blue-700 border-blue-200 hover:bg-blue-50">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Chỉ làm mới Phân công ca & Chia số
          </Button>
          <Button onClick={handleRefreshAll} disabled={isLoading} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Làm mới Toàn bộ dữ liệu
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto">
            Hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefreshLocalDataModal;
