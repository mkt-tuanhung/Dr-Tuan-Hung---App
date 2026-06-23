import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Loader2, Stethoscope, ShieldCheck, ShieldAlert } from 'lucide-react';

const ROLE_ROUTES = { admin: '/admin-dashboard' };
const getRoute = (role) => ROLE_ROUTES[role] || '/staff-dashboard';

const LoginPage = ({ adminMode = false }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login, verifyMfa, logout, isLoggedIn, profile, mfaRequired, loading } = useAuth();
  const navigate = useNavigate();

  // Điều hướng sau khi đăng nhập (và qua 2FA nếu có)
  useEffect(() => {
    if (loading || mfaRequired || !isLoggedIn || !profile) return;
    if (adminMode && profile.role !== 'admin') {
      setErrorMsg('Đây là cổng Quản trị — tài khoản của bạn không có quyền truy cập.');
      logout();
      return;
    }
    navigate(getRoute(profile.role), { replace: true });
  }, [loading, mfaRequired, isLoggedIn, profile, adminMode, navigate, logout]);

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)' }}>

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-200/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm border border-emerald-100 shadow-xl shadow-emerald-100/50 rounded-3xl p-8 relative z-10">
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-24 h-24 flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Dr Tuan Hung Logo" className="w-full h-full object-contain rounded-xl shadow-lg" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl hidden items-center justify-center shadow-lg shadow-emerald-200">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
          </div>
          {adminMode ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1 font-bold tracking-widest uppercase">
              <ShieldAlert className="w-3.5 h-3.5" /> Cổng Quản trị
            </div>
          ) : (
            <p className="text-xs text-emerald-600 mt-1 font-bold tracking-widest uppercase">Internal System</p>
          )}
        </div>

        {mfaRequired ? (
          /* ----- Bước nhập mã 2FA ----- */
          <form onSubmit={handleVerifyMfa} className="space-y-4">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="font-bold text-slate-800">Xác thực 2 lớp</h3>
              <p className="text-sm text-slate-500 mt-0.5">Nhập mã 6 số từ ứng dụng Authenticator</p>
            </div>
            <Input
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="h-12 rounded-2xl border-emerald-100 bg-emerald-50/50 text-center text-2xl tracking-[0.4em] font-bold"
              placeholder="••••••" autoFocus
            />
            {errorMsg && <p className="text-sm text-red-500 font-medium text-center">{errorMsg}</p>}
            <Button type="submit" disabled={isSubmitting}
              className="w-full h-12 rounded-2xl text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 border-0">
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
              <label className="text-sm font-medium text-slate-600">ID nhân sự</label>
              <Input
                type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                className="h-12 rounded-2xl border-emerald-100 bg-emerald-50/50 focus:border-emerald-400 focus:ring-emerald-400"
                placeholder="Nhập ID nhân sự" autoComplete="username" autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600">Mật khẩu</label>
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl border-emerald-100 bg-emerald-50/50 focus:border-emerald-400 focus:ring-emerald-400"
                placeholder="Nhập mật khẩu" autoComplete="current-password"
              />
            </div>
            {errorMsg && <p className="text-sm text-red-500 font-medium text-center">{errorMsg}</p>}
            <Button type="submit" disabled={isSubmitting}
              className="w-full h-12 rounded-2xl text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 border-0">
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
              {adminMode ? 'Đăng nhập Quản trị' : 'Đăng nhập'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
