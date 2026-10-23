import type { Order, OrderItem, Settings, Variant, Product } from './types';
export const money = (amount: number, currency = 'PKR') =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
export function normalizePhone(input: string) {
  const digits = input.replace(/[\s()+.-]/g, '');
  if (/^03\d{9}$/.test(digits)) return '92' + digits.slice(1);
  if (/^0092\d{10}$/.test(digits)) return digits.slice(2);
  if (/^[1-9]\d{7,14}$/.test(digits)) return digits;
  return '';
}
export function effectivePrice(
  p: Pick<Product, 'price' | 'sale_price'>,
  v: Pick<Variant, 'price'>,
) {
  return v.price ?? p.sale_price ?? p.price;
}
export function deliveryFee(
  s: Pick<Settings, 'delivery_fee' | 'city_fees' | 'free_delivery_threshold'>,
  subtotal: number,
  city: string,
) {
  if (s.delivery_fee === null) return null;
  if (s.free_delivery_threshold !== null && subtotal >= s.free_delivery_threshold) return 0;
  const key = city.trim().toLowerCase();
  return Object.hasOwn(s.city_fees, key) ? s.city_fees[key] : s.delivery_fee;
}
export function orderSummary(
  order: Pick<
    Order,
    | 'reference'
    | 'created_at'
    | 'customer'
    | 'subtotal'
    | 'delivery_fee'
    | 'discount'
    | 'total'
    | 'currency'
  >,
  items: OrderItem[],
) {
  const c = order.customer;
  return [
    'NEW WEBSITE ORDER',
    `Order ID: ${order.reference}`,
    `Date: ${new Date(order.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}`,
    '',
    'CUSTOMER DETAILS',
    `Name: ${c.name}`,
    `Phone: ${c.phone}`,
    c.whatsapp ? `WhatsApp: ${c.whatsapp}` : '',
    `Address: ${c.address}, ${c.area}`,
    `City: ${c.city}`,
    `Province: ${c.province}`,
    c.instructions ? `Landmark/Instructions: ${c.instructions}` : '',
    '',
    'ORDER ITEMS',
    ...items.map(
      (i, n) =>
        `${n + 1}. ${i.name}\n   SKU: ${i.sku}\n   Variant: ${i.variant || 'Standard'}\n   Quantity: ${i.quantity}\n   Unit Price: ${money(i.unit_price, order.currency)}\n   Item Total: ${money(i.line_total, order.currency)}`,
    ),
    '',
    `Subtotal: ${money(order.subtotal, order.currency)}`,
    `Delivery Fee: ${money(order.delivery_fee, order.currency)}`,
    `Discount: ${money(order.discount, order.currency)}`,
    `TOTAL PAYABLE: ${money(order.total, order.currency)}`,
    'Payment Method: Cash on Delivery',
    'Order Status: Pending Confirmation',
    c.notes ? `Customer Notes: ${c.notes}` : '',
    'Please contact the customer to verify and confirm this order.',
  ]
    .filter((v) => v !== '')
    .join('\n');
}
