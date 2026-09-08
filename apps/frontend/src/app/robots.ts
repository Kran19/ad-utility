import { MetadataRoute } from 'next';
import { getSiteOrigin } from '../lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
