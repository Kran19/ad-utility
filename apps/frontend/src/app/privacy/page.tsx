import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';
import { ShieldCheck, Lock, Eye, Server, RefreshCw, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { getSiteOrigin, siteConfig } from '../../lib/site-config';

export const metadata: Metadata = {
  title: `Privacy Policy - ${siteConfig.name}`,
  description: 'Learn how UtilityPlatform protects your personal privacy, processes files securely in-browser, and maintains zero permanent data storage.',
  alternates: {
    canonical: `${getSiteOrigin()}/privacy`,
  },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'September 17, 2026';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-mesh-gradient text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Header Badge & Title */}
        <div className="text-center space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>TRANSPARENT DATA PRIVACY</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Your privacy is our top priority. We are committed to transparency, client-side data security, and zero permanent storage of your files.
          </p>
          <div className="text-[11px] text-slate-400 font-mono">
            Last Updated: {lastUpdated}
          </div>
        </div>

        {/* Quick Highlights Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-10">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">100% Private by Design</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Most tools run entirely inside your browser. Your text and images never leave your device.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Zero Permanent Storage</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Files processed on servers are wiped immediately after conversion. We do not keep logs of file contents.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">No Data Selling</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              We never sell, rent, or trade your personal information or file data to any third party.
            </p>
          </div>
        </div>

        {/* Legal Document Content Sections */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">1</span>
              <span>Introduction</span>
            </h2>
            <p>
              Welcome to <strong className="text-slate-900">UtilityPlatform</strong> (accessible at <span className="text-blue-600 font-mono text-xs">stock-247.com/utility</span>). We provide a suite of over 38 free online productivity utilities, including image converters, PDF tools, text formatters, code generators, and AI writing assistants.
            </p>
            <p>
              This Privacy Policy explains how we handle your data when you visit our website and use our web utilities. By using our platform, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">2</span>
              <span>How We Process Your Files & Data</span>
            </h2>
            <p>
              Our platform employs two distinct execution architectures to ensure peak privacy:
            </p>
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Client-Side In-Browser Execution (Local Processing)</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  Utilities such as the Word & Character Counter, JSON Formatter, Text Cleaner, Case Converter, and QR Code Generator operate entirely within your local browser JavaScript sandbox. Your input data is never transmitted across the network to our servers.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Transient Server-Side Processing (Accelerated Conversion)</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  Complex media tasks (such as PDF compression, image format conversion, audio extraction, or video trimming) are processed through high-speed transient memory streams. Files are used strictly to perform the requested operation and are purged automatically from memory immediately after completion. We do not inspect, retain, or store user files permanently.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">3</span>
              <span>AI Writing Utilities</span>
            </h2>
            <p>
              For AI-powered tools (such as the AI Summarizer, AI Humanizer, AI Paraphraser, and AI Grammar Checker), your submitted text snippet is sent securely over encrypted HTTPS to our enterprise AI gateway to generate the requested output.
            </p>
            <p>
              Your text submissions are not used to train or fine-tune public artificial intelligence models, nor are they shared with unauthorized third parties.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">4</span>
              <span>Information We Collect</span>
            </h2>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-600">
              <li>
                <strong className="text-slate-900">Technical Device Data:</strong> Anonymized browser type, operating system, viewport resolution, and language preference to render tailored layouts and device-compatible tools.
              </li>
              <li>
                <strong className="text-slate-900">Log & Telemetry Data:</strong> IP addresses and aggregated performance metrics collected for DDoS defense, rate limiting, and system reliability monitoring.
              </li>
              <li>
                <strong className="text-slate-900">Account Credentials (Optional):</strong> If you create an account, we securely store your email and a cryptographically salted password hash (via bcrypt).
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">5</span>
              <span>Advertisements & Monetization</span>
            </h2>
            <p>
              UtilityPlatform is supported through online advertisements to keep all 38+ utilities free for everyone.
            </p>
            <p>
              We serve non-intrusive contextual banners. To prevent ad spamming and measure aggregate campaign effectiveness, we utilize privacy-preserving cryptographic tokens and frequency caps that do not track your personal identity or browsing history outside of our platform.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">6</span>
              <span>Cookies & Storage</span>
            </h2>
            <p>
              We use minimal essential cookies and browser local storage to maintain session tokens, save active utility preferences, and enforce frequency limits. For full details and management instructions, please review our dedicated <Link href="/cookies" className="text-blue-600 font-semibold hover:underline">Cookie Policy</Link>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">7</span>
              <span>Your Rights (GDPR & CCPA)</span>
            </h2>
            <p>
              Depending on your location, you have statutory rights regarding your personal data, including:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
              <li>The right to request access to personal data we hold about you.</li>
              <li>The right to request correction or complete deletion of your user account.</li>
              <li>The right to withdraw consent or object to data processing.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-2.5 border-t border-slate-100 pt-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">8</span>
              <span>Contact Us</span>
            </h2>
            <p>
              If you have any questions, suggestions, or concerns regarding this Privacy Policy or your data, please contact our support team.
            </p>
          </section>
        </div>

        {/* Bottom Navigation Links */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs">
          <Link href="/" className="text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1">
            &larr; Return to Home
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-slate-500 hover:text-blue-600 font-semibold">
              Terms of Service &rarr;
            </Link>
            <Link href="/cookies" className="text-slate-500 hover:text-blue-600 font-semibold">
              Cookie Policy &rarr;
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
