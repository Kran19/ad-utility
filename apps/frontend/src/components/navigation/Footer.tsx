'use client';

import React from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200/80 text-slate-600 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 pb-10 border-b border-slate-100">
          {/* Column 1: Brand */}
          <div className="space-y-3 sm:col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-sm shadow-blue-500/30">
                U
              </div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                Utility<span className="text-blue-600">Platform</span>
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Your all-in-one online utility toolkit. Fast, secure, and private browser-based utilities for everyday tasks.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/#tools" className="text-slate-500 hover:text-blue-600 transition-colors">
                  All Tools
                </Link>
              </li>
              <li>
                <Link href="/#categories" className="text-slate-500 hover:text-blue-600 transition-colors">
                  Categories
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/privacy" className="text-slate-500 hover:text-blue-600 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-500 hover:text-blue-600 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-slate-500 hover:text-blue-600 transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} UtilityPlatform. All rights reserved.</p>
          <p className="flex items-center gap-2 text-slate-500 font-medium">
            <span>Fast</span>
            <span>&bull;</span>
            <span>Secure</span>
            <span>&bull;</span>
            <span>Private</span>
            <span>&bull;</span>
            <span>Always Free</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
