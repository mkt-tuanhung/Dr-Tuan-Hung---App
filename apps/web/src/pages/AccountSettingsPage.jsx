
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Trash2, KeyRound, Save, Loader2, UserCircle, Database, RefreshCw, DownloadCloud as CloudDownload } from 'lucide-react';
import { toast } from 'sonner';

import { saveRecord, getRecords } from '@/services/dataService.js';
import RefreshLocalDataModal from '@/components/RefreshLocalDataModal.jsx';

const AccountSettingsPage = () => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  const [staffRecord, setStaffRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  
  // Password Form State
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // Avatar Upload State
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    const fetchStaffProfile = async () => {
      try {
        if (!currentUser?.id) return;
        
        // Match staff by user_id
        const record = await pb.collection('staff').getFirstListItem(`user_id="${currentUser.id}"`, {
          $autoCancel: false
        });
        setStaffRecord(record);
      } catch (err) {
        console.error('Lỗi khi tải hồ sơ nhân sự:', err);
        toast.error('Không tìm thấy thông tin nhân sự liên kết với tài khoản này.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStaffProfile();
  }, [currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const handlePwdChange = (e) => setPwdForm({ ...pwdForm, [e.target.name]: e.target.value });

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (pwdForm.newPassword.length < 8) {
      return toast.error('Mật khẩu mới phải có ít nhất 8 ký tự.');
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      return toast.error('Mật khẩu xác nhận không khớp.');
    }

    setPwdLoading(true);

    try {
      // 1. Validate old password by explicitly attempting to authenticate
      await pb.collection('users').authWithPassword(currentUser.email, pwdForm.oldPassword, { $autoCancel: false });
    } catch (err) {
      toast.error('Mật khẩu cũ không chính xác.');
      setPwdLoading(false);
      return;
    }

    try {
      // 2. Update password
      await pb.collection('users').update(currentUser.id, {
        password: pwdForm.newPassword,
        passwordConfirm: pwdForm.newPassword
      }, { $autoCancel: false });
      
      toast.success('Cập nhật mật khẩu thành công.');
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });

      // Re-authenticate to ensure valid current token
      await pb.collection('users').authWithPassword(currentUser.email, pwdForm.newPassword, { $autoCancel: false });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật mật khẩu.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !staffRecord) return;
    
    if (!file.type.startsWith('image/')) {
      return toast.error('Chỉ hỗ trợ tải lên hình ảnh.');
    }
    
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('Kích thước ảnh tối đa là 5MB.');
    }

    try {
      setAvatarLoading(true);
      const formData = new FormData();
      formData.append('avatar', file);
      
      const updatedRecord = await pb.collection('staff').update(staffRecord.id, formData, { $autoCancel: false });
      setStaffRecord(updatedRecord);
      toast.success('Cập nhật ảnh đại diện thành công.');
    } catch (err) {
      toast.error('Lỗi khi tải ảnh lên.');
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!staffRecord || !staffRecord.avatar) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh đại diện?')) return;

    try {
      setAvatarLoading(true);
      const updatedRecord = await pb.collection('staff').update(staffRecord.id, { avatar: null }, { $autoCancel: false });
      setStaffRecord(updatedRecord);
      toast.success('Đã xóa ảnh đại diện.');
    } catch (err) {
      toast.error('Lỗi khi xóa ảnh.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleTestSupabase = async () => {
    setTestLoading(true);
    try {
      const recordData = { 
        id: 'test-' + Date.now(), 
        message: 'Supabase connected', 
        createdFrom: 'Dr Tuan Hung System', 
        time: new Date().toISOString() 
      };
      
      console.log('Testing Supabase - Saving record:', recordData);
      const saved = await saveRecord('system_test', recordData);
      console.log('Testing Supabase - Save result:', saved);

      const records = await getRecords('system_test');
      console.log('Testing Supabase - Get records result:', records);
      
      toast.success('Kết nối Supabase thành công! Xem log console.');
    } catch (err) {
      console.error('Supabase test error:', err);
      toast.error(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <Skeleton className="h-[400px] w-full max-w-4xl mx-auto rounded-2xl" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!staffRecord) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center container mx-auto px-4">
          <div className="text-center p-8 bg-card rounded-2xl border border-white/5 max-w-md w-full">
            <UserCircle className="w-16 h-16 mx-auto text-muted-foreground opacity-50 mb-4" />
            <h2 className="text-xl font-bold mb-2">Không có hồ sơ nhân sự</h2>
            <p className="text-muted-foreground mb-6">Tài khoản này chưa được liên kết với một hồ sơ nhân sự nào trên hệ thống.</p>
            <Button onClick={() => window.history.back()} variant="outline">Quay lại</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const avatarUrl = staffRecord.avatar ? pb.files.getUrl(staffRecord, staffRecord.avatar) : '';
  const initials = staffRecord.name ? staffRecord.name.substring(0, 2).toUpperCase() : 'NS';

  return (
    <>
      <Helmet>
        <title>Cài đặt tài khoản - MediFinance</title>
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Cài đặt tài khoản</h1>
                <p className="text-muted-foreground mt-2">Quản lý hồ sơ cá nhân và bảo mật tài khoản của bạn.</p>
              </div>
              <Button 
                onClick={handleTestSupabase} 
                variant="outline" 
                disabled={testLoading}
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition-colors shadow-sm"
              >
                <Database className="w-4 h-4 mr-2" />
                {testLoading ? 'Đang kiểm tra...' : 'Test Supabase'}
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Cột trái: Hồ sơ & Avatar */}
              <div className="lg:col-span-1 space-y-8">
                <Card className="bg-card border-white/5 shadow-xl overflow-hidden">
                  <CardHeader className="text-center bg-muted/20 border-b border-border pb-6 pt-8">
                    <div className="relative inline-block mx-auto group">
                      <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
                        <AvatarImage src={avatarUrl} alt={staffRecord.name} className="object-cover" />
                        <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{initials}</AvatarFallback>
                      </Avatar>
                      
                      <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {avatarLoading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                    
                    {staffRecord.avatar && (
                      <Button variant="ghost" size="sm" onClick={handleDeleteAvatar} disabled={avatarLoading} className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-4 text-xs h-8">
                        <Trash2 className="w-3 h-3 mr-2" /> Xóa ảnh
                      </Button>
                    )}
                    
                    <CardTitle className="mt-4 text-xl">{staffRecord.name}</CardTitle>
                    <CardDescription className="text-primary mt-1 font-medium">{staffRecord.position || 'Nhân viên'}</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {/* Cột phải: Thông tin & Bảo mật */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Thông tin chung */}
                <Card className="bg-card border-white/5 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Thông tin định danh</CardTitle>
                    <CardDescription>Thông tin này do Quản trị viên quản lý, không thể tự thay đổi.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Họ và tên</Label>
                        <div className="font-medium bg-background px-4 py-2.5 rounded-lg border border-border">{staffRecord.name}</div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Email công việc</Label>
                        <div className="font-medium bg-background px-4 py-2.5 rounded-lg border border-border">{currentUser.email || 'Chưa cập nhật'}</div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Số điện thoại</Label>
                        <div className="font-medium bg-background px-4 py-2.5 rounded-lg border border-border">{staffRecord.phone || 'Chưa cập nhật'}</div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Chức danh / Bộ phận</Label>
                        <div className="font-medium bg-background px-4 py-2.5 rounded-lg border border-border">{staffRecord.position || 'Chưa cập nhật'}</div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <Label className="text-muted-foreground">Chuyên môn / Nghiệp vụ</Label>
                      <div className="flex flex-wrap gap-2">
                        {staffRecord.specialties?.length > 0 ? (
                          staffRecord.specialties.map(spec => (
                            <Badge key={spec} className="bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 font-medium px-3 py-1">
                              {spec}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm italic text-muted-foreground">Chưa có chuyên môn</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Đổi mật khẩu */}
                <Card className="bg-card border-white/5 shadow-lg overflow-hidden">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Bảo mật tài khoản</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-md">
                      <div className="space-y-2">
                        <Label>Mật khẩu hiện tại</Label>
                        <Input 
                          type="password" 
                          name="oldPassword"
                          value={pwdForm.oldPassword} 
                          onChange={handlePwdChange} 
                          required 
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mật khẩu mới</Label>
                        <Input 
                          type="password" 
                          name="newPassword"
                          value={pwdForm.newPassword} 
                          onChange={handlePwdChange} 
                          required 
                          minLength={8}
                          className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground">Tối thiểu 8 ký tự</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Xác nhận mật khẩu mới</Label>
                        <Input 
                          type="password" 
                          name="confirmPassword"
                          value={pwdForm.confirmPassword} 
                          onChange={handlePwdChange} 
                          required 
                          minLength={8}
                          className="bg-background"
                        />
                      </div>
                      <Button type="submit" disabled={pwdLoading} className="w-full mt-2">
                        {pwdLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Cập nhật mật khẩu
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Đồng bộ dữ liệu */}
                <Card className="bg-card border-white/5 shadow-lg overflow-hidden border-blue-100/20">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2">
                      <CloudDownload className="w-5 h-5 text-blue-500" />
                      <CardTitle className="text-lg">Đồng bộ dữ liệu</CardTitle>
                    </div>
                    <CardDescription>Làm mới dữ liệu từ Supabase về thiết bị hiện tại nếu bạn thấy dữ liệu bị thiếu hoặc cũ.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Button 
                      onClick={() => setIsRefreshModalOpen(true)} 
                      variant="outline" 
                      className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Làm mới dữ liệu từ Supabase
                    </Button>
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>
        </main>
        
        <Footer />
        <RefreshLocalDataModal isOpen={isRefreshModalOpen} onClose={() => setIsRefreshModalOpen(false)} />
      </div>
    </>
  );
};

export default AccountSettingsPage;
