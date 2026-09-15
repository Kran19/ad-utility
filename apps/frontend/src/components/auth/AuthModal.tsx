'use client';

import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../../context/user-auth-context';
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalConfig,
    savedCredentials,
    login,
    register,
  } = useUserAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('signup');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Synchronize initial state when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg(null);
      setInfoMsg(null);
      const prefTab = authModalConfig?.initialTab || (savedCredentials?.email ? 'login' : 'signup');
      setActiveTab(prefTab);

      if (savedCredentials?.email) {
        setEmail(savedCredentials.email);
        if (savedCredentials.password) {
          setPassword(savedCredentials.password);
        }
      }
    }
  }, [isAuthModalOpen, authModalConfig, savedCredentials]);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    const result = await login(cleanEmail, password, rememberMe);
    setLoading(false);

    if (result.success) {
      const cb = authModalConfig?.onSuccess;
      closeAuthModal();
      if (cb) cb();
    } else {
      setErrorMsg(result.message || 'Incorrect email or password.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    const result = await register({
      email: cleanEmail,
      password,
      name: name.trim() || undefined,
      termsAccepted: true,
    });
    setLoading(false);

    if (result.success) {
      const cb = authModalConfig?.onSuccess;
      closeAuthModal();
      if (cb) cb();
    } else {
      if (result.alreadyExists) {
        // User already exists! Smoothly switch to login tab with email preserved
        setInfoMsg('An account already exists for this email. Please sign in with your password.');
        setActiveTab('login');
      } else {
        setErrorMsg(result.message || 'Unable to create account. Please try again.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div
        className="absolute inset-0"
        onClick={closeAuthModal}
        aria-hidden="true"
      />

      {/* Sweet Modal Container */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Top Header Banner */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
              <Sparkles className="w-4 h-4 text-blue-200" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
              Free Instant Access
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-white tracking-tight">
            {authModalConfig?.title || 'Unlock Full Tool Power'}
          </h3>
          <p className="text-xs text-blue-100 mt-1 leading-relaxed">
            {authModalConfig?.message || 'Create a free account or sign in to process files, run AI tools, and save your work.'}
          </p>

          {/* Sweet Pill Tabs */}
          <div className="mt-5 grid grid-cols-2 p-1 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'signup'
                  ? 'bg-white text-blue-700 shadow-md scale-[1.02]'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              Create Free Account
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'login'
                  ? 'bg-white text-blue-700 shadow-md scale-[1.02]'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Modal Form Body */}
        <div className="p-6">
          {/* Info notification */}
          {infoMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Error notification */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'signup' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Create Password <span className="text-slate-400 font-normal">(min. 8 chars)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Create Account & Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-slate-600 hover:text-blue-600 font-medium transition-colors"
                >
                  Already have an account? <span className="text-blue-600 font-bold">Sign In</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>Stay logged in on this browser</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In & Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-slate-600 hover:text-blue-600 font-medium transition-colors"
                >
                  New here? <span className="text-blue-600 font-bold">Create Free Account</span>
                </button>
              </div>
            </form>
          )}

          {/* Security badge */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Fast, free & secure. No credit card required.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
