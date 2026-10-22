import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: process.env.STORE_LAUNCHED === 'true' ? '/' : [],
      disallow:
        process.env.STORE_LAUNCHED === 'true'
          ? ['/admin', '/api', '/checkout', '/cart', '/auth']
          : ['/'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/sitemap.xml`,
  };
}
