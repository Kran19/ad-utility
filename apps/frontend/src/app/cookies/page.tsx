import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';
import { Cookie, Settings, CheckCircle2, ShieldCheck, ToggleLeft, HelpCircle } from 'lucide-react';
import { getSiteOrigin, siteConfig } from '../../lib/site-config';

export const metadata: Metadata = {
  title: `Cookie Policy - ${siteConfig.name}`,
  description: 'Understand how UtilityPlatform uses cookies, local storage, and frequency capping to deliver fast, secure online tools.',
  alternates: {
    canonical: `${getSiteOrigin()}/cookies`,
  },
};

export default function CookiePolicyPage() {
  const lastUpdated = 'September 17, 2026';

  return (
    <div className="min-h-screen flex flex-col justify-between bg-mesh-gradient text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Header Badge & Title */}
        <div className="text-center space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
            <Cookie className="w-3.5 h-3.5 text-blue-600" />
            <span>COOKIE TRANSPARENCY</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Cookie Policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Learn how we use essential cookies and browser storage to optimize tool speed, manage sessions, and protect your browsing experience.
          </p>
          <div className="text-[11px] text-slate-400 font-mono">
            Last Updated: {lastUpdated}
          </div>
        </div>

        {/* Quick Highlights Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-10">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Essential & Minimal</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              We only set cookies strictly necessary for platform functions, secure logins, and tool performance.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">No Invasive Cross-Tracking</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              We do not track your personal activities across unrelated third-party websites or build advertising profiles.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Full User Control</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              You can easily block or clear cookies at any time directly through your web browser preferences.
            </p>
          </div>
        </div>

        {/* Legal Document Content Sections */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">1</span>
              <span>What Are Cookies & Local Storage?</span>
            </h2>
            <p>
              Cookies are small data files stored on your device (computer, tablet, or mobile phone) when you visit websites. They enable the website to remember your actions and preferences over a period of time.
            </p>
            <p>
              We also use browser <strong className="text-slate-900">Local Storage</strong> and <strong className="text-slate-900">Session Storage</strong> to process data locally within your browser without sending unnecessary requests to our servers.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">2</span>
              <span>How UtilityPlatform Uses Cookies</span>
            </h2>
            <p>We use cookies and client-side storage for the following specific purposes:</p>

            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Strictly Essential & Authentication Cookies</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  Required for core platform navigation, verifying signed user sessions, preventing CSRF security vulnerabilities, and maintaining user account states.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Functional & Preference Storage</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  Stores your active utility preferences (such as selected image compression quality, aspect ratios, or recent tools) so you don&apos;t have to reconfigure settings on each visit.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                  <span>Ad Delivery & Frequency Capping</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  Used by our ad selector to prevent repetitive banner display (frequency caps) and generate signed verification tokens for ad delivery, ensuring a clean and non-disruptive browsing experience.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">3</span>
              <span>Third-Party Cookies</span>
            </h2>
            <p>
              When you use our website, some third-party services may place cookies on your device. These include external ad networks and CDN infrastructure (such as Google Fonts or Cloudflare) for performance optimization and asset caching.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">4</span>
              <span>How to Manage & Disable Cookies</span>
            </h2>
            <p>
              You have the right to accept or decline cookies. Most web browsers automatically accept cookies, but you can usually modify your browser settings to decline cookies if you prefer.
            </p>
            <p>
              To manage cookies in your browser:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
              <li><strong className="text-slate-900">Google Chrome:</strong> Settings &gt; Privacy and security &gt; Cookies and other site data.</li>
              <li><strong className="text-slate-900">Mozilla Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Enhanced Tracking Protection.</li>
              <li><strong className="text-slate-900">Apple Safari:</strong> Preferences &gt; Privacy &gt; Block all cookies.</li>
              <li><strong className="text-slate-900">Microsoft Edge:</strong> Settings &gt; Cookies and site permissions &gt; Manage and delete cookies.</li>
            </ul>
            <p className="text-[11px] text-slate-500 pt-1">
              Note: If you choose to disable all cookies, some features of our website (such as maintaining account login sessions) may not function as intended.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-2.5 border-t border-slate-100 pt-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-black flex items-center justify-center">5</span>
              <span>Updates to This Policy</span>
            </h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our operational practices or legal requirements. We encourage you to review this page periodically.
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
            <Link href="/terms" className="text-slate-500 hover:text-blue-600 font-semibold">
              Terms of Service &rarr;
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
