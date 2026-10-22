import type { MetadataRoute } from 'next';
import { isConfigured, publicDb } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const entries: MetadataRoute.Sitemap = [
    { url: base },
    { url: `${base}/shop` },
    { url: `${base}/policies` },
  ];
  if (isConfigured()) {
    const { data } = await publicDb()
      .from('products')
      .select('slug,updated_at')
      .eq('active', true)
      .limit(10000);
    entries.push(
      ...(data ?? []).map((p) => ({
        url: `${base}/products/${p.slug}`,
        lastModified: p.updated_at,
      })),
    );
  }
  return entries;
}
