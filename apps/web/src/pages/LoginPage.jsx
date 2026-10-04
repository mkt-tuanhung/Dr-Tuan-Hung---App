import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Stethoscope, ShieldCheck, ShieldAlert, MonitorSmartphone, Phone, MessageSquare } from 'lucide-react';

const ROLE_ROUTES = { admin: '/admin-dashboard' };
const getRoute = (role) => ROLE_ROUTES[role] || '/staff-dashboard';
const ADMIN_PHONE = '0879232666';

const LoginPage = ({ adminMode = false }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login, verifyMfa, logout, isLoggedIn, profile, mfaRequired, deviceApprovalRequired, recheckDevice, loading } = useAuth();
  const navigate = useNavigate();

  // Khi chờ duyệt thiết bị: lắng nghe realtime + poll để tự vào khi admin duyệt
  useEffect(() => {
    if (!deviceApprovalRequired || !isLoggedIn || !profile) return;
    const ch = supabase.channel('td_wait_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trusted_devices', filter: `user_id=eq.${profile.id}` }, () => recheckDevice())
      .subscribe();
    const poll = setInterval(() => recheckDevice(), 8000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [deviceApprovalRequired, isLoggedIn, profile, recheckDevice]);

  // Điều hướng sau khi đăng nhập (và qua 2FA / duyệt thiết bị nếu có)
  useEffect(() => {
    if (loading || mfaRequired || deviceApprovalRequired || !isLoggedIn || !profile) return;
    if (adminMode && profile.role !== 'admin') {
      setErrorMsg('Đây là cổng Quản trị — tài khoản của bạn không có quyền truy cập.');
      logout();
      return;
    }
    navigate(getRoute(profile.role), { replace: true });
  }, [loading, mfaRequired, deviceApprovalRequired, isLoggedIn, profile, adminMode, navigate, logout]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!employeeId.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ ID và mật khẩu');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(employeeId, password);
      // Điều hướng & kiểm tra quyền do useEffect xử lý (kể cả bước 2FA)
    } catch (err) {
      setErrorMsg(err.message || 'ID hoặc mật khẩu không đúng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!mfaCode.trim()) { setErrorMsg('Nhập mã 2FA'); return; }
    setIsSubmitting(true);
    try {
      await verifyMfa(mfaCode.trim());
      // useEffect sẽ điều hướng khi mfaRequired = false
    } catch (err) {
      setErrorMsg(err.message || 'Mã 2FA không đúng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelMfa = async () => { setMfaCode(''); setErrorMsg(''); await logout(); };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Bảng thương hiệu (desktop) */}
      <aside className="hidden lg:flex relative w-[46%] max-w-[640px] overflow-hidden bg-teal-800 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: "url('/clinic-hero.png')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-teal-900/40 via-teal-800/70 to-teal-900/95" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-12 h-12 rounded-xl object-contain bg-white/10" />
            <div className="leading-tight">
              <div className="text-[17px] font-extrabold tracking-wide">DR TUẤN HÙNG</div>
              <div className="text-[11px] tracking-[0.25em] text-white/70">INTERNAL SYSTEM</div>
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-teal-100/90 tracking-wide uppercase">Hệ điều hành phòng khám</div>
            <h1 className="text-[40px] font-extrabold leading-[1.15] mt-3 text-white">Vận hành hiệu quả.<br />Kiến tạo giá trị bền vững.</h1>
            <div className="mt-8 space-y-3 text-[14.5px] text-white/85">
              {['Khách hàng 360° — từ tiếp cận tới hậu phẫu', 'Lịch hẹn trực quan theo từng nhân sự', 'Chấm công khuôn mặt, KPI & lương minh bạch'].map(t => (
                <div key={t} className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/15 grid place-items-center"><ShieldCheck className="w-3.5 h-3.5" /></span>{t}</div>
              ))}
            </div>
          </div>
          <div className="text-[12px] text-white/50">© {new Date().getFullYear()} Dr Tuấn Hùng · Bảo mật thiết bị & xác thực 2 lớp</div>
        </div>
      </aside>

      {/* Biểu mẫu */}
      <main className="flex-1 flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-[420px] bg-white border border-slate-200/70 shadow-card rounded-3xl p-7 sm:p-9">
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="w-20 h-20 flex items-center justify-center mb-3 lg:hidden">
            <img src="/logo.png" alt="Dr Tuan Hung Logo" className="w-full h-full object-contain rounded-2xl shadow-soft" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <div className="w-full h-full bg-teal-600 rounded-2xl hidden items-center justify-center">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-[24px] font-bold text-slate-900">{adminMode ? 'Đăng nhập Quản trị' : 'Chào mừng trở lại'}</h2>
          {adminMode ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1.5 font-bold tracking-widest uppercase">
              <ShieldAlert className="w-3.5 h-3.5" /> Cổng Quản trị
            </div>
          ) : (
            <p className="text-[13.5px] text-slate-500 mt-1">Đăng nhập bằng ID nhân sự để bắt đầu ca làm việc</p>
          )}
        </div>

        {deviceApprovalRequired ? (
          /* ----- Chờ admin phê duyệt thiết bị mới ----- */
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                <MonitorSmartphone className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Thiết bị mới — chờ phê duyệt</h3>
              <p className="text-sm text-slate-500 mt-1.5">
                Bạn đang đăng nhập từ thiết bị mới. Yêu cầu đã gửi tới <b>Admin</b>. Trang sẽ tự mở khi được duyệt.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-amber-600 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang chờ Admin phê duyệt...
            </div>

            <div className="bg-teal-50/60 border border-teal-100 rounded-2xl p-4">
              <p className="text-xs text-slate-500 text-center mb-3">Cần gấp? Liên hệ Admin ngay:</p>
              <div className="grid grid-cols-2 gap-3">
                <a href={`tel:${ADMIN_PHONE}`} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-teal-200 hover:bg-teal-50 transition-colors">
                  <Phone className="w-5 h-5 text-teal-600" />
                  <span className="text-xs font-semibold text-slate-700">Gọi điện</span>
                  <span className="text-[11px] text-slate-400">{ADMIN_PHONE}</span>
                </a>
                <a href={`https://zalo.me/${ADMIN_PHONE}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-blue-200 hover:bg-blue-50 transition-colors">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">Nhắn Zalo</span>
                  <span className="text-[11px] text-slate-400">{ADMIN_PHONE}</span>
                </a>
              </div>
            </div>

            <button type="button" onClick={() => logout()} className="w-full text-sm text-slate-400 hover:text-slate-600">
              Hủy / Đăng nhập tài khoản khác
            </button>
          </div>
        ) : mfaRequired ? (
          /* ----- Bước nhập mã 2FA ----- */
          <form onSubmit={handleVerifyMfa} className="space-y-4">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-2">
                <ShieldCheck className="w-6 h-6 text-teal-500" />
              </div>
              <h3 className="font-bold text-slate-800">Xác thực 2 lớp</h3>
              <p className="text-sm text-slate-500 mt-0.5">Nhập mã 6 số từ ứng dụng Authenticator</p>
            </div>
            <Input
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="h-12 rounded-xl border-slate-200 bg-slate-50 text-center text-2xl tracking-[0.4em] font-bold"
              placeholder="••••••" autoFocus
            />
            {errorMsg && <p className="text-sm text-red-500 font-medium text-center">{errorMsg}</p>}
            <Button type="submit" disabled={isSubmitting}
              className="w-full h-12 rounded-xl text-base font-semibold bg-teal-600 hover:bg-teal-700 shadow-soft border-0">
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
              Xác nhận
            </Button>
            <button type="button" onClick={cancelMfa} className="w-full text-sm text-slate-400 hover:text-slate-600">
              Hủy / Đăng nhập tài khoản khác
            </button>
          </form>
        ) : (
          /* ----- Bước nhập mật khẩu ----- */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">ID nhân sự</label>
              <Input
                type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-400 focus:ring-teal-400"
                placeholder="Nhập ID nhân sự" autoComplete="username" autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700">Mật khẩu</label>
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-400 focus:ring-teal-400"
                placeholder="Nhập mật khẩu" autoComplete="current-password"
              />
            </div>
            {errorMsg && <p className="text-sm text-red-500 font-medium text-center">{errorMsg}</p>}
            <Button type="submit" disabled={isSubmitting}
              className="w-full h-12 rounded-xl text-base font-semibold bg-teal-600 hover:bg-teal-700 shadow-soft border-0">
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
              {adminMode ? 'Đăng nhập Quản trị' : 'Đăng nhập'}
            </Button>
          </form>
        )}
      </div>
      <p className="mt-6 text-[12px] text-slate-400 text-center">Quên mật khẩu? Liên hệ Admin <a href={`tel:${ADMIN_PHONE}`} className="font-semibold text-teal-700">{ADMIN_PHONE}</a></p>
      </main>
    </div>
  );
};

export default LoginPage;
