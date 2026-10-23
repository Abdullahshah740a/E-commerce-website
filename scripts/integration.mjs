// Read-only live checks. No customer data is printed or changed.
import { loadEnvFile } from 'node:process';
try {
  loadEnvFile('.env.local');
} catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !pub || !secret) {
  console.error('BLOCKED: Configure Supabase environment variables.');
  process.exit(1);
}
let failed = 0;
async function request(path, key, method = 'GET', body) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, ok: response.ok, data: await response.json() };
}
async function check(label, fn) {
  try {
    if (await fn()) console.log(`PASS: ${label}`);
    else {
      failed++;
      console.log(`FAIL: ${label}`);
    }
  } catch {
    failed++;
    console.log(`FAIL: ${label} (connection or schema unavailable)`);
  }
}
await check('Public settings table exists', async () => {
  const r = await request('settings?select=id', pub);
  return r.ok && r.data.length === 1;
});
await check('Public catalog function exists', async () => {
  const r = await request('rpc/search_catalog', pub, 'POST', {});
  return r.ok && Array.isArray(r.data.products) && Number.isInteger(r.data.count);
});
await check('Best sellers function exists', async () => {
  const r = await request('rpc/best_sellers', pub, 'POST', {});
  return r.ok && Array.isArray(r.data);
});
await check('Anonymous users cannot read private orders', async () => {
  const r = await request('orders?select=id&limit=1', pub);
  return r.status === 401 || r.status === 403 || (r.ok && r.data.length === 0);
});
await check('Anonymous users cannot read administrator identities', async () => {
  const r = await request('admins?select=user_id&limit=1', pub);
  return r.status === 401 || r.status === 403 || (r.ok && r.data.length === 0);
});
await check('Webhook queue exists with server access', async () => {
  const r = await request('order_webhooks?select=order_id&limit=0', secret);
  return r.ok;
});
await check('Anonymous users cannot read webhook payloads', async () => {
  const r = await request('order_webhooks?select=order_id&limit=1', pub);
  return r.status === 401 || r.status === 403 || (r.ok && r.data.length === 0);
});
await check('Anonymous callers cannot invoke order creation', async () => {
  const r = await request('rpc/place_order', pub, 'POST', {
    p_key: '00000000-0000-4000-8000-000000000001',
    p_hash: 'test',
    p_customer: {},
    p_items: [],
  });
  return r.status === 401 || r.status === 403;
});
await check('Secret key has server-side schema access', async () => {
  const r = await request('settings?select=id', secret);
  return r.ok && r.data.length === 1;
});
await check('Public media storage bucket exists', async () => {
  const r = await fetch(`${url}/storage/v1/bucket/product-media`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20000),
  });
  return r.ok;
});
if (failed) {
  console.error(`${failed} live check(s) failed. Apply all migrations and verify configuration.`);
  process.exitCode = 1;
} else
  console.log(
    'Read-only backend checks passed. Authenticated CRUD, uploads and checkout still require the administrator integration suite.',
  );
