// Generates but does not send a recovery link; prints no token or action URL.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
try {
  loadEnvFile('.env.local');
} catch {}
const email = process.argv[2];
if (!email) throw new Error('Supply the requested administrator email.');
const callback = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/admin/reset`;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await db.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: { redirectTo: callback },
});
if (error) throw new Error(`Recovery configuration check failed (${error.code || error.status}).`);
const action = new URL(data.properties.action_link);
const actual = action.searchParams.get('redirect_to') || data.properties.redirect_to;
console.log(
  JSON.stringify({
    recoveryCallbackRequested: callback,
    recoveryCallbackAccepted: actual,
    callbackMatches: actual === callback,
    emailSent: false,
  }),
);
