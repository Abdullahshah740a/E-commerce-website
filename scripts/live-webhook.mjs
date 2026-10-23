// Sends ONE clearly fictional QA order to the configured Make webhook via checkout.
// No email/WhatsApp/Discord messages. Cleans up only its own test records.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
loadEnvFile('.env.local');
const email = process.argv[2];
if (!email) throw new Error('Usage: node scripts/live-webhook.mjs ADMIN_EMAIL');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const run = crypto.randomUUID();
let product, orderId;
const key = crypto.randomUUID();
try {
  const { data: link, error: loginError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  assert.equal(loginError, null);
  assert.equal(
    (await auth.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token }))
      .error,
    null,
  );
  const { data: p, error: productError } = await service
    .from('products')
    .insert({
      name: 'QA ONLY - MAKE WEBHOOK TEST - DO NOT DISPATCH',
      slug: `qa-webhook-${run}`,
      sku: `QA-WEBHOOK-${run}`,
      price: 100000,
      active: true,
    })
    .select('id')
    .single();
  assert.equal(productError, null);
  product = p.id;
  const { data: variants, error: variantError } = await service
    .from('variants')
    .insert([
      { product_id: product, sku: `QA-A-${run}`, size: 'King', color: 'Sage', stock: 3 },
      {
        product_id: product,
        sku: `QA-B-${run}`,
        size: 'Double',
        color: 'Cream',
        price: 150000,
        stock: 2,
      },
    ])
    .select('*');
  assert.equal(variantError, null);
  const customer = {
    name: 'QA ONLY - WEBHOOK TEST',
    phone: '923490896871',
    address: 'QA ONLY - FICTIONAL TEST ADDRESS - DO NOT DISPATCH',
    city: 'QA Test City',
    area: 'QA Test Area',
    province: 'Punjab',
    notes: `QA_WEBHOOK ${run} - Test notification only. Do not dispatch.`,
  };
  const input = {
    idempotency_key: key,
    customer,
    items: variants.map((v) => ({
      variant_id: v.id,
      quantity: 1,
      expected_price: v.price ?? 100000,
    })),
  };
  const place = async () => {
    const response = await fetch(base + '/api/checkout', {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200, `Checkout returned ${response.status}`);
    return response.json();
  };
  const receipt = await place();
  assert.ok(receipt.reference);
  assert.equal(receipt.link, undefined);
  assert.equal(receipt.status, 'pending_confirmation');
  assert.ok(receipt.message.includes('King'));
  assert.ok(receipt.message.includes('Double'));
  console.log(
    'PASS: Confirm order returns an immediate saved receipt with all items and no WhatsApp link.',
  );
  const { data: order, error: orderError } = await service
    .from('orders')
    .select('id,total')
    .eq('idempotency_key', key)
    .single();
  assert.equal(orderError, null);
  orderId = order.id;
  assert.equal(order.total, receipt.total);
  let job;
  for (let i = 0; i < 60; i++) {
    const { data, error } = await service
      .from('order_webhooks')
      .select('status,attempts,event_id,payload,last_error')
      .eq('order_id', orderId)
      .single();
    assert.equal(error, null);
    job = data;
    if (job.status === 'delivered' || (job.status === 'failed' && job.attempts >= 3)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(job.status, 'delivered', job.last_error || 'Make notification did not complete.');
  assert.equal(job.payload.items.length, 2);
  assert.equal(job.payload.order.customer.notes, customer.notes);
  console.log(`PASS: Make accepted the full QA order payload (${job.attempts} attempt(s)).`);
  const retry = await place();
  assert.equal(retry.reference, receipt.reference);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const { data: replay } = await service
    .from('order_webhooks')
    .select('event_id,attempts,status')
    .eq('order_id', orderId)
    .single();
  assert.equal(replay.event_id, job.event_id);
  assert.equal(replay.attempts, job.attempts);
  assert.equal(replay.status, 'delivered');
  console.log(
    'PASS: Identical checkout retry reuses the receipt and does not resend a delivered notification.',
  );
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : 'Webhook verification failed.'}`);
  process.exitCode = 1;
} finally {
  // Recover a saved order even if the response was lost.
  if (product) {
    const { data: saved } = await service
      .from('orders')
      .select('id')
      .eq('idempotency_key', key)
      .maybeSingle();
    orderId ||= saved?.id;
  }
  let cleanupFailed = false;
  if (orderId) {
    const cancelled = await auth.rpc('update_order', {
      p_id: orderId,
      p_status: 'cancelled',
      p_payment: 'unpaid',
      p_notes: `QA webhook cleanup ${run}`,
    });
    if (cancelled.error) cleanupFailed = true;
    else if (
      (
        await service
          .from('orders')
          .delete()
          .eq('id', orderId)
          .contains('customer', {
            notes: `QA_WEBHOOK ${run} - Test notification only. Do not dispatch.`,
          })
      ).error
    )
      cleanupFailed = true;
  }
  if (
    product &&
    (await service.from('products').delete().eq('id', product).eq('slug', `qa-webhook-${run}`))
      .error
  )
    cleanupFailed = true;
  await auth.auth.signOut({ scope: 'local' });
  if (cleanupFailed) {
    console.error('QA cleanup incomplete. Review QA-WEBHOOK records.');
    process.exitCode = 1;
  } else
    console.log(
      'QA order/product/notification cleaned up; store settings and owner demo products preserved.',
    );
}
