// Exercises real HTTP checkout and PostgreSQL transactions with disposable QA records.
// Does not open WhatsApp, send messages, change passwords or retain test orders.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import assert from 'node:assert/strict';
try {
  loadEnvFile('.env.local');
} catch {}
const email = process.argv[2];
if (!email) throw new Error('Usage: node scripts/live-checkout.mjs ADMIN_EMAIL');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = crypto.randomUUID(),
  suffix = run.slice(0, 8);
const jar = new Map();
const session = createServerClient(url, pub, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (values) =>
      values.forEach((v) => (v.value ? jar.set(v.name, v.value) : jar.delete(v.name))),
  },
});
let originalSettings,
  productId,
  variants,
  passed = 0;
const orderIds = new Set();
async function check(label, fn) {
  await fn();
  passed++;
  console.log(`PASS: ${label}`);
}
async function admin(action, data) {
  const r = await fetch(base + '/api/admin', {
    method: 'POST',
    headers: {
      Origin: base,
      Cookie: [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; '),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, data }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await r.json();
  assert.equal(r.status, 200, `Admin ${action} operation failed (${r.status})`);
  return body.data;
}
async function checkout(input) {
  const r = await fetch(base + '/api/checkout', {
    method: 'POST',
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      'x-real-ip': `qa-checkout-${run}`,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30000),
  });
  return { status: r.status, ...(await r.json()) };
}
async function saved(reference) {
  const { data, error } = await service
    .from('orders')
    .select('*,order_items(*)')
    .eq('reference', reference)
    .single();
  assert.equal(error, null, 'Saved order could not be reloaded');
  assert.ok(data.customer.notes.includes(run), 'Only this run may access a QA order');
  orderIds.add(data.id);
  return data;
}
async function stock(id) {
  const { data, error } = await service.from('variants').select('stock').eq('id', id).single();
  assert.equal(error, null);
  return data.stock;
}
try {
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  assert.equal(linkError, null);
  const { error: verifyError } = await session.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  assert.equal(verifyError, null);
  const { data: cfg, error: cfgError } = await service.from('settings').select('data').single();
  assert.equal(cfgError, null);
  originalSettings = cfg.data;
  assert.match(
    originalSettings.whatsapp,
    /^[1-9]\d{7,14}$/,
    'Real WhatsApp number must be configured first',
  );
  assert.notEqual(originalSettings.delivery_fee, null);
  await admin('settings', { ...originalSettings, checkout_enabled: true });
  const draft = {
    name: `QA ONLY - NOT FOR DISPATCH & ${suffix}`,
    slug: `qa-checkout-${suffix}`,
    sku: `QA-ORDER-${suffix}`,
    category_id: '',
    short_description: 'Disposable QA record',
    description: `Disposable checkout fixture ${run}`,
    price: 100000,
    sale_price: null,
    active: true,
    featured: false,
    tags: ['qa-only', suffix],
    variants: [
      {
        sku: `QA-A-${suffix}`,
        size: 'King',
        color: 'Sage',
        design: 'Striped',
        price: null,
        stock: 5,
        active: true,
      },
      {
        sku: `QA-B-${suffix}`,
        size: 'Double',
        color: 'Cream',
        design: 'Plain',
        price: 150000,
        stock: 1,
        active: true,
      },
    ],
  };
  productId = await admin('product', draft);
  const { data: p, error: pError } = await service
    .from('products')
    .select('*,variants(*)')
    .eq('id', productId)
    .single();
  assert.equal(pError, null);
  variants = p.variants.sort((a, b) => a.sku.localeCompare(b.sku));
  const customer = {
    name: `QA ONLY ${suffix}`,
    phone: originalSettings.whatsapp,
    whatsapp: '',
    province: 'Punjab',
    city: 'QA Test City',
    area: 'QA ONLY',
    address: 'QA ONLY - AUTOMATED TEST - DO NOT DISPATCH',
    instructions: 'Do not dispatch. Disposable integration test.',
    notes: `QA_RUN ${run}`,
  };
  const key = crypto.randomUUID();
  const request = {
    idempotency_key: key,
    customer,
    items: [
      { variant_id: variants[0].id, quantity: 2, expected_price: 100000 },
      { variant_id: variants[1].id, quantity: 1, expected_price: 150000 },
    ],
  };
  let first, order;
  await check(
    'Checkout saves the full pending COD order with authoritative prices and shipping',
    async () => {
      first = await checkout({ ...request, total: 1, discount: 999999 });
      assert.equal(first.status, 200, 'Checkout API failed');
      order = await saved(first.reference);
      assert.equal(order.status, 'pending_confirmation');
      assert.equal(order.payment_status, 'unpaid');
      assert.equal(order.order_items.length, 2);
      assert.equal(order.subtotal, 350000);
      assert.equal(order.delivery_fee, originalSettings.delivery_fee);
      assert.equal(order.total, 350000 + originalSettings.delivery_fee);
      assert.equal(first.total, order.total);
      assert.equal(await stock(variants[0].id), 3);
      assert.equal(await stock(variants[1].id), 0);
    },
  );
  await check(
    'WhatsApp link targets the real store and contains every saved item without sending',
    async () => {
      assert.ok(first.link && !first.link.copyRequired);
      const link = new URL(first.link.url);
      assert.equal(link.hostname, 'wa.me');
      assert.equal(link.pathname, `/${originalSettings.whatsapp}`);
      assert.equal(link.searchParams.get('text'), first.message);
      for (const item of order.order_items) {
        assert.ok(first.message.includes(item.sku));
        assert.ok(first.message.includes(`Quantity: ${item.quantity}`));
        assert.ok(first.message.includes(item.variant));
      }
      assert.ok(first.message.includes(order.reference));
      assert.ok(first.message.includes(customer.address));
      assert.ok(first.message.includes('Cash on Delivery'));
      assert.equal((await saved(first.reference)).status, 'pending_confirmation');
    },
  );
  await check(
    'Identical checkout retry returns one order and subtracts stock only once',
    async () => {
      const replay = await checkout(request);
      assert.equal(replay.status, 200);
      assert.equal(replay.reference, first.reference);
      const { count, error } = await service
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('idempotency_key', key);
      assert.equal(error, null);
      assert.equal(count, 1);
      assert.equal(await stock(variants[0].id), 3);
    },
  );
  await check('A changed payload cannot reuse a successful idempotency key', async () => {
    const changed = await checkout({
      ...request,
      customer: { ...customer, name: 'QA changed customer' },
    });
    assert.equal(changed.status, 409);
    assert.equal(await stock(variants[0].id), 3);
  });
  await check('Changed prices are rejected before a new order can be saved', async () => {
    const result = await checkout({
      ...request,
      idempotency_key: crypto.randomUUID(),
      items: [{ variant_id: variants[0].id, quantity: 1, expected_price: 1 }],
    });
    assert.equal(result.status, 409);
    assert.ok(result.error.includes('Price changed'));
  });
  await check('Order snapshots survive later product and variant edits', async () => {
    const current = await service
      .from('products')
      .select('*,variants(*)')
      .eq('id', productId)
      .single();
    assert.equal(current.error, null);
    await admin('product', {
      ...draft,
      id: productId,
      name: `QA RENAMED ${suffix}`,
      price: 180000,
      variants: current.data.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        design: v.design,
        price: v.price,
        stock: v.stock,
        expected_stock: v.stock,
        active: v.active,
      })),
    });
    const snapshot = await saved(first.reference);
    assert.equal(
      snapshot.order_items.find((i) => i.variant_id === variants[0].id).unit_price,
      100000,
    );
    assert.equal(snapshot.order_items[0].name, draft.name);
  });
  await check('Cancelling twice restores stock once and preserves the saved order', async () => {
    await admin('order', {
      id: order.id,
      status: 'cancelled',
      payment_status: 'unpaid',
      internal_notes: `QA cancelled ${run}`,
    });
    await admin('order', {
      id: order.id,
      status: 'cancelled',
      payment_status: 'unpaid',
      internal_notes: `QA cancelled twice ${run}`,
    });
    assert.equal(await stock(variants[0].id), 5);
    assert.equal(await stock(variants[1].id), 1);
    assert.equal((await saved(first.reference)).status, 'cancelled');
  });
  await check('Two concurrent HTTP checkouts cannot purchase the same last unit', async () => {
    const one = {
      customer,
      items: [{ variant_id: variants[1].id, quantity: 1, expected_price: 150000 }],
    };
    const results = await Promise.all([
      checkout({ ...one, idempotency_key: crypto.randomUUID() }),
      checkout({ ...one, idempotency_key: crypto.randomUUID() }),
    ]);
    assert.deepEqual(
      results.map((r) => r.status).sort((a, b) => a - b),
      [200, 409],
    );
    for (const r of results)
      if (r.status === 200) {
        const winner = await saved(r.reference);
        await admin('order', {
          id: winner.id,
          status: 'cancelled',
          payment_status: 'unpaid',
          internal_notes: `QA concurrent test ${run}`,
        });
      }
    assert.equal(await stock(variants[1].id), 1);
  });
  await check('Malformed customer input is rejected', async () => {
    const result = await checkout({
      idempotency_key: crypto.randomUUID(),
      customer: { ...customer, address: 'x' },
      items: [{ variant_id: variants[0].id, quantity: 1, expected_price: 180000 }],
    });
    assert.equal(result.status, 400);
  });
  console.log(`${passed} live checkout checks passed. No WhatsApp message was opened or sent.`);
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : 'Live checkout failed'}`);
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  // First close ordering; preserve the real business settings configured by the owner.
  if (originalSettings) {
    const { error } = await service
      .from('settings')
      .update({ data: { ...originalSettings, checkout_enabled: false } })
      .eq('id', true);
    if (error) cleanupFailed = true;
  }
  // Recover test orders even if the client failed after persistence but before receiving a reference.
  const { data: orphans, error: lookupError } = await service
    .from('orders')
    .select('id')
    .contains('customer', { notes: `QA_RUN ${run}` });
  if (lookupError) cleanupFailed = true;
  for (const o of orphans || []) orderIds.add(o.id);
  for (const id of orderIds) {
    const { data: o } = await service
      .from('orders')
      .select('customer,status')
      .eq('id', id)
      .single();
    if (!o?.customer.notes?.includes(run)) {
      cleanupFailed = true;
      continue;
    }
    try {
      if (o.status !== 'cancelled')
        await admin('order', {
          id,
          status: 'cancelled',
          payment_status: 'unpaid',
          internal_notes: `QA cleanup ${run}`,
        });
      const { error } = await service.from('orders').delete().eq('id', id);
      if (error) cleanupFailed = true;
    } catch {
      cleanupFailed = true;
    }
  }
  if (productId) {
    const { error } = await service.from('products').delete().eq('id', productId);
    if (error) cleanupFailed = true;
  }
  await session.auth.signOut({ scope: 'local' }).catch(() => {});
  if (cleanupFailed) {
    console.error('QA cleanup incomplete. Review this run before launch.');
    process.exitCode = 1;
  } else
    console.log(
      'QA orders and product removed; real business settings preserved; checkout disabled until launch review.',
    );
}
