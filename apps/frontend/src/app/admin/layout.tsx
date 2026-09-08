'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminAuthProvider, useAdminAuth } from '../../context/admin-auth-context';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout, hasPermission } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    return null;
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: '📊', requiredPermission: null },
    { label: 'Campaigns', href: '/admin/campaigns', icon: '🎯', requiredPermission: 'campaigns:read' },
    { label: 'Creatives', href: '/admin/creatives', icon: '🖼️', requiredPermission: 'creatives:read' },
    { label: 'Placements', href: '/admin/placements', icon: '📍', requiredPermission: 'placements:read' },
    { label: 'Targeting', href: '/admin/targeting', icon: '🧭', requiredPermission: 'targeting:manage' },
    { label: 'Schedules', href: '/admin/schedules', icon: '⏰', requiredPermission: 'campaigns:read' },
    { label: 'Utilities', href: '/admin/utilities', icon: '⚡', requiredPermission: 'utilities:read' },
    { label: 'Users & RBAC', href: '/admin/users', icon: '👥', requiredPermission: 'users:manage' },
    { label: 'Analytics', href: '/admin/analytics', icon: '📈', requiredPermission: 'analytics:read' },
    { label: 'AI Usage', href: '/admin/ai-usage', icon: '🤖', requiredPermission: 'ai:read' },
    { label: 'Settings', href: '/admin/settings', icon: '⚙️', requiredPermission: 'settings:read' },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: '📜', requiredPermission: 'audit:read' },
  ];

  const visibleNavItems = navItems.filter((item) => !item.requiredPermission || hasPermission(item.requiredPermission));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-lg text-white">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm shadow-md">AD</span>
            <span>Admin Control</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            ☰
          </button>
        </div>

        <nav className={`flex-1 p-3 space-y-1 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400 text-sm">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
              <div className="flex gap-1 mt-0.5">
                {user?.roles?.map((r) => (
                  <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md border border-slate-800 transition-colors flex items-center justify-center gap-1"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 border-b border-slate-800 bg-slate-900/40 backdrop-blur px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/admin" className="hover:text-slate-200">Admin</Link>
            <span>/</span>
            <span className="text-slate-200 font-medium capitalize">
              {pathname.replace('/admin/', '').replace('/admin', 'Dashboard')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Platform Active
            </span>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
