import { adminDb } from '@/lib/supabase';
import { CategoryEditor } from '@/components/category-editor';
import type { Category } from '@/lib/types';
export default async function Page() {
  const db = await adminDb();
  const { data, error } = await db.from('categories').select('*').order('position');
  if (error) throw error;
  return <CategoryEditor categories={data as Category[]} />;
}
