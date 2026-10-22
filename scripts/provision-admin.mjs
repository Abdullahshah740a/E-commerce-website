// Trusted local operator only. Does not assign a password or send an email.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
try {
  loadEnvFile('.env.local');
} catch {}
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/provision-admin.mjs ADMIN_EMAIL');
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let user;
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (error)
    throw new Error(`Cannot inspect administrator account (${error.code || error.status}).`);
  user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (user || data.users.length < 100) break;
}
let created = false;
if (!user) {
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user)
    throw new Error(`Cannot create administrator account (${error?.code || error?.status}).`);
  user = data.user;
  created = true;
}
const { error } = await db.from('admins').upsert({ user_id: user.id }, { onConflict: 'user_id' });
if (error) throw new Error(`Cannot allowlist administrator (${error.code}).`);
const { data: verified, error: readError } = await db
  .from('admins')
  .select('user_id')
  .eq('user_id', user.id)
  .single();
if (readError || !verified) throw new Error('Administrator membership verification failed.');
console.log(
  created
    ? 'Created the requested administrator account without a password.'
    : 'Preserved the existing account and verified administrator membership.',
);
console.log('Administrator allowlist verified. No email was sent and no credential was printed.');
