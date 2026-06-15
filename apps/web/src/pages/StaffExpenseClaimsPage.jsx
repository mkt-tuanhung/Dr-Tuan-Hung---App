
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getUsers } from '@/utils/userStorage.js';
import { 
  getClaims, 
  markTransactionAsDeleted, 
  restoreTransaction,
  clearOldTransactionData,
  getAllEmployeeSummaries, 
  calculateRemainingAmount,
  getDeletedTransactions,
  syncStaffExpenseClaimsWithSupabase,
  softDeleteExpenseClaimFromSupabase,
  saveExpenseClaimToSupabase,
  refreshExpenseClaimsFromSupabase
} from '@/utils/staffExpenseClaimsStorage.js';
import { syncNotificationStatus } from '@/utils/ApprovalNotificationHelper.js';
import { format } from 'date-fns';
import { Plus, Eye, Banknote, ArrowDownRight, ArrowUpRight, Activity, Trash2, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header.jsx';
import ExpenseClaimFilterBar from '@/components/ExpenseClaimFilterBar.jsx';
import StaffExpenseClaimForm from '@/components/StaffExpenseClaimForm.jsx';
import ExpenseClaimDetailModal from '@/components/ExpenseClaimDetailModal.jsx';
import ApproveRejectExpenseModal from '@/components/ApproveRejectExpenseModal.jsx';
import RecordReimbursementModal from '@/components/RecordReimbursementModal.jsx';
import EmployeeSummaryCard from '@/components/EmployeeSummaryCard.jsx';
import ExpenseStatsCharts from '@/components/ExpenseStatsCharts.jsx';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { toast } from 'sonner';
import { formatVND } from '@/utils/currencyFormat.js';

const STATUS_MAP = {
  pending: { label: 'Chờ duyệt', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Đã duyệt', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  partially_reimbursed: { label: 'Đã hoàn một phần', class: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  reimbursed: { label: 'Đã hoàn ứng đủ', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  paid: { label: 'Đã hoàn ứng', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Từ chối', class: 'bg-rose-100 text-rose-800 border-rose-200' }
};

const StaffExpenseClaimsPage = ({ hideLayout = false }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [claims, setClaims] = useState([]);
  const [deletedClaims, setDeletedClaims] = useState([]);
  const [filteredClaims, setFilteredClaims] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [filters, setFilters] = useState({
    month: currentMonth,
    employeeId: 'all',
    category: 'all',
    status: 'all',
    transactionType: 'all'
  });

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReimbursementOpen, setIsReimbursementOpen] = useState(false);
  const [reimbursementInitialClaimId, setReimbursementInitialClaimId] = useState('');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [modalType, setModalType] = useState(null); // 'detail', 'approveReject'
  
  // Delete state
  const [deleteDialogClaimId, setDeleteDialogClaimId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  
  // Clear old data state
  const [clearDataStep, setClearDataStep] = useState(0);

  const isAdmin = user.role === 'Admin';
  const isAccountant = user.role === 'Kế toán';
  const isStaff = user.role === 'Nhân viên';

  const loadData = () => {
    const allClaims = getClaims();
    setClaims(allClaims);
    setDeletedClaims(getDeletedTransactions());
    setUsers(getUsers());
    setSummaries(getAllEmployeeSummaries());
  };

  useEffect(() => {
    syncStaffExpenseClaimsWithSupabase().then(() => loadData());
    
    const handleSync = (e) => {
      if (!e.detail || !e.detail.table || e.detail.table === 'staff_expense_claims') {
        loadData();
      }
    };
    
    window.addEventListener('supabase-data-updated', handleSync);
    return () => window.removeEventListener('supabase-data-updated', handleSync);
  }, []);

  const handleRefreshSupabase = async () => {
    setIsRefreshing(true);
    const success = await refreshExpenseClaimsFromSupabase();
    if (success) {
      loadData();
    }
    setIsRefreshing(false);
  };

  // Compute base claims for current user view (all if Admin/Accountant, own if Staff)
  // ONLY ACTIVE CLAIMS
  const userBaseClaims = useMemo(() => {
    const activeClaims = claims.filter(c => !c.isDeleted);
    if (isStaff) {
      const currentUserIds = [user?.employeeId, user?.id].filter(Boolean).map(String);
      return activeClaims.filter(claim => currentUserIds.includes(String(claim.employeeId)));
    }
    return activeClaims;
  }, [claims, user, isStaff]);

  // Compute Stats across userBaseClaims
  const pageStats = useMemo(() => {
    let totalAdvance = 0;
    let totalReimbursement = 0;
    let remaining = 0;
    let transactionCount = 0;

    userBaseClaims.forEach(c => {
      if (c.status !== 'rejected') {
        transactionCount++;
        if (c.transactionType === 'advance_expense') {
          totalAdvance += Number(c.amount) || 0;
          remaining += calculateRemainingAmount(c.id);
        } else if (c.transactionType === 'reimbursement') {
          totalReimbursement += Number(c.amount) || 0;
        }
      }
    });

    return {
      totalAdvance,
      totalReimbursement,
      remaining: Math.max(0, remaining),
      transactionCount
    };
  }, [userBaseClaims]);

  useEffect(() => {
    let result = [...userBaseClaims];

    // Apply UI filters
    if (filters.month !== 'all') {
      result = result.filter(c => c.expenseDate && c.expenseDate.startsWith(filters.month));
    }
    if (filters.employeeId !== 'all') {
      result = result.filter(c => String(c.employeeId) === String(filters.employeeId));
    }
    if (filters.category !== 'all') {
      result = result.filter(c => c.category === filters.category);
    }
    if (filters.status !== 'all') {
      result = result.filter(c => c.status === filters.status);
    }
    if (filters.transactionType !== 'all') {
      result = result.filter(c => c.transactionType === filters.transactionType);
    }

    // Sort by date desc
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    setFilteredClaims(result);
  }, [userBaseClaims, filters]);

  const handleDelete = async (id, reason) => {
    if (markTransactionAsDeleted(id, reason, user.fullName || user.name)) {
      await softDeleteExpenseClaimFromSupabase(id);
      toast.success('Đã xóa giao dịch');
      loadData();
    } else {
      toast.error('Lỗi khi xóa giao dịch');
    }
  };

  const handleRestore = async (id) => {
    if (restoreTransaction(id, user.fullName || user.name)) {
      const restored = getClaims().find(c => c.id === id);
      if (restored) await saveExpenseClaimToSupabase(restored);
      toast.success('Đã khôi phục giao dịch');
      loadData();
    } else {
      toast.error('Lỗi khi khôi phục giao dịch');
    }
  };

  const handleClearOldData = async () => {
    if (clearOldTransactionData(user.fullName || user.name)) {
      const allDeleted = getDeletedTransactions();
      for (const c of allDeleted) {
         await softDeleteExpenseClaimFromSupabase(c.id);
      }
      toast.success('Đã dọn dữ liệu giao dịch cũ');
      setClearDataStep(0);
      loadData();
    } else {
      toast.error('Lỗi khi dọn dữ liệu');
    }
  };

  const openModal = (type, claim) => {
    setSelectedClaim(claim);
    setModalType(type);
  };

  const closeModals = () => {
    setSelectedClaim(null);
    setModalType(null);
  };

  const handleEmployeeCardClick = (summary) => {
    setFilters(prev => ({ ...prev, employeeId: summary.employeeId, month: 'all' }));
    setActiveTab('list');
    toast.info(`Đã lọc giao dịch của ${summary.employeeName}`);
  };

  const handleOpenReimbursement = (claim = null) => {
    setReimbursementInitialClaimId(claim ? claim.id : '');
    setIsReimbursementOpen(true);
  };

  const listContent = (
    <div className="space-y-4 sm:space-y-6">
      <ExpenseClaimFilterBar 
        filters={filters} 
        setFilters={setFilters} 
        users={users}
        showEmployeeFilter={isAdmin || isAccountant}
      />

      {/* Desktop Table */}
      <div className="hidden md:block bg-card border border-border shadow-sm rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold">Ngày</th>
              <th className="px-4 py-3 font-semibold">Người YC</th>
              <th className="px-4 py-3 font-semibold">Loại GD</th>
              <th className="px-4 py-3 font-semibold">Danh mục</th>
              <th className="px-4 py-3 font-semibold">Số tiền</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredClaims.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">Không có dữ liệu</td>
              </tr>
            ) : (
              filteredClaims.map(claim => {
                const statusInfo = STATUS_MAP[claim.status] || STATUS_MAP.pending;
                const isAdvance = claim.transactionType === 'advance_expense';
                return (
                  <tr key={claim.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">{format(new Date(claim.expenseDate), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-3 font-medium">{claim.employeeName}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center text-xs font-medium ${isAdvance ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isAdvance ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {isAdvance ? 'Tạm ứng chi' : 'Hoàn ứng'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{claim.category}</td>
                    <td className={`px-4 py-3 font-bold ${isAdvance ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatVND(claim.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusInfo.class}>{statusInfo.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openModal('detail', claim)}>Chi tiết</Button>
                      {(isAdmin || isAccountant) && (
                        <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setDeleteDialogClaimId(claim.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards Layout */}
      <div className="md:hidden flex flex-col gap-[var(--mobile-card-gap,12px)] mt-4">
        {filteredClaims.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border border-dashed">
            Không có dữ liệu
          </div>
        ) : (
          filteredClaims.map(claim => {
            const statusInfo = STATUS_MAP[claim.status] || STATUS_MAP.pending;
            const isAdvance = claim.transactionType === 'advance_expense';
            return (
              <div key={claim.id} className="bg-card border border-border shadow-sm rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`shrink-0 flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${isAdvance ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isAdvance ? 'Tạm ứng' : 'Hoàn ứng'}
                    </span>
                    <p className="font-semibold text-[length:var(--mobile-card-title,16px)] text-foreground truncate">
                      {claim.category}
                    </p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${statusInfo.class}`}>{statusInfo.label}</Badge>
                </div>
                
                <div className="text-[length:var(--mobile-label,13px)] text-muted-foreground flex items-center flex-wrap gap-1">
                  <span>{format(new Date(claim.expenseDate), 'dd/MM/yyyy')}</span>
                  <span>•</span>
                  <span className="truncate">{claim.employeeName}</span>
                </div>
                
                <div className={`text-[length:var(--mobile-currency,20px)] font-bold ${isAdvance ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {formatVND(claim.amount)}
                </div>
                
                <div className="flex gap-2 mt-1">
                  <Button variant="outline" className="flex-1 h-10" onClick={() => openModal('detail', claim)}>
                    Xem chi tiết <ArrowDownRight className="w-3.5 h-3.5 ml-1.5 opacity-50" />
                  </Button>
                  {(isAdmin || isAccountant) && (
                    <Button variant="outline" className="h-10 w-10 p-0 text-rose-600 border-rose-200 hover:bg-rose-50 shrink-0" onClick={() => setDeleteDialogClaimId(claim.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const trackingContent = !isStaff ? (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {summaries.map(summary => (
          <EmployeeSummaryCard key={summary.employeeId} summary={summary} onClick={handleEmployeeCardClick} />
        ))}
        {summaries.length === 0 && (
          <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed">
            Chưa có dữ liệu giao dịch
          </div>
        )}
      </div>
    </div>
  ) : null;

  const statsContent = !isStaff ? (
    <div className="space-y-4 sm:space-y-6">
      <ExpenseStatsCharts claims={userBaseClaims} summaries={summaries} />
    </div>
  ) : null;

  const deletedContent = (isAdmin || isAccountant) ? (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold">Ngày GD</th>
              <th className="px-4 py-3 font-semibold">Nhân sự</th>
              <th className="px-4 py-3 font-semibold">Loại GD</th>
              <th className="px-4 py-3 font-semibold">Danh mục</th>
              <th className="px-4 py-3 font-semibold">Số tiền</th>
              <th className="px-4 py-3 font-semibold">Người xóa</th>
              <th className="px-4 py-3 font-semibold">Ngày xóa</th>
              <th className="px-4 py-3 font-semibold">Lý do xóa</th>
              <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deletedClaims.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-muted-foreground">Không có dữ liệu đã xóa</td>
              </tr>
            ) : (
              deletedClaims.map(claim => {
                const isAdvance = claim.transactionType === 'advance_expense';
                return (
                  <tr key={claim.id} className="hover:bg-muted/30 transition-colors opacity-70">
                    <td className="px-4 py-3">{format(new Date(claim.expenseDate), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-3 font-medium line-through">{claim.employeeName}</td>
                    <td className="px-4 py-3">
                      {isAdvance ? 'Tạm ứng chi' : 'Hoàn ứng'}
                    </td>
                    <td className="px-4 py-3">{claim.category}</td>
                    <td className="px-4 py-3 font-bold">
                      {formatVND(claim.amount)}
                    </td>
                    <td className="px-4 py-3">{claim.deletedBy}</td>
                    <td className="px-4 py-3">{claim.deletedAt ? format(new Date(claim.deletedAt), 'dd/MM/yyyy HH:mm') : '-'}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate" title={claim.deleteReason}>{claim.deleteReason || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleRestore(claim.id)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Khôi phục
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!hideLayout && (
        <Helmet>
          <title>Tạm ứng chi - Dr Tuấn Hùng</title>
        </Helmet>
      )}
      
      <div className={hideLayout ? "w-full" : "min-h-screen bg-muted/30 flex flex-col pb-20 md:pb-12"}>
        {!hideLayout && <Header />}
        
        <main className={`flex-1 w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 ${hideLayout ? 'pb-6' : 'px-4 py-6 sm:p-6'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-[length:var(--mobile-title-size,24px)] sm:text-3xl font-extrabold tracking-tight text-foreground">
                Tạm ứng chi
              </h1>
              <p className="text-muted-foreground mt-1 text-[length:var(--mobile-label,13px)] sm:text-base">
                Nhân sự chi hộ công ty và gửi đề nghị kế toán hoàn tiền
              </p>
            </div>
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              <Button variant="outline" onClick={handleRefreshSupabase} disabled={isRefreshing} className="flex-1 sm:flex-none border-blue-200 text-blue-700 hover:bg-blue-50">
                {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} 
                Làm mới Supabase
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => setClearDataStep(1)} className="flex-1 sm:flex-none border-rose-200 text-rose-700 hover:bg-rose-50">
                  <Trash2 className="w-4 h-4 mr-2" /> Dọn dữ liệu cũ
                </Button>
              )}
              {(isAdmin || isAccountant) && (
                <Button variant="outline" onClick={() => handleOpenReimbursement()} className="flex-1 sm:flex-none border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <ArrowDownRight className="w-4 h-4 mr-2" /> Ghi nhận hoàn ứng
                </Button>
              )}
              <Button onClick={() => setIsFormOpen(true)} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4 mr-2" /> Tạo phiếu tạm ứng chi
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="shadow-sm border-amber-100 rounded-2xl">
              <CardContent className="p-4 flex flex-col items-start gap-1">
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm font-medium mb-1">
                  <ArrowUpRight className="w-4 h-4 mr-1 text-amber-500" /> {isStaff ? 'Tổng đã chi của tôi' : 'Tổng đã chi'}
                </div>
                <div className="text-lg sm:text-2xl font-bold text-amber-600">
                  {formatVND(pageStats.totalAdvance)}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-emerald-100 rounded-2xl">
              <CardContent className="p-4 flex flex-col items-start gap-1">
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm font-medium mb-1">
                  <ArrowDownRight className="w-4 h-4 mr-1 text-emerald-500" /> {isStaff ? 'Đã được hoàn ứng' : 'Tổng đã hoàn ứng'}
                </div>
                <div className="text-lg sm:text-2xl font-bold text-emerald-600">
                  {formatVND(pageStats.totalReimbursement)}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-rose-100 rounded-2xl">
              <CardContent className="p-4 flex flex-col items-start gap-1">
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm font-medium mb-1">
                  <Banknote className="w-4 h-4 mr-1 text-rose-500" /> Còn thiếu
                </div>
                <div className="text-lg sm:text-2xl font-bold text-rose-600">
                  {formatVND(pageStats.remaining)}
                </div>
              </CardContent>
            </Card>
            {(!isStaff) && (
              <Card className="shadow-sm rounded-2xl">
                <CardContent className="p-4 flex flex-col items-start gap-1">
                  <div className="flex items-center text-muted-foreground text-xs sm:text-sm font-medium mb-1">
                    <Activity className="w-4 h-4 mr-1 text-blue-500" /> Tổng giao dịch hợp lệ
                  </div>
                  <div className="text-lg sm:text-2xl font-bold text-foreground">
                    {pageStats.transactionCount}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {isMobile ? (
            <div className="w-full">
              <div className="flex w-full gap-1 p-1 bg-muted/50 rounded-xl mb-4 overflow-x-auto shadow-inner scrollbar-hide">
                <button
                  onClick={() => setActiveTab('list')}
                  className={`min-w-[110px] flex-1 h-11 px-2 text-center whitespace-nowrap text-[13px] font-medium rounded-lg transition-all duration-200 ${
                    activeTab === 'list'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:bg-muted-foreground/10'
                  }`}
                >
                  Danh sách phiếu
                </button>
                {!isStaff && (
                  <button
                    onClick={() => setActiveTab('tracking')}
                    className={`min-w-[110px] flex-1 h-11 px-2 text-center whitespace-nowrap text-[13px] font-medium rounded-lg transition-all duration-200 ${
                      activeTab === 'tracking'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'bg-transparent text-muted-foreground hover:bg-muted-foreground/10'
                    }`}
                  >
                    Theo dõi nhân sự
                  </button>
                )}
                {!isStaff && (
                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`min-w-[110px] flex-1 h-11 px-2 text-center whitespace-nowrap text-[13px] font-medium rounded-lg transition-all duration-200 ${
                      activeTab === 'stats'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'bg-transparent text-muted-foreground hover:bg-muted-foreground/10'
                    }`}
                  >
                    Thống kê
                  </button>
                )}
                {(isAdmin || isAccountant) && (
                  <button
                    onClick={() => setActiveTab('deleted')}
                    className={`min-w-[110px] flex-1 h-11 px-2 text-center whitespace-nowrap text-[13px] font-medium rounded-lg transition-all duration-200 ${
                      activeTab === 'deleted'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'bg-transparent text-muted-foreground hover:bg-muted-foreground/10'
                    }`}
                  >
                    Lịch sử xóa
                  </button>
                )}
              </div>
              
              <div className="pt-2">
                {activeTab === 'list' && listContent}
                {!isStaff && activeTab === 'tracking' && trackingContent}
                {!isStaff && activeTab === 'stats' && statsContent}
                {(isAdmin || isAccountant) && activeTab === 'deleted' && deletedContent}
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`flex flex-row overflow-x-auto flex-nowrap justify-start gap-0 w-full mb-6 bg-muted/50 p-1 rounded-xl scrollbar-hide ${isStaff ? '' : 'sm:max-w-2xl sm:grid sm:grid-cols-4'}`}>
                <TabsTrigger value="list" className="min-w-[110px] h-10 px-3 justify-center whitespace-nowrap rounded-lg">Danh sách phiếu</TabsTrigger>
                {!isStaff && <TabsTrigger value="tracking" className="min-w-[110px] h-10 px-3 justify-center whitespace-nowrap rounded-lg">Theo dõi nhân sự</TabsTrigger>}
                {!isStaff && <TabsTrigger value="stats" className="min-w-[110px] h-10 px-3 justify-center whitespace-nowrap rounded-lg">Thống kê</TabsTrigger>}
                {(isAdmin || isAccountant) && <TabsTrigger value="deleted" className="min-w-[110px] h-10 px-3 justify-center whitespace-nowrap rounded-lg">Lịch sử xóa</TabsTrigger>}
              </TabsList>
              <TabsContent value="list" className="mt-0">{listContent}</TabsContent>
              {!isStaff && <TabsContent value="tracking" className="mt-0">{trackingContent}</TabsContent>}
              {!isStaff && <TabsContent value="stats" className="mt-0">{statsContent}</TabsContent>}
              {(isAdmin || isAccountant) && <TabsContent value="deleted" className="mt-0">{deletedContent}</TabsContent>}
            </Tabs>
          )}

        </main>

        <StaffExpenseClaimForm 
          isOpen={isFormOpen} 
          onClose={() => setIsFormOpen(false)} 
          users={users}
          onSuccess={loadData} 
        />

        <RecordReimbursementModal
          isOpen={isReimbursementOpen}
          onClose={() => setIsReimbursementOpen(false)}
          currentUser={user}
          onSuccess={() => {
            syncNotificationStatus(reimbursementInitialClaimId, 'completed');
            loadData();
          }}
          initialClaimId={reimbursementInitialClaimId}
        />

        <ExpenseClaimDetailModal 
          isOpen={modalType === 'detail'} 
          onClose={closeModals} 
          claim={selectedClaim} 
          currentUser={user}
          onDelete={handleDelete}
          onApproveReject={(c) => openModal('approveReject', c)}
          onRecordReimbursement={(c) => {
            handleOpenReimbursement(c);
            closeModals();
          }}
        />

        <ApproveRejectExpenseModal 
          isOpen={modalType === 'approveReject'} 
          onClose={closeModals} 
          claim={selectedClaim} 
          currentUser={user}
          onSuccess={() => {
            syncNotificationStatus(selectedClaim?.id, 'completed');
            loadData();
          }}
        />

        <Dialog open={!!deleteDialogClaimId} onOpenChange={(open) => !open && setDeleteDialogClaimId(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Xóa giao dịch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800">
                <h4 className="font-semibold mb-2">Bạn chắc chắn muốn xóa giao dịch này?</h4>
                <p className="text-sm">Giao dịch sẽ không còn được tính vào thống kê.</p>
              </div>
              <div className="space-y-2">
                <Label>Lý do xóa (không bắt buộc)</Label>
                <Textarea 
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Nhập lý do xóa..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteDialogClaimId(null); setDeleteReason(''); }}>Hủy</Button>
              <Button variant="destructive" onClick={() => { handleDelete(deleteDialogClaimId, deleteReason); setDeleteDialogClaimId(null); setDeleteReason(''); }}>Xác nhận xóa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={clearDataStep > 0} onOpenChange={(open) => !open && setClearDataStep(0)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" /> Dọn dữ liệu giao dịch cũ
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {clearDataStep === 1 ? (
                <p className="text-foreground">Bạn muốn dọn dữ liệu giao dịch cũ? Hành động này sẽ chuyển tất cả giao dịch hiện tại vào lịch sử xóa.</p>
              ) : (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800">
                  <h4 className="font-bold mb-2">Xác nhận lần cuối:</h4>
                  <p className="text-sm">Tất cả giao dịch hiện tại sẽ được đánh dấu là đã xóa. Bạn không thể hoàn tác hành động này.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearDataStep(0)}>Hủy</Button>
              {clearDataStep === 1 ? (
                <Button variant="destructive" onClick={() => setClearDataStep(2)}>Tiếp tục</Button>
              ) : (
                <Button variant="destructive" onClick={handleClearOldData}>Xác nhận dọn dữ liệu</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </>
  );
};

export default StaffExpenseClaimsPage;
