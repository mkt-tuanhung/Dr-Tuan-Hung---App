
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getUsers, saveUsers } from '@/utils/userStorage.js';
import { formatVND } from '@/utils/currencyFormat.js';
import { saveRecord, softDeleteRecord, mergeClinicUsersWithSupabase } from '@/services/dataService.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { Users, UserCheck, UserMinus, UserX, Search, Plus, MoreVertical, ArrowLeft, Edit, Key, Lock, Unlock, Trash2, CheckCircle, KeyRound as UsersRound, Loader2, RefreshCw } from 'lucide-react';

import StaffFormModal from '@/components/StaffFormModal.jsx';
import ResetPasswordModal from '@/components/ResetPasswordModal.jsx';
import ConfirmActionModal from '@/components/ConfirmActionModal.jsx';
import ResponsiveStaffCard from '@/components/ResponsiveStaffCard.jsx';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storageStore.js';

const StaffManagementPage = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); 

  // Khởi tạo và đồng bộ dữ liệu khi mount
  useEffect(() => {
    const initSync = async () => {
      setIsSyncing(true);
      const mergedUsers = await mergeClinicUsersWithSupabase();
      setUsers(mergedUsers);
      setIsSyncing(false);
    };
    initSync();
  }, []);

  // Lắng nghe sự kiện realtime từ Supabase
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      setUsers(getStorageItem('clinic_users', []));
    };
    
    window.addEventListener('supabase-data-updated', handleRealtimeUpdate);
    return () => {
      window.removeEventListener('supabase-data-updated', handleRealtimeUpdate);
    };
  }, []);

  useEffect(() => {
    let result = users;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.employeeId.toLowerCase().includes(lowerSearch) ||
        u.fullName.toLowerCase().includes(lowerSearch) ||
        (u.phone && u.phone.includes(lowerSearch))
      );
    }
    if (roleFilter !== 'all') result = result.filter(u => u.role === roleFilter);
    if (deptFilter !== 'all') result = result.filter(u => u.departmentPosition === deptFilter);
    if (statusFilter !== 'all') result = result.filter(u => u.status === statusFilter);
    setFilteredUsers(result);
  }, [users, searchTerm, roleFilter, deptFilter, statusFilter]);

  const totalStaff = users.length;
  const activeStaff = users.filter(u => u.status === 'active').length;
  const probationStaff = users.filter(u => u.probationStatus === true && u.status === 'active').length;
  const inactiveStaff = users.filter(u => u.status === 'inactive').length;

  const handleEdit = (user) => { setSelectedUser(user); setIsFormModalOpen(true); };
  const handleResetPassword = (user) => { setSelectedUser(user); setIsResetPassModalOpen(true); };

  const openConfirmModal = (type, user) => {
    if (type === 'delete' && user.id === currentUser.id) {
      toast.error('Không thể xóa tài khoản đang đăng nhập.'); return;
    }
    setConfirmAction({ type, user });
    setIsConfirmModalOpen(true);
  };

  // Xử lý sau khi Modal (Thêm/Sửa/Đổi mật khẩu) lưu thành công vào LocalStorage
  const handleModalSaveSuccess = async () => {
    const newLocalUsers = getUsers();
    
    // Tìm các user vừa được thêm hoặc sửa (có updatedAt khác với state hiện tại)
    const changedUsers = newLocalUsers.filter(nlu => {
      const oldU = users.find(u => u.id === nlu.id);
      return !oldU || oldU.updatedAt !== nlu.updatedAt;
    });

    // Đồng bộ các user thay đổi lên Supabase
    for (const cu of changedUsers) {
      const res = await saveRecord('clinic_users', cu);
      if (!res) {
        toast.warning('Cảnh báo: Không đồng bộ Supabase, dữ liệu vẫn lưu trên máy');
      }
    }
    
    setUsers(newLocalUsers);
  };

  // Xử lý các hành động trực tiếp (Khóa/Mở khóa/Xóa/Kết thúc thử việc)
  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    let updatedUsers = [...users];
    let updatedUser = null;
    const recordId = String(user.employeeId || user.id);

    if (type === 'delete') {
      updatedUsers = updatedUsers.filter(u => u.id !== user.id);
      toast.success('Đã xóa nhân sự thành công');
      
      // Đồng bộ xóa lên Supabase
      const res = await softDeleteRecord('clinic_users', recordId);
      if (!res) toast.warning('Cảnh báo: Không đồng bộ Supabase, dữ liệu vẫn lưu trên máy');
      
    } else {
      if (type === 'lock') {
        updatedUser = { ...user, status: 'inactive', updatedAt: new Date().toISOString() };
        toast.success('Đã khóa tài khoản');
      } else if (type === 'unlock') {
        updatedUser = { ...user, status: 'active', updatedAt: new Date().toISOString() };
        toast.success('Đã mở khóa tài khoản');
      } else if (type === 'endProbation') {
        updatedUser = { ...user, probationStatus: false, updatedAt: new Date().toISOString() };
        toast.success('Đã kết thúc thử việc');
      }

      if (updatedUser) {
        updatedUsers = updatedUsers.map(u => u.id === user.id ? updatedUser : u);
        
        // Đồng bộ cập nhật lên Supabase
        const res = await saveRecord('clinic_users', updatedUser);
        if (!res) toast.warning('Cảnh báo: Không đồng bộ Supabase, dữ liệu vẫn lưu trên máy');
      }
    }

    saveUsers(updatedUsers);
    setUsers(updatedUsers);
    setIsConfirmModalOpen(false);
  };

  // Đồng bộ thủ công toàn bộ dữ liệu lên Supabase (Chỉ dành cho Admin)
  const handleManualSync = async () => {
    setIsSyncing(true);
    const localUsers = getUsers();
    let successCount = 0;
    let failCount = 0;

    for (const u of localUsers) {
      const res = await saveRecord('clinic_users', u);
      if (res) successCount++;
      else failCount++;
    }

    if (failCount === 0) {
      toast.success(`Đã đồng bộ ${successCount} bản ghi thành công`);
    } else {
      toast.warning(`Đã đồng bộ ${successCount} thành công, ${failCount} thất bại`);
    }
    
    setIsSyncing(false);
  };

  const getConfirmModalProps = () => {
    if (!confirmAction) return {};
    const { type } = confirmAction;
    if (type === 'delete') return { title: 'Xóa nhân sự', description: 'Bạn có chắc muốn xóa nhân sự này không?', confirmText: 'Xóa', variant: 'destructive' };
    if (type === 'lock') return { title: 'Khóa tài khoản', description: 'Bạn có chắc muốn khóa tài khoản nhân sự này không?', confirmText: 'Khóa', variant: 'destructive' };
    if (type === 'unlock') return { title: 'Mở khóa tài khoản', description: 'Bạn có chắc muốn mở khóa tài khoản nhân sự này?', confirmText: 'Mở khóa', variant: 'default' };
    if (type === 'endProbation') return { title: 'Kết thúc thử việc', description: 'Bạn có chắc muốn kết thúc thử việc cho nhân sự này không?', confirmText: 'Xác nhận', variant: 'default' };
    return {};
  };

  return (
    <>
      <Helmet><title>Quản lý nhân sự - Dr Tuấn Hùng</title></Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-30 pt-safe">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin-dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg md:text-xl font-bold">Quản lý nhân sự</h1>
            {isSyncing && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin ml-2" />}
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">Xin chào, {currentUser?.fullName}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.role}</p>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full pb-safe-nav">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
            <Card className="shadow-sm border-none bg-blue-50 text-blue-800">
              <CardContent className="p-4 md:p-6 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm font-medium uppercase tracking-wider">Tổng nhân sự</p>
                  <Users className="w-4 h-4 opacity-80" />
                </div>
                <p className="text-2xl md:text-3xl font-bold">{totalStaff}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none bg-emerald-50 text-emerald-800">
              <CardContent className="p-4 md:p-6 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm font-medium uppercase tracking-wider">Đang hoạt động</p>
                  <UserCheck className="w-4 h-4 opacity-80" />
                </div>
                <p className="text-2xl md:text-3xl font-bold">{activeStaff}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none bg-amber-50 text-amber-800">
              <CardContent className="p-4 md:p-6 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm font-medium uppercase tracking-wider">Đang thử việc</p>
                  <UserMinus className="w-4 h-4 opacity-80" />
                </div>
                <p className="text-2xl md:text-3xl font-bold">{probationStaff}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none bg-rose-50 text-rose-800">
              <CardContent className="p-4 md:p-6 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm font-medium uppercase tracking-wider">Đã khóa</p>
                  <UserX className="w-4 h-4 opacity-80" />
                </div>
                <p className="text-2xl md:text-3xl font-bold">{inactiveStaff}</p>
              </CardContent>
            </Card>
          </div>

          <div className="form-mobile bg-card p-4 rounded-xl border border-border mb-6 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Tìm kiếm ID, Tên, SĐT..." className="pl-9 h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-11 w-full md:w-40"><SelectValue placeholder="Vai trò" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vai trò</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Nhân viên">Nhân viên</SelectItem>
                  <SelectItem value="Kế toán">Kế toán</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 w-full md:w-40"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="active">Đang hoạt động</SelectItem>
                  <SelectItem value="inactive">Đã khóa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              {currentUser?.role === 'Admin' && (
                <Button 
                  onClick={handleManualSync} 
                  disabled={isSyncing}
                  variant="outline" 
                  className="h-11 flex-1 md:flex-none bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  <span className="hidden md:inline">Đồng bộ Supabase</span>
                  <span className="md:hidden">Đồng bộ</span>
                </Button>
              )}
              <Button onClick={() => { setSelectedUser(null); setIsFormModalOpen(true); }} className="h-11 flex-1 md:flex-none bg-primary">
                <Plus className="w-4 h-4 mr-2" /> Thêm nhân sự
              </Button>
            </div>
          </div>

          <div className="hidden md:flex flex-col gap-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">Không tìm thấy nhân sự nào</div>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 p-5 flex items-center justify-between transition-all duration-200 group">
                  <div className="flex items-center gap-6 flex-1">
                    <div className="w-12 h-12 rounded-full bg-[hsl(var(--mint-100))] text-[hsl(var(--mint-700))] flex items-center justify-center font-bold text-xl uppercase shrink-0">
                      {u.fullName.charAt(0)}
                    </div>
                    <div className="w-[200px]">
                      <h3 className="font-bold text-lg leading-tight truncate">{u.fullName}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{u.employeeId} • {u.phone || 'Chưa có SĐT'}</p>
                    </div>
                    <div className="w-[180px] flex flex-col items-start gap-1.5">
                      <Badge variant="outline" className="font-medium bg-secondary/20">{u.role}</Badge>
                      <span className="text-sm text-muted-foreground truncate w-full">{u.departmentPosition || 'Chưa cập nhật vị trí'}</span>
                    </div>
                    <div className="w-[180px] flex flex-col items-start gap-1 text-sm">
                      <div className="flex justify-between w-full">
                        <span className="text-muted-foreground">LCB:</span>
                        <span className="font-medium">{formatVND(u.baseSalary)}</span>
                      </div>
                      <div className="flex justify-between w-full">
                        <span className="text-muted-foreground">PC:</span>
                        <span className="font-medium">{formatVND(u.allowance)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-1 pr-6">
                      {u.status === 'active' ? <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-none border-none">Đang hoạt động</Badge> : <Badge variant="destructive" className="font-semibold shadow-none border-none">Đã khóa</Badge>}
                      {u.status === 'active' && (
                        u.probationStatus ? <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Thử việc</span> : <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Chính thức</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleEdit(u)} className="py-2.5"><Edit className="mr-2 h-4 w-4" /> Sửa thông tin</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(u)} className="py-2.5"><Key className="mr-2 h-4 w-4" /> Đổi mật khẩu</DropdownMenuItem>
                        {u.probationStatus && <DropdownMenuItem onClick={() => openConfirmModal('endProbation', u)} className="py-2.5"><CheckCircle className="mr-2 h-4 w-4" /> Kết thúc thử việc</DropdownMenuItem>}
                        {u.status === 'active' ? <DropdownMenuItem onClick={() => openConfirmModal('lock', u)} className="text-amber-600 py-2.5"><Lock className="mr-2 h-4 w-4" /> Khóa tài khoản</DropdownMenuItem> : <DropdownMenuItem onClick={() => openConfirmModal('unlock', u)} className="text-emerald-600 py-2.5"><Unlock className="mr-2 h-4 w-4" /> Mở khóa tài khoản</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => openConfirmModal('delete', u)} className="text-destructive py-2.5"><Trash2 className="mr-2 h-4 w-4" /> Xóa nhân sự</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="md:hidden space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="empty-state-mobile">
                <UsersRound className="w-10 h-10 mb-3 text-muted-foreground/30" />
                <p>Không tìm thấy nhân sự nào</p>
              </div>
            ) : (
              filteredUsers.map(u => (
                <ResponsiveStaffCard key={u.id} u={u} onEdit={handleEdit} onResetPassword={handleResetPassword} openConfirmModal={openConfirmModal} />
              ))
            )}
          </div>
        </main>
      </div>

      <StaffFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} editingUser={selectedUser} onSaveSuccess={handleModalSaveSuccess} />
      <ResetPasswordModal isOpen={isResetPassModalOpen} onClose={() => setIsResetPassModalOpen(false)} user={selectedUser} onPasswordReset={handleModalSaveSuccess} />
      <ConfirmActionModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={executeConfirmAction} {...getConfirmModalProps()} />
    </>
  );
};

export default StaffManagementPage;
