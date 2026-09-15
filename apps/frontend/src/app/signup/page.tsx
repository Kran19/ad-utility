'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';
import { getClientApiUrl } from '../../lib/site-config';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Video,
  QrCode,
  Code2,
  CheckCircle2,
} from 'lucide-react';

import { useUserAuth } from '../../context/user-auth-context';

export default function SignupPage() {
  const router = useRouter();
  const { register } = useUserAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Frontend validation
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (formData.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    if (!formData.termsAccepted) {
      setErrorMessage('Please accept the Terms of Service to continue.');
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        name: formData.name.trim() || undefined,
        email: trimmedEmail.toLowerCase(),
        password: formData.password,
        termsAccepted: formData.termsAccepted,
      });

      if (result.success) {
        setIsSuccess(true);
        // Seamless transition to account dashboard
        setTimeout(() => {
          router.push('/account');
        }, 1800);
      } else {
        if (result.alreadyExists) {
          setErrorMessage('An account with this email already exists. Try logging in instead.');
        } else {
          setErrorMessage(result.message || 'Unable to create account. Please try again.');
        }
      }
    } catch (err: any) {
      setErrorMessage('We could not reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const toolkitPills = [
    { label: 'PDF Studio', icon: FileText, color: 'text-red-500 bg-red-50 border-red-200/60' },
    { label: 'Image Engine', icon: ImageIcon, color: 'text-rose-500 bg-rose-50 border-rose-200/60' },
    { label: 'Video Downloader', icon: Video, color: 'text-amber-500 bg-amber-50 border-amber-200/60' },
    { label: 'AI Utilities', icon: Sparkles, color: 'text-blue-500 bg-blue-50 border-blue-200/60' },
    { label: 'QR Generator', icon: QrCode, color: 'text-cyan-600 bg-cyan-50 border-cyan-200/60' },
    { label: 'Dev Utilities', icon: Code2, color: 'text-purple-600 bg-purple-50 border-purple-200/60' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* LEFT: "Utility Universe" Creative Visual Experience */}
          <div className="lg:col-span-6 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden shadow-xl border border-indigo-800/40">
            {/* Subtle background glow & geometric grid */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            <div className="relative z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold tracking-wide backdrop-blur-sm mb-6">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span>One account. A whole toolbox.</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                Your tools. <br />
                <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                  One workspace.
                </span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                Unlock your personal workspace for converting files, downloading media, and automating creative workflows with instant speed.
              </p>

              {/* Connected Toolkit Constellation */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 mb-8">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Available In Your Workspace</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {toolkitPills.map((tool, idx) => {
                    const Icon = tool.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/15 transition-all hover:scale-[1.02]"
                      >
                        <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-sky-300" />
                        </div>
                        <span className="truncate">{tool.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Value Props */}
            <div className="relative z-10 pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-white tracking-tight">30+</div>
                <div className="text-[11px] text-slate-400 font-medium">Free Utilities</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-400 tracking-tight">⚡ Instant</div>
                <div className="text-[11px] text-slate-400 font-medium">Fast Execution</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-400 tracking-tight">100%</div>
                <div className="text-[11px] text-slate-400 font-medium">Privacy First</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Modern Clean Registration Form Card */}
          <div className="lg:col-span-6 bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-slate-200 flex flex-col justify-center relative">
            
            {isSuccess ? (
              /* Success Experience Animation */
              <div className="text-center py-10 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
                  ✓ Workspace created!
                </h2>
                <p className="text-slate-600 text-sm mb-6 max-w-sm mx-auto">
                  Welcome to your utility workspace. Your account is ready.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold mb-6">
                  <Sparkles className="w-4 h-4 text-blue-500 animate-spin" />
                  <span>Redirecting to your account...</span>
                </div>
                <div>
                  <Link
                    href="/account"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                  >
                    <span>Explore Tools</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              /* Standard Signup Form */
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Create your account
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Get started with your free utility account in seconds.
                  </p>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-150"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="signup-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. Alex Morgan"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="signup-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="signup-password"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="signup-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="At least 8 characters"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="signup-confirm-password"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="signup-confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Re-enter password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      id="terms-checkbox"
                      name="termsAccepted"
                      type="checkbox"
                      checked={formData.termsAccepted}
                      onChange={handleChange}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="terms-checkbox" className="text-xs text-slate-600 leading-normal">
                      I agree to the{' '}
                      <Link href="/pricing" className="text-blue-600 hover:underline font-medium">
                        Terms of Service
                      </Link>{' '}
                      and privacy terms.
                    </label>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Creating your workspace...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Account</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Footer Link to Login */}
                <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-600">
                    Already have an account?{' '}
                    <Link
                      href="/login"
                      className="text-blue-600 hover:text-blue-700 font-bold hover:underline"
                    >
                      Sign in &rarr;
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
