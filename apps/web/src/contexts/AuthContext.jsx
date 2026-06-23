import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  // Kiểm tra phiên hiện tại có cần bước 2FA (aal1 → aal2) không
  const checkMfa = async () => {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const need = !!data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
      setMfaRequired(need);
      return need;
    } catch {
      setMfaRequired(false);
      return false;
    }
  };

  const fetchProfile = async (userId) => {
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) return data;
      if (error?.code !== 'PGRST116') {
        console.error('Lỗi khi tải profile:', error?.message);
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  };

  useEffect(() => {
    // Khôi phục session khi load app
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user.id);
        setProfile(p);
        await checkMfa();
      }
      setLoading(false);
    });

    // Lắng nghe thay đổi auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user.id);
        setProfile(p);
        await checkMfa();
      } else {
        setUser(null);
        setProfile(null);
        setMfaRequired(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login bằng employee_id + password
  // Admin tạo tài khoản với email = employeeId@drtuanhung.internal
  const login = async (employeeId, password) => {
    const email = `${employeeId.trim().toLowerCase()}@drtuanhung.internal`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login')) {
        throw new Error('ID hoặc mật khẩu không đúng');
      }
      throw new Error(error.message);
    }
    const p = await fetchProfile(data.user.id);
    if (p?.is_active === false) {
      await supabase.auth.signOut();
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ Admin.');
    }
    const needMfa = await checkMfa();
    return { user: data.user, profile: p, mfaRequired: needMfa };
  };

  // Xác minh mã 2FA (TOTP) để nâng phiên lên aal2
  const verifyMfa = async (code) => {
    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) throw listErr;
    const totp = factors?.totp?.find(f => f.status === 'verified') || factors?.totp?.[0];
    if (!totp) throw new Error('Tài khoản chưa thiết lập 2FA');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code });
    if (error) throw new Error('Mã 2FA không đúng');
    await checkMfa();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setMfaRequired(false);
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isAccountant = profile?.role === 'accountant';
  const isShareholder = profile?.role === 'shareholder';

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isLoggedIn: !!user,
      isAdmin,
      isAccountant,
      isShareholder,
      mfaRequired,
      login,
      verifyMfa,
      logout,
      refreshProfile,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
