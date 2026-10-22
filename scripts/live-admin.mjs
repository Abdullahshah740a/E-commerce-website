// Live integration exercise using disposable, clearly labeled QA catalog records.
// Auth tokens/cookies stay in memory. No email or WhatsApp message is sent.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import assert from 'node:assert/strict';
try {
  loadEnvFile('.env.local');
} catch {}
const email = process.argv[2];
if (!email) throw new Error('Usage: node scripts/live-admin.mjs ADMIN_EMAIL');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicDb = createClient(url, pub, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = crypto.randomUUID();
const suffix = run.slice(0, 8);
const jar = new Map();
const session = createServerClient(url, pub, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (values) =>
      values.forEach((v) => (v.value ? jar.set(v.name, v.value) : jar.delete(v.name))),
  },
});
const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');
let productId, categoryId, nonAdminId;
let passed = 0;
async function check(label, fn) {
  await fn();
  passed++;
  console.log(`PASS: ${label}`);
}
async function action(name, data, cookieHeader = cookie()) {
  const r = await fetch(base + '/api/admin', {
    method: 'POST',
    headers: { Origin: base, Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: name, data }),
    signal: AbortSignal.timeout(30000),
  });
  return { status: r.status, ...(await r.json()) };
}
async function successful(name, data) {
  const r = await action(name, data);
  assert.equal(r.status, 200, `${name} API operation failed (${r.status})`);
  return r.data;
}
async function product() {
  const { data, error } = await service
    .from('products')
    .select('*,variants(*),product_media(*)')
    .eq('id', productId)
    .single();
  assert.equal(error, null, 'Unable to reload QA product');
  return data;
}
try {
  await check(
    'Authenticate the requested administrator without assigning or printing a password',
    async () => {
      const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email });
      assert.equal(error, null, 'Cannot create an in-memory test login');
      const { error: verifyError } = await session.auth.verifyOtp({
        type: 'magiclink',
        token_hash: data.properties.hashed_token,
      });
      assert.equal(verifyError, null, 'Cannot establish test session');
      const { data: admin, error: adminError } = await session
        .from('admins')
        .select('user_id')
        .single();
      assert.equal(adminError, null, 'Administrator membership denied');
      assert.ok(admin.user_id);
    },
  );
  await check('Authenticated dashboard loads through the actual application', async () => {
    const r = await fetch(base + '/admin', {
      headers: { Cookie: cookie() },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes('Store overview.'));
  });
  await check('Category create/edit persists through the authenticated admin API', async () => {
    const category = {
      name: `QA ONLY ${suffix}`,
      slug: `qa-${suffix}`,
      description: `Disposable QA record ${run}`,
      image_url: null,
      position: 9999,
      active: true,
    };
    await successful('category', category);
    const { data, error } = await service
      .from('categories')
      .select('id')
      .eq('slug', category.slug)
      .single();
    assert.equal(error, null);
    categoryId = data.id;
    await successful('category', {
      ...category,
      id: categoryId,
      description: `Edited QA record ${run}`,
    });
    const { data: edited } = await service
      .from('categories')
      .select('description')
      .eq('id', categoryId)
      .single();
    assert.equal(edited.description, `Edited QA record ${run}`);
  });
  const draft = {
    name: `QA ONLY - NOT FOR SALE ${suffix}`,
    slug: `qa-only-${suffix}`,
    sku: `QA-P-${suffix}`,
    category_id: categoryId,
    short_description: 'Temporary integration test record; automatically removed.',
    description: `Disposable integration fixture ${run}`,
    price: 100000,
    sale_price: null,
    active: false,
    featured: false,
    tags: ['qa-only', suffix],
    variants: [
      {
        sku: `QA-V1-${suffix}`,
        size: 'King',
        color: 'Sage',
        design: '',
        price: null,
        stock: 5,
        active: true,
      },
      {
        sku: `QA-V2-${suffix}`,
        size: 'Double',
        color: 'Cream',
        design: '',
        price: 200000,
        stock: 2,
        active: true,
      },
    ],
  };
  await check(
    'Product and variant create persists; draft is hidden from public reads',
    async () => {
      productId = await successful('product', draft);
      assert.ok(productId);
      const p = await product();
      assert.equal(p.variants.length, 2);
      const { data } = await publicDb.from('products').select('id').eq('id', productId);
      assert.equal(data.length, 0);
    },
  );
  await check('Product edit, variant prices/stock and public catalog filters persist', async () => {
    const p = await product();
    const variants = p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      design: v.design,
      price: v.price,
      stock: v.stock,
      expected_stock: v.stock,
      active: v.active,
    }));
    await successful('product', { ...draft, id: productId, price: 120000, active: true, variants });
    const { data, error } = await publicDb.rpc('search_catalog', {
      p_query: suffix,
      p_min: 190000,
      p_max: 210000,
    });
    assert.equal(error, null);
    assert.equal(data.count, 1);
    assert.equal(data.products[0].id, productId);
  });
  await check(
    'Cart revalidation returns current variant-specific prices from the live database',
    async () => {
      const p = await product();
      const r = await fetch(base + '/api/cart', {
        method: 'POST',
        headers: { Origin: base, 'Content-Type': 'application/json' },
        body: JSON.stringify(p.variants.map((v) => v.id)),
        signal: AbortSignal.timeout(30000),
      });
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.deepEqual(
        body.items.map((i) => i.expected_price).sort((a, b) => a - b),
        [120000, 200000],
      );
    },
  );
  await check(
    'Real file upload, public retrieval, media ordering and primary image selection persist',
    async () => {
      const bytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      );
      const media = [];
      for (let i = 0; i < 2; i++) {
        const form = new FormData();
        form.append('product_id', productId);
        form.append('file', new Blob([bytes], { type: 'image/png' }), 'qa-image.png');
        const r = await fetch(base + '/api/admin/upload', {
          method: 'POST',
          headers: { Origin: base, Cookie: cookie() },
          body: form,
          signal: AbortSignal.timeout(30000),
        });
        assert.equal(r.status, 200, 'Authenticated upload failed');
        const body = await r.json();
        media.push(body.media);
        const file = await fetch(body.media.url);
        assert.equal(file.status, 200);
        assert.equal(Buffer.compare(Buffer.from(await file.arrayBuffer()), bytes), 0);
      }
      await successful('media-order', {
        product_id: productId,
        ids: [media[1].id, media[0].id],
        primary: media[1].id,
      });
      const p = await product();
      assert.equal(p.product_media.filter((m) => m.is_primary).length, 1);
      assert.equal(p.product_media.find((m) => m.is_primary).id, media[1].id);
      await successful('delete-media', { id: media[0].id });
      const { error } = await service.storage.from('product-media').download(media[0].storage_key);
      assert.ok(error, 'Removed file still exists in origin storage');
    },
  );
  await check('Disguised image uploads are rejected', async () => {
    const form = new FormData();
    form.append('product_id', productId);
    form.append(
      'file',
      new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/png' }),
      'disguised.png',
    );
    const r = await fetch(base + '/api/admin/upload', {
      method: 'POST',
      headers: { Origin: base, Cookie: cookie() },
      body: form,
    });
    assert.equal(r.status, 400);
  });
  await check('Invalid delivery settings cannot be saved', async () => {
    const { data } = await service.from('settings').select('data').single();
    const original = data.data;
    const r = await action('settings', { ...original, delivery_fee: -1 });
    assert.equal(r.status, 400);
    const { data: after } = await service.from('settings').select('data').single();
    assert.deepEqual(after.data, original);
  });
  await check('A stale administrator editor cannot overwrite current stock', async () => {
    const p = await product();
    const variants = p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      design: v.design,
      price: v.price,
      stock: v.stock,
      expected_stock: v.stock + 1,
      active: v.active,
    }));
    const r = await action('product', { ...draft, id: productId, active: true, variants });
    assert.equal(r.status, 409);
  });
  await check('Non-administrator authenticated accounts cannot use admin API', async () => {
    const testEmail = `qa-${run}@example.invalid`;
    const { data: created, error } = await service.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
    });
    assert.equal(error, null);
    nonAdminId = created.user.id;
    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: testEmail,
    });
    assert.equal(linkError, null);
    const otherJar = new Map();
    const other = createServerClient(url, pub, {
      cookies: {
        getAll: () => [...otherJar].map(([name, value]) => ({ name, value })),
        setAll: (values) =>
          values.forEach((v) =>
            v.value ? otherJar.set(v.name, v.value) : otherJar.delete(v.name),
          ),
      },
    });
    try {
      const { error: verify } = await other.auth.verifyOtp({
        type: 'magiclink',
        token_hash: link.properties.hashed_token,
      });
      assert.equal(verify, null);
      const cookies = [...otherJar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');
      const r = await action('archive', { id: productId }, cookies);
      assert.equal(r.status, 401);
    } finally {
      await other.auth.signOut({ scope: 'local' });
    }
  });
  await check('Archiving removes the test product from the public catalog', async () => {
    await successful('archive', { id: productId });
    const { data, error } = await publicDb.rpc('search_catalog', { p_query: suffix });
    assert.equal(error, null);
    assert.equal(data.count, 0);
  });
  await check('Signing out clears the session and admin access', async () => {
    await session.auth.signOut({ scope: 'local' });
    assert.equal(jar.size, 0);
    const r = await action('archive', { id: productId });
    assert.equal(r.status, 401);
  });
  console.log(
    `${passed} live admin checks passed. Checkout/order creation is not exercised while real business settings are missing.`,
  );
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : 'Live test failed'}`);
  process.exitCode = 1;
} finally {
  await session.auth.signOut({ scope: 'local' }).catch(() => {});
  let cleanupFailed = false;
  if (productId) {
    const { data: media } = await service
      .from('product_media')
      .select('storage_key')
      .eq('product_id', productId);
    const keys = (media || []).map((m) => m.storage_key).filter(Boolean);
    if (keys.length) {
      const { error } = await service.storage.from('product-media').remove(keys);
      if (error) cleanupFailed = true;
    }
    const { error } = await service.from('products').delete().eq('id', productId);
    if (error) cleanupFailed = true;
  }
  if (categoryId) {
    const { error } = await service.from('categories').delete().eq('id', categoryId);
    if (error) cleanupFailed = true;
  }
  if (nonAdminId) {
    const { error } = await service.auth.admin.deleteUser(nonAdminId);
    if (error) cleanupFailed = true;
  }
  if (cleanupFailed) {
    console.error('QA cleanup incomplete. Review QA ONLY records before launch.');
    process.exitCode = 1;
  } else console.log('Disposable QA catalog, media, account and test sessions cleaned up.');
}
