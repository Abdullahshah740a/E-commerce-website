// Run only with explicit permission to send TWO QA notifications to the owner's
// configured Make → Discord scenario. Does not create website orders or change stock.
import { loadEnvFile } from 'node:process';
import { writeFileSync } from 'node:fs';
loadEnvFile('.env.local');
if (process.argv[2] !== '--send-two-approved-qa-messages')
  throw new Error('Explicit QA-message approval flag required.');
const endpoint = process.env.ORDER_WEBHOOK_URL;
if (!endpoint?.startsWith('https://hook.eu1.make.com/')) throw new Error('Make endpoint missing.');
const run = crypto.randomUUID().slice(0, 8);
const results = [];
for (const [index, label] of ['A', 'B'].entries()) {
  const reference = `QA-CARD-${label}-${run}`;
  const id = crypto.randomUUID();
  const summary = [
    'QA TEST — DO NOT DISPATCH',
    `Order ID: ${reference}`,
    `Fictional sample customer ${label}`,
    `Sample textile ${label} × ${index + 1}`,
    `Sample total: PKR ${(index + 1) * 1000}`,
    'Automation layout test only. This is not a customer order.',
    `This card must contain ONLY order ${reference}.`,
  ].join('\n');
  const payload = {
    schema_version: 1,
    event: 'order.placed',
    event_id: crypto.randomUUID(),
    money_unit: 'paisa',
    order: {
      id,
      reference,
      created_at: new Date().toISOString(),
      customer: { name: `QA SAMPLE ${label}`, notes: 'TEST ONLY — DO NOT DISPATCH' },
      total: (index + 1) * 100000,
      currency: 'PKR',
      status: 'pending_confirmation',
      payment_method: 'cod',
      payment_status: 'unpaid',
    },
    items: [
      {
        name: `QA SAMPLE TEXTILE ${label}`,
        sku: `QA-CARD-${label}`,
        quantity: index + 1,
        unit_price: 100000,
        line_total: (index + 1) * 100000,
      },
    ],
    totals: { currency: 'PKR', unit: 'rupees', total: (index + 1) * 1000 },
    summary,
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': payload.event_id },
    body: JSON.stringify(payload),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Make rejected QA ${label}: HTTP ${response.status}`);
  results.push({ reference, event_id: payload.event_id, accepted: true });
  console.log(`Make accepted fictional QA ${label}: ${reference}`);
}
writeFileSync('artifacts/discord-card-test.json', JSON.stringify({ run, results }, null, 2) + '\n');
console.log(
  'Two approved QA messages submitted. Verify separate Discord message IDs in Make run history.',
);
