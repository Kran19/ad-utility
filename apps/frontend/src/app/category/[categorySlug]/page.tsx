import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ApiEnvelope, CategoryPublicDto } from '@ad-utility/shared';
import { getSiteOrigin, getInternalApiUrl, siteConfig } from '../../../lib/site-config';
import { AdSlot } from '../../../components/ads/ad-slot';
import { Breadcrumbs } from '../../../components/navigation/Breadcrumbs';
import { JsonLd } from '../../../components/seo/JsonLd';

interface PageProps {
  params: {
    categorySlug: string;
  };
}

async function fetchCategory(categorySlug: string): Promise<CategoryPublicDto | null> {
  const apiUrl = getInternalApiUrl();

  try {
    const res = await fetch(`${apiUrl}/utilities/categories/${categorySlug}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const envelope: ApiEnvelope<CategoryPublicDto> = await res.json();
    return envelope.success && envelope.data ? envelope.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = await fetchCategory(params.categorySlug);
  const origin = getSiteOrigin();

  if (!category) {
    return {
      title: 'Category Not Found | UtilityPlatform',
      description: 'The requested tool category could not be found.',
      robots: { index: false, follow: false },
    };
  }

  const title = `${category.name} — Free Online Tools | ${siteConfig.name}`;
  const description =
    category.description ||
    `Explore free online ${category.name.toLowerCase()} for fast and secure processing directly in your browser.`;
  const canonicalUrl = `${origin}/category/${category.slug}`;

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

export default async function CategoryPage({ params }: PageProps) {
  const category = await fetchCategory(params.categorySlug);

  if (!category) {
    notFound();
  }

  const origin = getSiteOrigin();
  const canonicalUrl = `${origin}/category/${category.slug}`;

  // Structured Data Schemas
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
        name: category.name,
        item: canonicalUrl,
      },
    ],
  };

  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name} — Online Tools`,
    description: category.description || `Collection of free online ${category.name.toLowerCase()}.`,
    url: canonicalUrl,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: category.utilities.map((util, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: util.name,
        description: util.description,
        url: `${origin}/${util.slug}`,
      })),
    },
  };

  const breadcrumbs = [
    { name: 'Home', url: '/', position: 1 },
    { name: category.name, url: `/category/${category.slug}`, position: 2 },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* JSON-LD Structured Data */}
      <JsonLd data={breadcrumbListSchema} />
      <JsonLd data={collectionPageSchema} />

      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black">
              U
            </span>
            <span>UtilityPlatform</span>
          </Link>
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        {/* Placement 1: HEADER_BANNER */}
        <AdSlot placement="HEADER_BANNER" categorySlug={category.slug} />

        {/* Hero Section */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-blue-950 text-blue-400 border border-blue-800/60 uppercase tracking-wider">
            {category.utilityCount} Available Tools
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {category.name}
          </h1>
          <p className="text-lg text-slate-400 max-w-3xl">
            {category.description ||
              `Discover fast, privacy-friendly ${category.name.toLowerCase()} built for precision and performance.`}
          </p>
        </section>

        {/* Placement 2: TOP_CONTENT */}
        <AdSlot placement="TOP_CONTENT" categorySlug={category.slug} />

        {/* Utilities Grid */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">All {category.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.utilities.map((util) => (
              <Link
                key={util.slug}
                href={`/${util.slug}`}
                className="group p-5 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-blue-500/60 hover:bg-slate-900 transition-all flex flex-col justify-between space-y-3 shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {util.implementationMode}
                    </span>
                    {util.isFeatured && (
                      <span className="text-xs font-semibold text-amber-400">★ Featured</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                    {util.name}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    {util.description}
                  </p>
                </div>
                <div className="flex items-center text-sm font-medium text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Tool</span>
                  <span className="ml-1">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Placement 3: BOTTOM_CONTENT */}
        <AdSlot placement="BOTTOM_CONTENT" categorySlug={category.slug} />
      </div>
    </main>
  );
}
