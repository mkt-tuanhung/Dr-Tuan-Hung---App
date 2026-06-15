
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, RotateCcw, Save, Users, User, AlertCircle, Database } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext.jsx';
import { getUsers } from '@/utils/userStorage.js';
import { 
  MODULES, 
  ACTIONS, 
  getRolePermissions, 
  getEffectiveUserMatrix, 
  saveRolePermissions, 
  saveUserPermissions,
  resetRolePermissionsToDefault,
  resetUserPermissionsToDefault
} from '@/utils/permissionHelper.js';
import { saveRecord, getRecords } from '@/services/dataService.js';
import { supabaseUrl, supabaseAnonKey } from '@/services/supabaseClient.js';

const ROLES = ['Admin', 'Kế toán', 'Nhân viên', 'Cổ đông'];

const PermissionSettingsPage = ({ hideLayout = false }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('role');
  
  // Role Tab State
  const [selectedRole, setSelectedRole] = useState('Nhân viên');
  const [roleMatrix, setRoleMatrix] = useState({});
  
  // User Tab State
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState([]);
  const [userMatrix, setUserMatrix] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);

  useEffect(() => {
    const allUsers = getUsers();
    setUsers(allUsers.filter(u => u.status === 'active'));
  }, []);

  useEffect(() => {
    if (selectedRole) {
      setRoleMatrix(getRolePermissions(selectedRole));
    }
  }, [selectedRole]);

  useEffect(() => {
    if (selectedUser) {
      const u = users.find(u => u.id === selectedUser || u.employeeId === selectedUser);
      if (u) {
        setUserMatrix(getEffectiveUserMatrix(u.id || u.employeeId, u.role));
      }
    } else {
      setUserMatrix({});
    }
  }, [selectedUser, users]);

  const handleRoleToggle = (module, action) => {
    setRoleMatrix(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action]
      }
    }));
  };

  const handleUserToggle = (module, action) => {
    setUserMatrix(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action]
      }
    }));
  };

  const handleSaveRole = () => {
    setIsLoading(true);
    try {
      saveRolePermissions(selectedRole, roleMatrix);
      toast.success(`Đã lưu phân quyền cho vai trò ${selectedRole}`);
    } catch (e) {
      toast.error('Có lỗi xảy ra khi lưu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreRole = () => {
    if (confirm(`Bạn có chắc muốn khôi phục quyền mặc định cho vai trò ${selectedRole}?`)) {
      resetRolePermissionsToDefault(selectedRole);
      setRoleMatrix(getRolePermissions(selectedRole));
      toast.success(`Đã khôi phục quyền mặc định cho ${selectedRole}`);
    }
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    setIsLoading(true);
    try {
      const u = users.find(u => u.id === selectedUser || u.employeeId === selectedUser);
      const userId = u.id || u.employeeId;
      saveUserPermissions(userId, userMatrix);
      toast.success(`Đã lưu phân quyền riêng cho nhân sự ${u.fullName}`);
    } catch (e) {
      toast.error('Có lỗi xảy ra khi lưu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreUser = () => {
    if (!selectedUser) return;
    const u = users.find(u => u.id === selectedUser || u.employeeId === selectedUser);
    if (confirm(`Bạn có chắc muốn xóa quyền riêng và dùng quyền mặc định theo vai trò cho ${u.fullName}?`)) {
      const userId = u.id || u.employeeId;
      resetUserPermissionsToDefault(userId);
      setUserMatrix(getEffectiveUserMatrix(userId, u.role));
      toast.success(`Đã khôi phục quyền theo vai trò cho ${u.fullName}`);
    }
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    try {
      // 1. Test fetch directly first
      const testUrl = `${supabaseUrl}/rest/v1/system_test?select=*`;
      const response = await fetch(testUrl, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi HTTP: ${response.status} - ${response.statusText}`);
      }

      // 2. If fetch succeeds, proceed with dataService to verify ops
      const testData = {
        id: crypto.randomUUID(),
        message: 'Supabase connected',
        createdFrom: 'Dr Tuan Hung System',
        time: new Date().toISOString()
      };
      
      await saveRecord('system_test', testData);
      const records = await getRecords('system_test');
      
      if (records && records.length > 0) {
        toast.success('Kết nối Supabase thành công');
      } else {
        toast.error('Ghi dữ liệu thành công nhưng đọc lại bị rỗng');
      }
    } catch (error) {
      console.error('Supabase test error:', error);
      toast.error(error.message || 'Lỗi kết nối Supabase');
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const actionLabels = {
    view: 'Xem',
    create: 'Thêm mới',
    edit: 'Sửa',
    delete: 'Xóa',
    approve: 'Phê duyệt',
    export: 'Xuất file'
  };

  const renderMatrix = (matrix, onToggle, isForcedAdmin = false) => {
    if (!matrix || Object.keys(matrix).length === 0) return <div className="text-center py-8 text-muted-foreground">Vui lòng chọn đối tượng cần phân quyền.</div>;

    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-xs border-b border-border">
            <tr>
              <th className="px-6 py-4 min-w-[200px]">Module / Chức năng</th>
              {ACTIONS.map(action => (
                <th key={action} className="px-4 py-4 text-center min-w-[100px]">{actionLabels[action]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {MODULES.map(module => (
              <tr key={module} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">{module}</td>
                {ACTIONS.map(action => (
                  <td key={action} className="px-4 py-4 text-center">
                    <div className="flex justify-center">
                      <Checkbox 
                        checked={isForcedAdmin ? true : (matrix[module]?.[action] || false)}
                        disabled={isForcedAdmin}
                        onCheckedChange={() => onToggle(module, action)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const isRoleAdmin = selectedRole === 'Admin';
  const selectedUserData = users.find(u => u.id === selectedUser || u.employeeId === selectedUser);
  const isUserAdmin = selectedUserData?.role === 'Admin';

  const content = (
    <div className={`space-y-6 ${hideLayout ? '' : 'container max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1'}`}>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Cài đặt phân quyền
          </h1>
          <p className="text-muted-foreground mt-2">
            Quản lý quyền truy cập module và tính năng cho các vai trò và nhân sự.
          </p>
        </div>
        {user?.role === 'Admin' && (
          <Button 
            variant="outline" 
            onClick={handleTestSupabase} 
            disabled={isTestingSupabase}
            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition-colors shadow-sm"
          >
            <Database className="w-4 h-4 mr-2" />
            {isTestingSupabase ? 'Đang kiểm tra...' : 'TEST SUPABASE'}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="role" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="w-4 h-4 mr-2" /> Theo vai trò
          </TabsTrigger>
          <TabsTrigger value="user" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <User className="w-4 h-4 mr-2" /> Theo nhân sự
          </TabsTrigger>
        </TabsList>

        <TabsContent value="role" className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="border border-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl">Phân quyền theo vai trò</CardTitle>
                  <CardDescription>Chọn vai trò để thiết lập quyền mặc định cho nhóm người dùng này.</CardDescription>
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[200px] h-11 rounded-xl bg-background">
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {isRoleAdmin && (
                <div className="mx-6 sm:mx-0 mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 text-sm text-blue-800 mt-6 sm:mt-0">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Quyền Quản trị viên (Admin)</p>
                    <p>Vai trò Admin có toàn quyền truy cập hệ thống. Các quyền này được khóa cố định và không thể thay đổi để tránh mất quyền kiểm soát.</p>
                  </div>
                </div>
              )}
              {renderMatrix(roleMatrix, handleRoleToggle, isRoleAdmin)}
              <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 px-6 sm:px-0 pb-6 sm:pb-0">
                <Button variant="outline" onClick={handleRestoreRole} disabled={isLoading || isRoleAdmin} className="w-full sm:w-auto h-11 rounded-xl text-amber-600 border-amber-200 hover:bg-amber-50">
                  <RotateCcw className="w-4 h-4 mr-2" /> Khôi phục mặc định
                </Button>
                <Button onClick={handleSaveRole} disabled={isLoading || isRoleAdmin} className="w-full sm:w-auto h-11 rounded-xl bg-primary hover:bg-primary/90">
                  <Save className="w-4 h-4 mr-2" /> Lưu phân quyền
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user" className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="border border-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl">Phân quyền theo nhân sự</CardTitle>
                  <CardDescription>Thiết lập quyền ngoại lệ (ưu tiên cao hơn quyền vai trò) cho một nhân sự cụ thể.</CardDescription>
                </div>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-full sm:w-[300px] h-11 rounded-xl bg-background">
                    <SelectValue placeholder="Tìm và chọn nhân sự..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[300px]">
                    {users.map(u => (
                      <SelectItem key={u.id || u.employeeId} value={u.id || u.employeeId}>
                        {u.fullName} - {u.employeeId} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {!selectedUser ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 m-6 rounded-xl border border-dashed border-border">
                  <User className="w-12 h-12 mb-3 text-muted-foreground/30" />
                  <p>Vui lòng chọn nhân sự để hiển thị bảng phân quyền.</p>
                </div>
              ) : (
                <>
                  {isUserAdmin ? (
                    <div className="mx-6 sm:mx-0 mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 text-sm text-blue-800 mt-6 sm:mt-0">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">Tài khoản Quản trị viên (Admin)</p>
                        <p>Nhân sự này đang giữ vai trò Admin nên tự động có toàn quyền truy cập. Bạn không cần cấu hình quyền ngoại lệ.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-6 sm:mx-0 mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 text-sm text-blue-800 mt-6 sm:mt-0">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">Cài đặt quyền ghi đè (Override)</p>
                        <p>Bạn đang chỉnh sửa quyền trực tiếp cho nhân sự này. Các quyền này sẽ ghi đè lên quyền mặc định của vai trò tương ứng.</p>
                      </div>
                    </div>
                  )}
                  {renderMatrix(userMatrix, handleUserToggle, isUserAdmin)}
                  <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 px-6 sm:px-0 pb-6 sm:pb-0">
                    <Button variant="outline" onClick={handleRestoreUser} disabled={isLoading || isUserAdmin} className="w-full sm:w-auto h-11 rounded-xl text-amber-600 border-amber-200 hover:bg-amber-50">
                      <RotateCcw className="w-4 h-4 mr-2" /> Khôi phục theo vai trò
                    </Button>
                    <Button onClick={handleSaveUser} disabled={isLoading || isUserAdmin} className="w-full sm:w-auto h-11 rounded-xl bg-primary hover:bg-primary/90">
                      <Save className="w-4 h-4 mr-2" /> Lưu quyền riêng
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (hideLayout) return content;

  return (
    <>
      <Helmet><title>Cài đặt phân quyền - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen flex flex-col bg-background/50">
        <Header />
        <main className="flex-1">{content}</main>
        <Footer />
      </div>
    </>
  );
};

export default PermissionSettingsPage;
