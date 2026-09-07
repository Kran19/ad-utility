import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { UtilityPublicDto, ApiEnvelope } from '@ad-utility/shared';
import { AdSlot } from '../../components/ads/ad-slot';
import { ToolRunner } from '../../components/utility/tool-runner';

interface PageProps {
  params: {
    slug: string;
  };
}

async function fetchUtilityMetadata(slug: string): Promise<UtilityPublicDto | null> {
  const apiUrl =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window === 'undefined' ? 'http://backend:4000/api/v1' : 'http://localhost:4000/api/v1');

  try {
    const res = await fetch(`${apiUrl}/utilities/${slug}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    const data: ApiEnvelope<UtilityPublicDto> = await res.json();
    return data.success && data.data ? data.data : null;
  } catch (err) {
    try {
      const fallbackUrl = 'http://localhost:4000/api/v1';
      const fallbackRes = await fetch(`${fallbackUrl}/utilities/${slug}`, { cache: 'no-store' });
      if (fallbackRes.ok) {
        const fallbackData: ApiEnvelope<UtilityPublicDto> = await fallbackRes.json();
        return fallbackData.success && fallbackData.data ? fallbackData.data : null;
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const utility = await fetchUtilityMetadata(params.slug);

  if (!utility) {
    return {
      title: 'Utility Not Found | Ad Utility Platform',
      description: 'The requested utility could not be found.',
    };
  }

  return {
    title: `${utility.seoTitle || utility.name} | Ad Utility Platform`,
    description: utility.seoDescription || utility.description,
    alternates: {
      canonical: utility.canonicalUrl || `/${utility.slug}`,
    },
    openGraph: {
      title: utility.seoTitle || utility.name,
      description: utility.seoDescription || utility.description,
      type: 'website',
      url: `/${utility.slug}`,
    },
  };
}

export default async function UtilityPage({ params }: PageProps) {
  const utility = await fetchUtilityMetadata(params.slug);

  if (!utility || utility.status !== 'ACTIVE') {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 pb-20">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800/80 bg-gray-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black">
              U
            </span>
            <span>UtilityPlatform</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">
              All Tools
            </Link>
            <span className="text-gray-700">/</span>
            <span className="text-gray-200 capitalize">{utility.categoryName}</span>
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        {/* Placement 1: HEADER_BANNER */}
        <AdSlot
          placement="HEADER_BANNER"
          utilitySlug={utility.slug}
          categorySlug={utility.categorySlug}
        />

        {/* Hero & Utility Header */}
        <section className="space-y-3 text-center sm:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-950 text-blue-400 border border-blue-800/60 uppercase tracking-wider">
              {utility.categoryName}
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-800 text-gray-300 border border-gray-700">
              v{utility.version}
            </span>
            {utility.isFeatured && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-950 text-amber-400 border border-amber-800/60">
                ★ Featured
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {utility.name}
          </h1>
          <p className="text-lg text-gray-400 max-w-3xl">
            {utility.description}
          </p>
        </section>

        {/* Placement 2: TOP_CONTENT */}
        <AdSlot
          placement="TOP_CONTENT"
          utilitySlug={utility.slug}
          categorySlug={utility.categorySlug}
        />

        {/* Primary Interactive Workspace */}
        <section className="w-full">
          <ToolRunner utility={utility} />
        </section>

        {/* Placement 3: AFTER_TOOL */}
        <AdSlot
          placement="AFTER_TOOL"
          utilitySlug={utility.slug}
          categorySlug={utility.categorySlug}
        />

        {/* How-to Guide & Documentation Section */}
        <section className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-6 sm:p-8 space-y-4">
          <h2 className="text-2xl font-bold text-white">How to Use {utility.name}</h2>
          <div className="prose prose-invert max-w-none text-gray-300 space-y-3 text-sm sm:text-base leading-relaxed">
            <p>
              This utility is designed for high performance, reliability, and security. Follow these steps to use the tool:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Enter or paste your content in the input field above.</li>
              <li>Click the &ldquo;Run {utility.name}&rdquo; button to execute the tool.</li>
              <li>View the formatted or transformed output instantly in the result pane.</li>
              <li>Copy or export the output for your workflow.</li>
            </ol>
            <p className="text-xs text-gray-400">
              All computations respect our strict privacy and isolation standards.
            </p>
          </div>
        </section>

        {/* Placement 4: MID_CONTENT */}
        <AdSlot
          placement="MID_CONTENT"
          utilitySlug={utility.slug}
          categorySlug={utility.categorySlug}
        />

        {/* Frequently Asked Questions (FAQ) Section */}
        {utility.faqContent && utility.faqContent.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {utility.faqContent.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-gray-900/80 border border-gray-800 rounded-lg p-4 open:bg-gray-900 transition-colors"
                >
                  <summary className="font-medium text-gray-200 cursor-pointer list-none flex items-center justify-between">
                    <span>{faq.question}</span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="mt-3 text-sm text-gray-400 leading-relaxed border-t border-gray-800/60 pt-3">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Placement 5: BOTTOM_CONTENT */}
        <AdSlot
          placement="BOTTOM_CONTENT"
          utilitySlug={utility.slug}
          categorySlug={utility.categorySlug}
        />

        {/* Related Utilities Section */}
        {utility.relatedSlugs && utility.relatedSlugs.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-gray-800">
            <h3 className="text-xl font-bold text-white">Related Utilities</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {utility.relatedSlugs.map((relSlug) => (
                <Link
                  key={relSlug}
                  href={`/${relSlug}`}
                  className="p-4 rounded-lg bg-gray-900/60 border border-gray-800/80 hover:border-blue-500/50 hover:bg-gray-900 transition-all flex items-center justify-between group"
                >
                  <span className="font-medium text-gray-300 group-hover:text-blue-400 transition-colors capitalize">
                    {relSlug.replace(/-/g, ' ')}
                  </span>
                  <span className="text-gray-500 group-hover:translate-x-1 transition-transform">&rarr;</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Floating Sticky Ad Slot (Mobile / Desktop) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center pb-2">
        <div className="pointer-events-auto sm:hidden">
          <AdSlot
            placement="MOBILE_STICKY"
            utilitySlug={utility.slug}
            categorySlug={utility.categorySlug}
            className="my-0 shadow-2xl"
          />
        </div>
      </div>
    </main>
  );
}
