import React, { useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, Trash2, KeyRound, Save, Loader2, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

const AccountSettingsPage = () => {
  const { user, profile, loading } = useAuth();
  const fileInputRef = useRef(null);

  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="h-[400px] w-full max-w-4xl mx-auto rounded-2xl" />
      </div>
    );
  }

  if (!user || !profile) return <Navigate to="/login" replace />;

  const handlePwdChange = (e) => setPwdForm({ ...pwdForm, [e.target.name]: e.target.value });

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword.length < 8) return toast.error('Mật khẩu mới phải có ít nhất 8 ký tự.');
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return toast.error('Mật khẩu xác nhận không khớp.');

    setPwdLoading(true);
    try {
      // Xác minh mật khẩu cũ bằng cách đăng nhập lại
      const email = `${profile.employee_id}@drtuanhung.internal`;
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pwdForm.oldPassword });
      if (signInErr) { toast.error('Mật khẩu cũ không chính xác.'); return; }

      const { error } = await supabase.auth.updateUser({ password: pwdForm.newPassword });
      if (error) throw error;

      toast.success('Cập nhật mật khẩu thành công.');
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật mật khẩu.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Chỉ hỗ trợ tải lên hình ảnh.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Kích thước ảnh tối đa là 5MB.');

    try {
      setAvatarLoading(true);
      const path = `avatars/${profile.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id);
      if (updateErr) throw updateErr;

      toast.success('Cập nhật ảnh đại diện thành công.');
    } catch (err) {
      toast.error('Lỗi khi tải ảnh lên: ' + err.message);
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!profile.avatar_url) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh đại diện?')) return;
    try {
      setAvatarLoading(true);
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id);
      if (error) throw error;
      toast.success('Đã xóa ảnh đại diện.');
    } catch (err) {
      toast.error('Lỗi khi xóa ảnh.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const initials = profile.full_name?.substring(0, 2).toUpperCase() || 'NS';

  return (
    <>
      <Helmet><title>Cài đặt tài khoản - Dr Tuấn Hùng</title></Helmet>
      <div className="min-h-screen bg-background py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Cài đặt tài khoản</h1>
            <p className="text-muted-foreground mt-2">Quản lý hồ sơ cá nhân và bảo mật tài khoản.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Avatar */}
            <div className="lg:col-span-1">
              <Card className="bg-card border-border shadow-xl overflow-hidden">
                <CardHeader className="text-center bg-muted/20 border-b border-border pb-6 pt-8">
                  <div className="relative inline-block mx-auto group">
                    <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
                      <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
                      <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div
                      className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarLoading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} />
                  </div>
                  {profile.avatar_url && (
                    <Button variant="ghost" size="sm" onClick={handleDeleteAvatar} disabled={avatarLoading} className="text-destructive hover:text-destructive mt-4 text-xs h-8">
                      <Trash2 className="w-3 h-3 mr-2" /> Xóa ảnh
                    </Button>
                  )}
                  <CardTitle className="mt-4 text-xl">{profile.full_name}</CardTitle>
                  <CardDescription className="text-primary mt-1 font-medium">{profile.position || profile.role}</CardDescription>
                </CardHeader>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-8">
              {/* Thông tin định danh */}
              <Card className="bg-card border-border shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><UserCircle className="w-5 h-5" /> Thông tin định danh</CardTitle>
                  <CardDescription>Thông tin này do Quản trị viên quản lý.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Họ và tên', value: profile.full_name },
                      { label: 'ID nhân sự', value: profile.employee_id },
                      { label: 'Số điện thoại', value: profile.phone || 'Chưa cập nhật' },
                      { label: 'Vị trí', value: profile.position || 'Chưa cập nhật' },
                      { label: 'Vai trò', value: profile.role },
                      { label: 'Trạng thái', value: profile.employment_status === 'probation' ? 'Thử việc' : profile.employment_status === 'official' ? 'Chính thức' : 'Không hoạt động' },
                    ].map(item => (
                      <div key={item.label} className="space-y-1">
                        <Label className="text-muted-foreground text-xs">{item.label}</Label>
                        <div className="font-medium bg-background px-3 py-2 rounded-lg border border-border text-sm">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Đổi mật khẩu */}
              <Card className="bg-card border-border shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Bảo mật tài khoản</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label>Mật khẩu hiện tại</Label>
                      <Input type="password" name="oldPassword" value={pwdForm.oldPassword} onChange={handlePwdChange} required className="bg-background" />
                    </div>
                    <div className="space-y-2">
                      <Label>Mật khẩu mới</Label>
                      <Input type="password" name="newPassword" value={pwdForm.newPassword} onChange={handlePwdChange} required minLength={8} className="bg-background" />
                      <p className="text-xs text-muted-foreground">Tối thiểu 8 ký tự</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Xác nhận mật khẩu mới</Label>
                      <Input type="password" name="confirmPassword" value={pwdForm.confirmPassword} onChange={handlePwdChange} required minLength={8} className="bg-background" />
                    </div>
                    <Button type="submit" disabled={pwdLoading} className="w-full">
                      {pwdLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Cập nhật mật khẩu
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AccountSettingsPage;
