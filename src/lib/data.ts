import 'server-only';
import { cache } from 'react';
import { isConfigured, publicDb } from './supabase';
import type { Category, Product, Settings } from './types';
import { catalogParams } from './catalog-params';
export const defaultSettings: Settings = {
  business_name: 'Your textile store',
  description: 'Comfort for every corner of home.',
  whatsapp: '',
  currency: 'PKR',
  country: 'Pakistan',
  delivery_fee: null,
  free_delivery_threshold: null,
  city_fees: {},
  delivery_enabled: true,
  checkout_enabled: false,
  hero_title: 'Make yourself at home.',
  hero_text:
    'Thoughtfully chosen textiles. Everyday comfort. Discover pieces for the spaces you love.',
  promotion: 'Sofa covers, bedding & everyday home essentials',
  policies: 'Store policies will be published before orders open.',
};
export const storeData = cache(async function storeData() {
  if (!isConfigured())
    return {
      settings: defaultSettings,
      categories: [] as Category[],
      error: 'Store setup is in progress. The catalog will open once the database is connected.',
    };
  const db = publicDb();
  const [s, c] = await Promise.all([
    db.from('settings').select('data').single(),
    db.from('categories').select('*').order('position'),
  ]);
  return {
    settings: (s.data?.data ?? defaultSettings) as Settings,
    categories: (c.data ?? []) as Category[],
    error:
      s.error?.code === 'PGRST205' || c.error?.code === 'PGRST205'
        ? 'Store setup is in progress. The catalog will open once setup is complete.'
        : s.error || c.error
          ? 'The store is temporarily unavailable. Please try again shortly.'
          : null,
  };
});
export async function catalog(input: Record<string, string | string[] | undefined> = {}) {
  const params = catalogParams(input);
  if (!isConfigured())
    return { products: [] as Product[], count: 0, error: 'The catalog is being prepared.' };
  const toAmount = (value: string | undefined) =>
    value && Number.isFinite(Number(value))
      ? Math.max(0, Math.min(100000000, Math.round(Number(value) * 100)))
      : null;
  const { data, error } = await publicDb().rpc('search_catalog', {
    p_query: (params.q || '').trim().slice(0, 100),
    p_category: params.category || null,
    p_size: (params.size || '').slice(0, 100),
    p_color: (params.color || '').slice(0, 100),
    p_min: toAmount(params.min),
    p_max: toAmount(params.max),
    p_sort: params.sort || 'newest',
    p_page: Number(params.page),
    p_featured: !!params.featured,
  });
  return {
    products: (data?.products ?? []) as Product[],
    count: Number(data?.count ?? 0),
    error: error ? 'Unable to load products. Please try again.' : null,
  };
}
export async function bestSellers(): Promise<Product[]> {
  if (!isConfigured()) return [];
  const { data, error } = await publicDb().rpc('best_sellers');
  return error ? [] : (data as Product[]);
}
export async function productBySlug(slug: string) {
  if (!isConfigured()) return null;
  const { data, error } = await publicDb()
    .from('products')
    .select('*,variants(*),product_media(*)')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error('Unable to load product');
  return data as Product | null;
}
