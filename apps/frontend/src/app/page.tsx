import React from 'react';
import { Metadata } from 'next';
import { ApiEnvelope, CategoryPublicDto } from '@ad-utility/shared';
import { getSiteOrigin, getInternalApiUrl, siteConfig } from '../lib/site-config';
import { JsonLd } from '../components/seo/JsonLd';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { HomeClient } from '../components/home/HomeClient';

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
    <div className="min-h-screen flex flex-col justify-between bg-mesh-gradient text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* JSON-LD Schema */}
      <JsonLd data={webSiteSchema} />

      {/* Top Header / Navigation */}
      <Navbar categories={categories} />

      {/* Main Content */}
      <main className="flex-1 w-full pb-16">
        <HomeClient categories={categories} totalTools={totalTools} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
