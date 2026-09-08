'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminApiFetch } from '../lib/admin-api';

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
}

interface AdminAuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('admin_access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const res = await adminApiFetch<{ user: AdminUser }>('/auth/me', {}, token);
      if (res.success && res.data) {
        const userData = (res.data as any).user || res.data;
        setUser(userData);
      } else {
        localStorage.removeItem('admin_access_token');
        setUser(null);
      }
      setIsLoading(false);
    }

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const res = await adminApiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.success && res.data) {
      const { accessToken, user: userData } = res.data;
      localStorage.setItem('admin_access_token', accessToken);
      setUser(userData);
      setIsLoading(false);
      return { success: true };
    } else {
      setIsLoading(false);
      return { success: false, error: res.error || 'Invalid email or password' };
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_access_token');
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.roles?.includes('SUPER_ADMIN')) return true;
    return user.permissions?.includes(permission) || false;
  };

  const hasRole = (role: string) => {
    if (!user) return false;
    return user.roles?.includes(role) || false;
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
