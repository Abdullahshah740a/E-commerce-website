import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export function isConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
export function publicDb() {
  if (!isConfigured()) throw new Error('Database is not configured');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function privilegedDb() {
  if (!process.env.SUPABASE_SECRET_KEY) throw new Error('Checkout is not configured');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function sessionDb() {
  if (!isConfigured()) throw new Error('Database is not configured');
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* Server components refresh through proxy. */
          }
        },
      },
    },
  );
}
export async function adminDb() {
  const db = await sessionDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  const { data } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!data) throw new Error('Unauthorized');
  return db;
}
