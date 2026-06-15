import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUsers, getCurrentUser, setCurrentUser, clearCurrentUser, initializeUsers, normalizeAllKpiTargets } from '@/utils/userStorage.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = () => {
      try {
        initializeUsers();
        normalizeAllKpiTargets();
        const storedUser = getCurrentUser();
        if (storedUser) {
          setUser(storedUser);
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Failed to restore session", e);
        clearCurrentUser();
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (employeeId, password) => {
    // Artificial delay to simulate network request
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const cleanEmployeeId = employeeId.trim().toLowerCase();
    const cleanPassword = password.trim();

    const users = getUsers();
    const foundUser = users.find(
      (u) => u.employeeId.toLowerCase() === cleanEmployeeId && u.password === cleanPassword
    );

    if (!foundUser) {
      throw new Error('ID hoặc mật khẩu không đúng');
    }

    if (foundUser.status === 'inactive') {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ Admin.');
    }

    const userData = {
      id: foundUser.id,
      employeeId: foundUser.employeeId,
      fullName: foundUser.fullName,
      role: foundUser.role,
      departmentPosition: foundUser.departmentPosition
    };

    setCurrentUser(userData);
    setUser(userData);
    setIsLoggedIn(true);
    
    return userData;
  };

  const logout = () => {
    clearCurrentUser();
    setUser(null);
    setIsLoggedIn(false);
  };

  const value = {
    user,
    isLoggedIn,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;