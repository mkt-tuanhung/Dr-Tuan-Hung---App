
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Loader2, Save, User } from 'lucide-react';
import { motion } from 'framer-motion';

const StaffProfile = () => {
  const { currentUser, staffId } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    position: '',
    department: '',
    phone: '',
    email: '',
    address: ''
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState({ oldPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        username: currentUser.username || '',
        position: currentUser.position || '',
        department: currentUser.specialties ? currentUser.specialties.join(', ') : '',
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        address: currentUser.address || ''
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await pb.collection('staff').update(staffId, {
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
      }, { $autoCancel: false });
      toast.success('Đã cập nhật thông tin hồ sơ');
    } catch (err) {
      toast.error('Lỗi khi lưu thông tin: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwdData.newPassword !== pwdData.newPasswordConfirm) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }
    if (pwdData.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setIsChangingPwd(true);
    try {
      await pb.collection('staff').update(staffId, {
        oldPassword: pwdData.oldPassword,
        password: pwdData.newPassword,
        passwordConfirm: pwdData.newPasswordConfirm,
      }, { $autoCancel: false });
      toast.success('Đã thay đổi mật khẩu thành công');
      setIsPasswordModalOpen(false);
      setPwdData({ oldPassword: '', newPassword: '', newPasswordConfirm: '' });
    } catch (err) {
      toast.error('Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setIsChangingPwd(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Hồ sơ cá nhân - Staff Portal</title>
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/staff-dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Hồ sơ cá nhân</h1>
        </header>

        <main className="max-w-3xl mx-auto p-6 md:p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            
            {/* Header section */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                <User className="h-10 w-10" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-2xl font-bold">{formData.name}</h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{formData.username}</span>
                  <span>•</span>
                  <span>{formData.position || 'Nhân viên'}</span>
                </div>
              </div>
              <Button onClick={() => setIsPasswordModalOpen(true)} variant="outline" className="shrink-0 gap-2">
                <KeyRound className="h-4 w-4" /> Đổi mật khẩu
              </Button>
            </div>

            {/* Form Section */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Read Only */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Phòng ban / Chuyên môn</Label>
                  <Input value={formData.department} disabled className="bg-muted text-muted-foreground opacity-70" />
                </div>
                
                {/* Editable */}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    className="bg-background text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số điện thoại</Label>
                  <Input 
                    type="tel" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    className="bg-background text-foreground"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Địa chỉ</Label>
                  <Input 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                    className="bg-background text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <Button onClick={handleSave} disabled={isSaving} className="gap-2 px-6">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          </motion.div>
        </main>

        <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
            <DialogHeader>
              <DialogTitle>Đổi mật khẩu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Mật khẩu hiện tại</Label>
                <Input type="password" value={pwdData.oldPassword} onChange={e => setPwdData({...pwdData, oldPassword: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Mật khẩu mới</Label>
                <Input type="password" value={pwdData.newPassword} onChange={e => setPwdData({...pwdData, newPassword: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Xác nhận mật khẩu mới</Label>
                <Input type="password" value={pwdData.newPasswordConfirm} onChange={e => setPwdData({...pwdData, newPasswordConfirm: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)}>Hủy</Button>
              <Button onClick={handleChangePassword} disabled={isChangingPwd || !pwdData.oldPassword || !pwdData.newPassword}>
                {isChangingPwd && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Xác nhận
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default StaffProfile;
