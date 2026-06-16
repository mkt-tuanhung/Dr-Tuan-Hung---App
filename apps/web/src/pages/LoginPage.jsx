import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Loader2, Stethoscope, User, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

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
      const { user: u, profile: p } = await login(employeeId, password);
      toast.success(`Xin chào, ${p?.full_name || employeeId}!`);
      navigate(getRoute(p?.role), { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'ID hoặc mật khẩu không đúng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const LoginForm = () => (
    <form onSubmit={handleSubmit} className="space-y-5 mt-6">
      <Input
        type="text"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        className="h-12 bg-background text-foreground"
        placeholder="Nhập ID nhân sự"
        autoComplete="username"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-12 bg-background text-foreground"
        placeholder="Nhập mật khẩu"
        autoComplete="current-password"
      />
      {errorMsg && (
        <p className="text-sm text-destructive font-medium text-center">{errorMsg}</p>
      )}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 text-base font-semibold transition-all duration-200"
      >
        {isSubmitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
        Đăng nhập
      </Button>
    </form>
  );

  return (
    <>
      <Helmet>
        <title>Đăng nhập - Dr Tuấn Hùng Internal System</title>
      </Helmet>

      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-card border border-border shadow-xl rounded-2xl p-8 relative z-10"
        >
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <Stethoscope className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Dr Tuấn Hùng</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium tracking-wide uppercase">Internal System</p>
          </div>

          <Tabs defaultValue="staff" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <User className="w-4 h-4" /> Nhân sự
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Quản trị
              </TabsTrigger>
            </TabsList>

            <TabsContent value="staff"><LoginForm /></TabsContent>
            <TabsContent value="admin"><LoginForm /></TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;
