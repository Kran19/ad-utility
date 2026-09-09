import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ApiEnvelope, CategoryPublicDto } from '@ad-utility/shared';
import { getSiteOrigin, getInternalApiUrl, siteConfig } from '../lib/site-config';
import { AdSlot } from '../components/ads/ad-slot';
import { JsonLd } from '../components/seo/JsonLd';

export const metadata: Metadata = {
  title: siteConfig.defaultTitle,
  description: siteConfig.defaultDescription,
  alternates: {
    canonical: getSiteOrigin(),
  },
  openGraph: {
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
    url: getSiteOrigin(),
    siteName: siteConfig.name,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const dynamic = 'force-dynamic';

async function fetchCategoriesWithUtilities(): Promise<CategoryPublicDto[]> {
  const apiUrl = getInternalApiUrl();

  try {
    const res = await fetch(`${apiUrl}/utilities/categories`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const envelope: ApiEnvelope<CategoryPublicDto[]> = await res.json();
    return envelope.success && Array.isArray(envelope.data) ? envelope.data : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const categories = await fetchCategoriesWithUtilities();
  const origin = getSiteOrigin();

  const totalTools = categories.reduce((sum, cat) => sum + cat.utilityCount, 0);

  // WebSite Structured Data Schema
  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: origin,
    description: siteConfig.defaultDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      {/* JSON-LD Schema */}
      <JsonLd data={webSiteSchema} />

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black">
              U
            </span>
            <span>UtilityPlatform</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="#tools" className="hover:text-white transition-colors">
              Tools Directory
            </Link>
            <Link href="#categories" className="hover:text-white transition-colors">
              Categories
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-12 space-y-12 flex-1 w-full">
        {/* Placement 1: TOP_CONTENT */}
        <AdSlot placement="TOP_CONTENT" />

        <section className="space-y-5 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-800/60 text-blue-400 text-xs font-semibold uppercase tracking-wider">
            {totalTools > 0 ? `${totalTools}+ Fast & Secure Tools` : 'Free Online Utility Suite'}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Free, Fast & Secure <br />
            <span className="bg-gradient-to-r from-blue-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Online Web Utilities
            </span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Everyday utilities for images, PDFs, text, and AI writing. Zero software installation required.
            Direct in-browser and server-accelerated processing with total privacy.
          </p>
        </section>

        {/* Categories Bar */}
        <section id="categories" className="space-y-3">
          <h2 className="text-xl font-bold text-white">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900 transition-all text-center group"
              >
                <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                  {cat.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {cat.utilityCount} {cat.utilityCount === 1 ? 'tool' : 'tools'}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Placement 2: MID_CONTENT */}
        <AdSlot placement="MID_CONTENT" />

        {/* Tools Directory Grouped by Category */}
        <section id="tools" className="space-y-10">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-2xl font-extrabold text-white">All Online Tools</h2>
            <p className="text-sm text-slate-400 mt-1">
              Select any utility below to launch the dedicated workspace.
            </p>
          </div>

          {categories.map((cat) => (
            <div key={cat.slug} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>{cat.name}</span>
                  <span className="text-xs font-normal text-slate-500">({cat.utilityCount})</span>
                </h3>
                <Link
                  href={`/category/${cat.slug}`}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View Category &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.utilities.map((util) => (
                  <Link
                    key={util.slug}
                    href={`/${util.slug}`}
                    className="group p-5 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-blue-500/60 hover:bg-slate-900 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                          {util.implementationMode}
                        </span>
                        {util.isFeatured && (
                          <span className="text-xs font-semibold text-amber-400">★ Featured</span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                        {util.name}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                        {util.description}
                      </p>
                    </div>
                    <div className="flex items-center text-xs font-medium text-blue-400 group-hover:translate-x-1 transition-transform">
                      <span>Open Tool</span>
                      <span className="ml-1">&rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Placement 3: BOTTOM_CONTENT */}
        <AdSlot placement="BOTTOM_CONTENT" />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 text-center text-xs text-slate-500 space-y-2">
        <p>UtilityPlatform &copy; {new Date().getFullYear()} — Enterprise High-Performance Web Utilities</p>
        <p className="text-slate-600">Privacy-First Architecture • Non-Tracking Analytics • Scalable Ad Platform</p>
      </footer>
    </div>
  );
}
