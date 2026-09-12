import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { UtilityPublicDto, ApiEnvelope } from '@ad-utility/shared';
import { getSiteOrigin, getInternalApiUrl, siteConfig } from '../../lib/site-config';
import { AdSlot } from '../../components/ads/ad-slot';
import { ToolRunner } from '../../components/utility/tool-runner';
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs';
import { JsonLd } from '../../components/seo/JsonLd';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';
import { PersonalizedRelatedUtilities } from '../../components/utility/PersonalizedRelatedUtilities';

interface PageProps {
  params: {
    slug: string;
  };
}

export const dynamic = 'force-dynamic';

async function fetchUtilityMetadata(slug: string): Promise<UtilityPublicDto | null> {
  const apiUrl = getInternalApiUrl();

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
    if (process.env.NODE_ENV !== 'production') {
      try {
        const fallbackUrl = 'http://localhost:4001/api/v1';
        const fallbackRes = await fetch(`${fallbackUrl}/utilities/${slug}`, { next: { revalidate: 3600 } });
        if (fallbackRes.ok) {
          const fallbackData: ApiEnvelope<UtilityPublicDto> = await fallbackRes.json();
          return fallbackData.success && fallbackData.data ? fallbackData.data : null;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const utility = await fetchUtilityMetadata(params.slug);
  const origin = getSiteOrigin();

  if (!utility || utility.status !== 'ACTIVE') {
    return {
      title: `Tool Not Found | ${siteConfig.name}`,
      description: 'The requested utility could not be found or is unavailable.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${utility.seoTitle || utility.name} — Free Online Tool | ${siteConfig.name}`;
  const description = utility.seoDescription || utility.description;
  const canonicalUrl = `${origin}/${utility.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
      siteName: siteConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function UtilityPage({ params }: PageProps) {
  const utility = await fetchUtilityMetadata(params.slug);

  if (!utility || utility.status !== 'ACTIVE') {
    notFound();
  }

  const origin = getSiteOrigin();
  const canonicalUrl = `${origin}/${utility.slug}`;
  const categoryUrl = `${origin}/category/${utility.categorySlug}`;

  // 1. WebApplication Structured Data Schema
  const webApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: utility.name,
    description: utility.description,
    url: canonicalUrl,
    applicationCategory: utility.categoryName,
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  // 2. BreadcrumbList Structured Data Schema
  const breadcrumbListSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: origin,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: utility.categoryName,
        item: categoryUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: utility.name,
        item: canonicalUrl,
      },
    ],
  };

  // 3. FAQPage Schema
  const hasFaqs = Array.isArray(utility.faqContent) && utility.faqContent.length > 0;
  const faqPageSchema = hasFaqs
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: utility.faqContent.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }
    : null;

  const breadcrumbs = [
    { name: 'Home', url: '/', position: 1 },
    { name: utility.categoryName, url: `/category/${utility.categorySlug}`, position: 2 },
    { name: utility.name, url: `/${utility.slug}`, position: 3 },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-mesh-gradient text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Structured Data Scripts */}
      <JsonLd data={webApplicationSchema} />
      <JsonLd data={breadcrumbListSchema} />
      {faqPageSchema && <JsonLd data={faqPageSchema} />}

      {/* Top Navigation Bar */}
      <Navbar />

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 space-y-8 w-full">
        {/* Breadcrumbs bar */}
        <div className="flex items-center justify-between">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        {/* Placement 1: HEADER_BANNER */}
        <AdSlot
          placement="HEADER_BANNER"
          utilitySlug={utility.slug}
          categorySlug={utility.categorySlug}
        />

        {/* Hero & Utility Header */}
        <section className="space-y-3 text-center sm:text-left bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <Link
              href={`/category/${utility.categorySlug}`}
              className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 uppercase tracking-wider hover:bg-blue-100 transition-colors"
            >
              {utility.categoryName}
            </Link>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              v{utility.version}
            </span>
            {utility.isFeatured && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                ★ Featured
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            {utility.name}
          </h1>
          <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
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
        <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900">How to Use {utility.name}</h2>
          <div className="text-slate-600 space-y-3 text-sm leading-relaxed">
            <p>
              This utility is designed for maximum speed, precision, and privacy. Follow these simple steps:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-slate-700 font-medium">
              <li>Upload your source file or enter text in the workspace above.</li>
              <li>Configure desired settings (e.g. compression quality, angle, size, or style).</li>
              <li>Click &ldquo;Run {utility.name}&rdquo; to process instantly.</li>
              <li>Download your processed file or copy the result directly to your clipboard.</li>
            </ol>
            <p className="text-xs text-slate-500 pt-3 border-t border-slate-100">
              Zero storage retention: Operations process entirely in-browser or inside isolated memory containers with zero disk retention.
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
        {hasFaqs && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {utility.faqContent.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-white border border-slate-200/80 rounded-2xl p-4 open:shadow-xs transition-all"
                >
                  <summary className="font-semibold text-slate-800 text-sm cursor-pointer list-none flex items-center justify-between">
                    <span>{faq.question}</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
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

        {/* Personalized Related Utilities Section */}
        <PersonalizedRelatedUtilities
          utilitySlug={utility.slug}
          categorySlug={utility.categorySlug}
          categoryName={utility.categoryName}
          initialRelatedSlugs={utility.relatedSlugs || []}
        />
      </main>

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

      {/* Footer */}
      <Footer />
    </div>
  );
}
