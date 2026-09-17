import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';
import { FileText, ShieldAlert, Scale, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';
import { getSiteOrigin, siteConfig } from '../../lib/site-config';

export const metadata: Metadata = {
  title: `Terms of Service - ${siteConfig.name}`,
  description: 'Review the Terms of Service and acceptable use conditions for using UtilityPlatform online tools.',
  alternates: {
    canonical: `${getSiteOrigin()}/terms`,
  },
};

export default function TermsOfServicePage() {
  const lastUpdated = 'September 17, 2026';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-mesh-gradient text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Header Badge & Title */}
        <div className="text-center space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
            <Scale className="w-3.5 h-3.5 text-blue-600" />
            <span>TERMS & CONDITIONS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Please read these terms and conditions carefully before using our free online utilities and tools.
          </p>
          <div className="text-[11px] text-slate-400 font-mono">
            Last Updated: {lastUpdated}
          </div>
        </div>

        {/* Quick Highlights Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-10">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">100% User Ownership</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              You retain complete ownership and intellectual property rights over all files and outputs generated.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Free Commercial Use</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              You are free to use tool results for personal, academic, and commercial business projects.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Fair & Lawful Use</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Uploading malware, viruses, or infringing unauthorized copyrighted material is strictly prohibited.
            </p>
          </div>
        </div>

        {/* Legal Document Content Sections */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">1</span>
              <span>Agreement to Terms</span>
            </h2>
            <p>
              By accessing or using <strong className="text-slate-900">UtilityPlatform</strong> (&ldquo;Service&rdquo;, &ldquo;Website&rdquo;), you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree with any part of these terms, you must discontinue use of the Service immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">2</span>
              <span>Scope of Services</span>
            </h2>
            <p>
              UtilityPlatform provides free web-based utilities for document manipulation, media compression, file conversion, text processing, cryptographic hashing, QR generation, and AI-assisted rewriting.
            </p>
            <p>
              We grant you a personal, non-exclusive, non-transferable, revocable license to access and use our utilities in accordance with these Terms.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">3</span>
              <span>User Content & Intellectual Property</span>
            </h2>
            <p>
              <strong className="text-slate-900">Your Ownership:</strong> You retain 100% of all intellectual property rights in and to any files, documents, images, audio, video, or text that you submit to the Service. We claim no ownership, copyright, or moral rights over your original content or converted output files.
            </p>
            <p>
              <strong className="text-slate-900">Platform Intellectual Property:</strong> All website interfaces, branding, software code, stylesheets, designs, and logos are the proprietary property of UtilityPlatform and are protected by applicable intellectual property laws.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">4</span>
              <span>Acceptable Use Policy</span>
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-600">
              <li>Upload, transmit, or process files containing malware, viruses, trojans, ransomware, or malicious scripts.</li>
              <li>Process or convert materials that infringe on third-party copyrights, trademarks, patents, or trade secrets without proper legal authorization.</li>
              <li>Attempt to reverse-engineer, decompile, or bypass platform security mechanisms or file size safeguards.</li>
              <li>Engage in automated bot scraping or denial-of-service attacks that impair server availability for other users.</li>
              <li>Upload or process illegal, abusive, harassing, defamatory, or harmful content.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">5</span>
              <span>Disclaimer of Warranties</span>
            </h2>
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950 space-y-1">
              <p className="font-semibold text-xs flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>&ldquo;AS-IS&rdquo; AND &ldquo;AS-AVAILABLE&rdquo; PROVISION</span>
              </p>
              <p className="text-[11px] text-amber-900/90 leading-normal">
                The Service and all tool outputs are provided on an &ldquo;AS-IS&rdquo; and &ldquo;AS-AVAILABLE&rdquo; basis without warranties of any kind, whether express, implied, statutory, or otherwise. We do not guarantee that file conversions will be 100% error-free, uninterrupted, or compatible with all third-party software readers.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">6</span>
              <span>Limitation of Liability</span>
            </h2>
            <p>
              To the maximum extent permitted by applicable law, UtilityPlatform and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, or business interruption arising out of your use or inability to use the Service.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">7</span>
              <span>Advertisements & Third-Party Services</span>
            </h2>
            <p>
              The Service displays advertisements to maintain free tool access. Clicking third-party banner links will direct you to external websites governed by their own terms and privacy policies. We do not endorse or assume responsibility for external third-party websites or services.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-2.5 border-t border-slate-100 pt-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">8</span>
              <span>Modifications to Terms</span>
            </h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. Any changes will become effective immediately upon posting to this page. Your continued use of the Service following modifications signifies your acceptance of the updated terms.
            </p>
          </section>
        </div>

        {/* Bottom Navigation Links */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs">
          <Link href="/" className="text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1">
            &larr; Return to Home
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-slate-500 hover:text-blue-600 font-semibold">
              Privacy Policy &rarr;
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
