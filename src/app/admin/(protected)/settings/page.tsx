import { adminDb } from '@/lib/supabase';
import { SettingsEditor } from '@/components/settings-editor';
import type { Settings } from '@/lib/types';
export default async function Page() {
  const db = await adminDb();
  const { data, error } = await db.from('settings').select('data').single();
  if (error) throw error;
  return <SettingsEditor settings={data.data as Settings} />;
}
