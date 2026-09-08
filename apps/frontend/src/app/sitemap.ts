import { MetadataRoute } from 'next';
import { getSiteOrigin, getInternalApiUrl } from '../lib/site-config';
import { ApiEnvelope, UtilityPublicDto, CategoryPublicDto } from '@ad-utility/shared';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const apiUrl = getInternalApiUrl();

  const entries: MetadataRoute.Sitemap = [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  try {
    // 1. Fetch categories
    const catRes = await fetch(`${apiUrl}/utilities/categories`, {
      next: { revalidate: 3600 },
    });
    if (catRes.ok) {
      const catEnvelope: ApiEnvelope<CategoryPublicDto[]> = await catRes.json();
      if (catEnvelope.success && Array.isArray(catEnvelope.data)) {
        for (const cat of catEnvelope.data) {
          if (cat.utilityCount > 0) {
            entries.push({
              url: `${origin}/category/${cat.slug}`,
              lastModified: new Date(),
              changeFrequency: 'weekly',
              priority: 0.8,
            });
          }
        }
      }
    }

    // 2. Fetch active utilities
    const utilRes = await fetch(`${apiUrl}/utilities`, {
      next: { revalidate: 3600 },
    });
    if (utilRes.ok) {
      const utilEnvelope: ApiEnvelope<UtilityPublicDto[]> = await utilRes.json();
      if (utilEnvelope.success && Array.isArray(utilEnvelope.data)) {
        for (const util of utilEnvelope.data) {
          if (util.status === 'ACTIVE') {
            entries.push({
              url: `${origin}/${util.slug}`,
              lastModified: new Date(),
              changeFrequency: 'weekly',
              priority: 0.9,
            });
          }
        }
      }
    }
  } catch {
    // Safe fallback if API is temporarily unavailable during sitemap generation
  }

  return entries;
}
