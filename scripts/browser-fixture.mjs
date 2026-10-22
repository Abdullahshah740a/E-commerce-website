// Disposable browser-QA fixture. State contains public settings/QA IDs, never auth tokens.
import { loadEnvFile } from 'node:process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
try {
  loadEnvFile('.env.local');
} catch {}
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const file = '.qa-browser-state.json';
const mode = process.argv[2];
if (mode === 'setup') {
  if (existsSync(file)) throw new Error('Clean up the existing browser fixture first.');
  const run = crypto.randomUUID();
  const suffix = run.slice(0, 8);
  const { data: cfg, error: cfgError } = await service.from('settings').select('data').single();
  if (cfgError) throw new Error('Cannot read settings.');
  if (!cfg.data.whatsapp || cfg.data.delivery_fee === null)
    throw new Error('Real store delivery/WhatsApp settings are required.');
  const { data: p, error } = await service
    .from('products')
    .insert({
      name: `QA ONLY - NOT FOR SALE ${suffix}`,
      slug: `qa-browser-${suffix}`,
      sku: `QA-BROWSER-${suffix}`,
      short_description: 'Temporary browser test. This is not a business product.',
      description: `Browser QA ${run}`,
      price: 100000,
      active: true,
      featured: false,
      tags: ['qa-only', suffix],
    })
    .select('id,slug')
    .single();
  if (error) throw new Error('Cannot create test product.');
  writeFileSync(file, JSON.stringify({ run, product_id: p.id, slug: p.slug, settings: cfg.data }));
  const { error: variantError } = await service.from('variants').insert([
    {
      product_id: p.id,
      sku: `QA-BROWSER-A-${suffix}`,
      size: 'King',
      color: 'Sage',
      design: 'Striped',
      price: null,
      stock: 5,
    },
    {
      product_id: p.id,
      sku: `QA-BROWSER-B-${suffix}`,
      size: 'Double',
      color: 'Cream',
      design: 'Plain',
      price: 150000,
      stock: 3,
    },
  ]);
  if (variantError) throw new Error('Cannot create QA variants. Run cleanup.');
  const { error: settingsError } = await service
    .from('settings')
    .update({ data: { ...cfg.data, checkout_enabled: true } })
    .eq('id', true);
  if (settingsError) throw new Error('Cannot enable QA checkout. Run cleanup.');
  console.log(
    JSON.stringify({
      productPath: `/products/${p.slug}`,
      notes: `QA_BROWSER ${run}`,
      name: `QA ONLY ${suffix}`,
      phone: cfg.data.whatsapp,
    }),
  );
} else if (mode === 'cleanup') {
  if (!existsSync(file)) {
    console.log('No browser fixture to clean up.');
    process.exit(0);
  }
  const state = JSON.parse(readFileSync(file, 'utf8'));
  let failed = false;
  const { error: settingsError } = await service
    .from('settings')
    .update({ data: state.settings })
    .eq('id', true);
  if (settingsError) failed = true;
  const { data: orders, error: orderError } = await service
    .from('orders')
    .select('id,customer,status,order_items(product_id)')
    .contains('customer', { notes: `QA_BROWSER ${state.run}` });
  if (orderError) throw new Error('Cannot locate QA orders. State retained.');
  if (orders.length) {
    const email = process.argv[3];
    if (!email) throw new Error('Supply the administrator email to cancel QA orders.');
    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkError) throw new Error('Cannot authenticate QA cleanup.');
    const auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: verifyError } = await auth.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (verifyError) throw new Error('Cannot establish cleanup session.');
    try {
      for (const o of orders) {
        if (!o.order_items.every((i) => i.product_id === state.product_id)) {
          failed = true;
          continue;
        }
        if (o.status !== 'cancelled') {
          const { error } = await auth.rpc('update_order', {
            p_id: o.id,
            p_status: 'cancelled',
            p_payment: 'unpaid',
            p_notes: 'Disposable browser QA cancellation',
          });
          if (error) {
            failed = true;
            continue;
          }
        }
        const { error } = await service.from('orders').delete().eq('id', o.id);
        if (error) failed = true;
      }
    } finally {
      await auth.auth.signOut({ scope: 'local' });
    }
  }
  const { error: productError } = await service
    .from('products')
    .delete()
    .eq('id', state.product_id);
  if (productError) failed = true;
  if (failed) throw new Error('Browser QA cleanup incomplete. State retained.');
  unlinkSync(file);
  console.log(
    `Browser QA cleaned up (${orders.length} test order(s)); original business settings and checkout state restored.`,
  );
} else throw new Error('Usage: node scripts/browser-fixture.mjs setup|cleanup [ADMIN_EMAIL]');
