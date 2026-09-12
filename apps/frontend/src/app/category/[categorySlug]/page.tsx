import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ApiEnvelope, CategoryPublicDto } from '@ad-utility/shared';
import { getSiteOrigin, getInternalApiUrl, siteConfig } from '../../../lib/site-config';
import { AdSlot } from '../../../components/ads/ad-slot';
import { Breadcrumbs } from '../../../components/navigation/Breadcrumbs';
import { JsonLd } from '../../../components/seo/JsonLd';
import { Navbar } from '../../../components/navigation/Navbar';
import { Footer } from '../../../components/navigation/Footer';
import {
  Image as ImageIcon,
  FileText,
  Type,
  Code2,
  Sparkles,
  Video,
  Music,
  QrCode,
  ArrowRight,
} from 'lucide-react';

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

  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-rose-500" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'text':
        return <Type className="w-5 h-5 text-emerald-600" />;
      case 'developer':
        return <Code2 className="w-5 h-5 text-purple-600" />;
      case 'ai':
        return <Sparkles className="w-5 h-5 text-blue-600" />;
      case 'video':
        return <Video className="w-5 h-5 text-amber-600" />;
      case 'audio':
        return <Music className="w-5 h-5 text-pink-600" />;
      case 'qr-barcode':
        return <QrCode className="w-5 h-5 text-cyan-600" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

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
    <div className="min-h-screen flex flex-col justify-between bg-mesh-gradient text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* JSON-LD Structured Data */}
      <JsonLd data={breadcrumbListSchema} />
      <JsonLd data={collectionPageSchema} />

      {/* Top Navigation */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 space-y-8 w-full">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbs} />

        {/* Placement 1: HEADER_BANNER */}
        <AdSlot placement="HEADER_BANNER" categorySlug={category.slug} />

        {/* Hero Section */}
        <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-3 shadow-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 uppercase tracking-wider">
            {category.utilityCount} Available Tools
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            {category.name}
          </h1>
          <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
            {category.description ||
              `Discover fast, privacy-friendly ${category.name.toLowerCase()} built for precision and performance.`}
          </p>
        </section>

        {/* Placement 2: TOP_CONTENT */}
        <AdSlot placement="TOP_CONTENT" categorySlug={category.slug} />

        {/* Utilities Grid */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">All {category.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.utilities.map((util) => (
              <Link
                key={util.slug}
                href={`/${util.slug}`}
                className="group p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {util.implementationMode}
                    </span>
                    {util.isFeatured && (
                      <span className="text-xs font-semibold text-amber-500 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                        ★ Featured
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {util.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">
                    {util.description}
                  </p>
                </div>
                <div className="flex items-center text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Placement 3: BOTTOM_CONTENT */}
        <AdSlot placement="BOTTOM_CONTENT" categorySlug={category.slug} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
