import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/supabase';
import { ProductEditor } from '@/components/product-editor';
import type { Category, Product } from '@/lib/types';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await adminDb();
  const { data: categories, error } = await db.from('categories').select('*').order('position');
  if (error) throw error;
  let product: Product | null = null;
  if (id !== 'new') {
    const { data, error } = await db
      .from('products')
      .select('*,variants(*),product_media(*)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) notFound();
    product = data as Product;
  }
  return (
    <ProductEditor
      key={product?.updated_at || id}
      product={product}
      categories={categories as Category[]}
    />
  );
}
