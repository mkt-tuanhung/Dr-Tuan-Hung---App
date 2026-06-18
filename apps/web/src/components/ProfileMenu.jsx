import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { User, Key, Building2, LogOut, FileText, Settings, X, ShieldAlert, Camera, Loader2 } from 'lucide-react';

export default function ProfileMenu({ children, mobile = false }) {
  const { profile, refreshProfile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Modals state
  const [activeTab, setActiveTab] = useState('profile'); // profile, password
  const [saving, setSaving] = useState(false);
  
  // Profile Form
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    bank_name: profile?.bank_name || '',
    bank_account: profile?.bank_account || '',
    avatar_url: profile?.avatar_url || ''
  });
  const [uploading, setUploading] = useState(false);

  // Password Form
  const [pwdForm, setPwdForm] = useState({ newPassword: '', confirmPassword: '' });

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      toast.error('Lỗi đăng xuất');
    }
  };

  const openProfileModal = () => {
    setForm({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      bank_name: profile?.bank_name || '',
      bank_account: profile?.bank_account || '',
      avatar_url: profile?.avatar_url || ''
    });
    setMenuOpen(false);
    setModalOpen(true);
  };

  const handleAvatarUpload = async (event) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;

      let { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setForm({ ...form, avatar_url: data.publicUrl });
      toast.success('Đã tải ảnh lên! Hãy bấm Lưu thay đổi.');
    } catch (error) {
      toast.error('Lỗi tải ảnh: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        phone: form.phone,
        bank_name: form.bank_name,
        bank_account: form.bank_account,
        avatar_url: form.avatar_url
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Lỗi cập nhật: ' + error.message);
    } else {
      toast.success('Đã cập nhật hồ sơ cá nhân!');
      await refreshProfile();
      setModalOpen(false);
    }
    setSaving(false);
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      return toast.error('Mật khẩu xác nhận không khớp');
    }
    if (pwdForm.newPassword.length < 6) {
      return toast.error('Mật khẩu phải từ 6 ký tự');
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: pwdForm.newPassword
    });

    if (error) {
      toast.error('Lỗi đổi mật khẩu: ' + error.message);
    } else {
      toast.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      handleLogout();
    }
    setSaving(false);
  };

  return (
    <div className="relative">
      <div onClick={() => setMenuOpen(!menuOpen)} className="cursor-pointer">
        {children}
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute z-50 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden w-64 top-full mt-2 right-0">
            <div className="p-4 border-b bg-emerald-50/50">
              <div className="font-bold text-slate-800 truncate">{profile?.full_name}</div>
              <div className="text-xs text-emerald-600 mt-0.5">{profile?.position || profile?.role} · {profile?.employee_id}</div>
            </div>

            <div className="p-2 space-y-1">
              <button onClick={openProfileModal} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors text-left">
                <User className="w-4 h-4 text-slate-400" /> Hồ sơ cá nhân
              </button>
              
              <button onClick={() => { setMenuOpen(false); toast.info('Tính năng sắp ra mắt'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors text-left">
                <Settings className="w-4 h-4 text-slate-400" /> Cài đặt giao diện
              </button>
              
              <div className="h-px bg-slate-100 my-1" />
              
              <button onClick={() => { setMenuOpen(false); toast.info('Chưa có nội quy mới'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors text-left">
                <ShieldAlert className="w-4 h-4 text-orange-400" /> Nội quy phòng khám
              </button>
              
              <button onClick={() => { setMenuOpen(false); toast.info('Kho tài liệu trống'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors text-left">
                <FileText className="w-4 h-4 text-blue-400" /> Giấy tờ & Tài liệu
              </button>
              
              <div className="h-px bg-slate-100 my-1" />
              
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 text-sm font-bold transition-colors text-left">
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          </div>
        </>
      )}

      {/* Profile Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="flex bg-slate-50 border-b">
              <button onClick={() => setActiveTab('profile')} className={`flex-1 py-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'profile' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                Thông tin cá nhân
              </button>
              <button onClick={() => setActiveTab('password')} className={`flex-1 py-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'password' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                Đổi mật khẩu
              </button>
              <button onClick={() => setModalOpen(false)} className="px-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6">
              {activeTab === 'profile' ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center justify-center mb-6">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 group">
                      {form.avatar_url ? (
                        <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <User className="w-10 h-10" />
                        </div>
                      )}
                      
                      <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                        <span className="text-[10px] mt-1 font-medium">{uploading ? 'Đang tải...' : 'Thay đổi'}</span>
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Họ và tên</label>
                    <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Số điện thoại</label>
                    <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Ngân hàng</label>
                      <input type="text" placeholder="VD: Vietcombank, MB, ACB..." value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Số tài khoản</label>
                      <input type="text" value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" />
                    </div>
                  </div>

                  {form.bank_name && form.bank_account && (
                    <div className="mt-4 p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 flex flex-col items-center">
                      <p className="text-sm font-bold text-emerald-800 mb-3">Mã QR Nhận tiền của bạn</p>
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <img 
                          src={`https://img.vietqr.io/image/${form.bank_name.trim().toLowerCase()}-${form.bank_account.trim()}-compact.jpg?accountName=${encodeURIComponent(form.full_name)}`}
                          alt="VietQR"
                          className="w-40 h-40 object-contain"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      </div>
                      <p className="text-xs text-emerald-600 mt-3 text-center">Đưa mã này cho Kế toán để nhận lương/tạm ứng siêu tốc</p>
                    </div>
                  )}

                  <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Hủy</button>
                    <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">Lưu thay đổi</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSavePassword} className="space-y-4">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-sm mb-4">
                    <strong>Lưu ý:</strong> Sau khi đổi mật khẩu, bạn sẽ tự động bị đăng xuất khỏi tất cả các thiết bị và cần đăng nhập lại.
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                    <input type="password" minLength="6" value={pwdForm.newPassword} onChange={e => setPwdForm({...pwdForm, newPassword: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Xác nhận mật khẩu</label>
                    <input type="password" minLength="6" value={pwdForm.confirmPassword} onChange={e => setPwdForm({...pwdForm, confirmPassword: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" required />
                  </div>
                  <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Hủy</button>
                    <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">Cập nhật mật khẩu</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
