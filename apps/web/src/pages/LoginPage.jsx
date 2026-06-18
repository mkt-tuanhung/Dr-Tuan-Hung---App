import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Loader2, Stethoscope, User, ShieldAlert } from 'lucide-react';

const ROLE_ROUTES = {
  admin: '/admin-dashboard',
  accountant: '/accountant-dashboard',
  shareholder: '/shareholder-dashboard',
};

const getRoute = (role) => ROLE_ROUTES[role] || '/staff-dashboard';

const LoginPage = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login, isLoggedIn, profile } = useAuth();
  const navigate = useNavigate();

  if (isLoggedIn && profile) {
    return <Navigate to={getRoute(profile.role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!employeeId.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ ID và mật khẩu');
      return;
    }
    setIsSubmitting(true);
    try {
      const { profile: p } = await login(employeeId, password);
      toast.success(`Xin chào, ${p?.full_name || employeeId}!`);
      navigate(getRoute(p?.role), { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'ID hoặc mật khẩu không đúng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)' }}>

      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-200/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm border border-emerald-100 shadow-xl shadow-emerald-100/50 rounded-3xl p-8 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-24 h-24 flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Dr Tuan Hung Logo" className="w-full h-full object-contain rounded-xl shadow-lg" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl hidden items-center justify-center shadow-lg shadow-emerald-200">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
          </div>
          <p className="text-xs text-emerald-600 mt-1 font-bold tracking-widest uppercase">Internal System</p>
        </div>

        <Tabs defaultValue="staff" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-emerald-50 rounded-2xl p-1">
            <TabsTrigger value="staff" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700">
              <User className="w-4 h-4" /> Nhân sự
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700">
              <ShieldAlert className="w-4 h-4" /> Quản trị
            </TabsTrigger>
          </TabsList>

          {['staff', 'admin'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-600">ID nhân sự</label>
                  <Input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="h-12 rounded-2xl border-emerald-100 bg-emerald-50/50 focus:border-emerald-400 focus:ring-emerald-400"
                    placeholder="Nhập ID nhân sự"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-600">Mật khẩu</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-2xl border-emerald-100 bg-emerald-50/50 focus:border-emerald-400 focus:ring-emerald-400"
                    placeholder="Nhập mật khẩu"
                    autoComplete="current-password"
                  />
                </div>
                {errorMsg && (
                  <p className="text-sm text-red-500 font-medium text-center">{errorMsg}</p>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-2xl text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 border-0"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                  Đăng nhập
                </Button>
              </form>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default LoginPage;
