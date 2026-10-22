// Run against a locally running app. This suite does not create business data.
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
let failed = 0;
async function check(label, fn) {
  try {
    if (await fn()) console.log(`PASS: ${label}`);
    else {
      failed++;
      console.log(`FAIL: ${label}`);
    }
  } catch {
    failed++;
    console.log(`FAIL: ${label}`);
  }
}
for (const path of [
  '/',
  '/shop',
  '/cart',
  '/checkout',
  '/policies',
  '/admin/login',
  '/shop?q=bed&q=sheet&page=2.5',
  '/shop?category=invalid&page=Infinity',
])
  await check(`GET ${path}`, async () => {
    const r = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
    return r.status === 200 && (await r.text()).includes('<main');
  });
await check('Anonymous admin mutation is rejected', async () => {
  const r = await fetch(base + '/api/admin', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'settings', data: {} }),
    signal: AbortSignal.timeout(30000),
  });
  return r.status === 401;
});
await check('Foreign-origin checkout is rejected', async () => {
  const r = await fetch(base + '/api/checkout', {
    method: 'POST',
    headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(30000),
  });
  return r.status === 400;
});
await check('Malformed cart JSON is rejected', async () => {
  const r = await fetch(base + '/api/cart', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: '{',
    signal: AbortSignal.timeout(30000),
  });
  return r.status === 400;
});
await check('Private admin route does not render dashboard for guests', async () => {
  const r = await fetch(base + '/admin', { signal: AbortSignal.timeout(30000) });
  const html = await r.text();
  return (
    !html.includes('Store overview.') &&
    (r.url.endsWith('/admin/login') || html.includes('/admin/login'))
  );
});
process.exitCode = failed ? 1 : 0;
