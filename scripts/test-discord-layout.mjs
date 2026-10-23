// Sends ONE fictional notification only after the owner approves this exact test.
// No website order, inventory change or customer record is created.
import { loadEnvFile } from 'node:process';
import { writeFileSync } from 'node:fs';
loadEnvFile('.env.local');
const run = crypto.randomUUID().slice(0, 8);
const reference = `QA-LAYOUT-${run}`;
const customer = {
  name: 'QA TEST — DO NOT DISPATCH',
  phone: '920000000000',
  address: 'FICTIONAL ADDRESS — AUTOMATION TEST ONLY',
  area: 'QA Sample Area',
  city: 'QA Sample City',
  province: 'Punjab',
  instructions: 'Test notification only. Never dispatch this order.',
  notes: 'Fictional formatting check: two products, separate phone field, no duplicate summary.',
};
const items = [
  {
    name: 'QA Sage Bedsheet',
    sku: 'QA-SAGE-KING',
    variant: 'King / Sage / Stripe',
    quantity: 2,
    unit_price: 125000,
    line_total: 250000,
  },
  {
    name: 'QA Cream Cushion Cover',
    sku: 'QA-CREAM-STD',
    variant: 'Standard / Cream / Plain',
    quantity: 1,
    unit_price: 85000,
    line_total: 85000,
  },
];
const order = {
  id: crypto.randomUUID(),
  reference,
  customer,
  created_at: new Date().toISOString(),
  subtotal: 335000,
  delivery_fee: 10000,
  discount: 0,
  total: 345000,
  currency: 'PKR',
  status: 'pending_confirmation',
  payment_method: 'cod',
  payment_status: 'unpaid',
};
const money = (value) =>
  `Rs ${(value / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const summary = [
  'NEW WEBSITE ORDER',
  `Order ID: ${reference}`,
  `Date: ${order.created_at}`,
  'CUSTOMER DETAILS',
  `Name: ${customer.name}`,
  `Phone: ${customer.phone}`,
  `Address: ${customer.address}, ${customer.area}`,
  `City: ${customer.city}`,
  `Province: ${customer.province}`,
  `Landmark/Instructions: ${customer.instructions}`,
  'ORDER ITEMS',
  ...items.map(
    (item, i) =>
      `${i + 1}. ${item.name}\n   SKU: ${item.sku}\n   Variant: ${item.variant}\n   Quantity: ${item.quantity}\n   Unit Price: ${money(item.unit_price)}\n   Item Total: ${money(item.line_total)}`,
  ),
  `Subtotal: ${money(order.subtotal)}`,
  `Delivery Fee: ${money(order.delivery_fee)}`,
  `Discount: ${money(order.discount)}`,
  `TOTAL PAYABLE: ${money(order.total)}`,
  'Payment Method: Cash on Delivery',
  'Order Status: Pending Confirmation',
  `Customer Notes: ${customer.notes}`,
].join('\n');
const payload = {
  event: 'order.placed',
  schema_version: 1,
  event_id: crypto.randomUUID(),
  money_unit: 'paisa',
  order,
  items,
  summary,
  totals: {
    currency: 'PKR',
    unit: 'rupees',
    subtotal: 3350,
    delivery_fee: 100,
    discount: 0,
    total: 3450,
  },
};
writeFileSync('artifacts/discord-layout-qa.json', JSON.stringify(payload, null, 2) + '\n');
if (process.argv[2] !== '--send-one-approved-qa-message') {
  console.log('Fictional payload prepared locally. Nothing sent.');
  process.exit(0);
}
const endpoint = new URL(process.env.ORDER_WEBHOOK_URL || '');
if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'hook.eu1.make.com')
  throw new Error('Make configuration missing.');
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': payload.event_id },
  body: JSON.stringify(payload),
  redirect: 'error',
  signal: AbortSignal.timeout(15000),
});
await response.body?.cancel();
if (!response.ok) throw new Error(`Make rejected QA: HTTP ${response.status}`);
console.log(`Make accepted one fictional notification: ${reference}`);
