import { describe, it, expect } from 'vitest';
import { normalizePhone, money, deliveryFee, effectivePrice, orderSummary } from '@/lib/commerce';
import { checkoutSchema, productSchema, settingsSchema } from '@/lib/validation';
import { defaultSettingsForTest, orderForTest, itemsForTest } from './fixtures';
import { detectMedia } from '@/lib/uploads';
describe('Phone normalization', () => {
  it.each([
    ['0300 1234567', '923001234567'],
    ['+92 (300) 123-4567', '923001234567'],
    ['00923001234567', '923001234567'],
    ['+44 7911 123456', '447911123456'],
  ])('normalizes %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));
  it.each(['abc', '0001234', '03', '0300<script>1234567'])('rejects invalid input %s', (s) =>
    expect(normalizePhone(s)).toBe(''),
  );
});
describe('Pricing', () => {
  it('uses explicit fraction digits so server and browser currency rendering agree', () => {
    expect(money(100000)).toContain('1,000.00');
    expect(money(0)).toContain('0.00');
  });
  it('uses integer paisa and variant overrides, including free variants', () => {
    expect(effectivePrice({ price: 100000, sale_price: 90000 }, { price: 0 })).toBe(0);
    expect(effectivePrice({ price: 100000, sale_price: 90000 }, { price: null })).toBe(90000);
    expect(money(123456)).toContain('1,234.56');
  });
  it('applies city rules and thresholds, keeping unconfigured delivery distinct from free', () => {
    const s = {
      delivery_fee: 30000,
      city_fees: { lahore: 20000 },
      free_delivery_threshold: 500000,
    };
    expect(deliveryFee(s, 100000, ' Lahore ')).toBe(20000);
    expect(deliveryFee(s, 100000, 'Karachi')).toBe(30000);
    expect(deliveryFee(s, 100000, 'constructor')).toBe(30000);
    expect(deliveryFee(s, 500000, 'Lahore')).toBe(0);
    expect(deliveryFee({ ...s, delivery_fee: null }, 100000, 'Lahore')).toBeNull();
  });
});
describe('Checkout validation', () => {
  const input = {
    idempotency_key: '9e5238b0-372a-4cad-a9f3-65be1d680b4f',
    customer: orderForTest.customer,
    items: [
      { variant_id: '00000000-0000-4000-8000-000000000001', quantity: 2, expected_price: 100000 },
    ],
  };
  it('normalizes valid guest contact data', () =>
    expect(checkoutSchema.parse(input).customer.phone).toBe('923001234567'));
  it('rejects zero, fractional, negative and excessive quantities', () => {
    for (const quantity of [0, -1, 1.5, 100])
      expect(
        checkoutSchema.safeParse({ ...input, items: [{ ...input.items[0], quantity }] }).success,
      ).toBe(false);
  });
  it('rejects duplicate variants that could evade stock checks', () =>
    expect(
      checkoutSchema.safeParse({ ...input, items: [input.items[0], input.items[0]] }).success,
    ).toBe(false));
  it('rejects malformed addresses and forged negative prices', () => {
    expect(
      checkoutSchema.safeParse({ ...input, customer: { ...input.customer, address: 'x' } }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...input, items: [{ ...input.items[0], expected_price: -1 }] })
        .success,
    ).toBe(false);
  });
  it('strips browser totals and other untrusted properties', () =>
    expect(
      checkoutSchema.parse({ ...input, total: 1, discount: 999 }).items[0].expected_price,
    ).toBe(100000));
});
describe('Configuration validation', () => {
  it('blocks enabling checkout before delivery settings exist', () => {
    expect(
      settingsSchema.safeParse({ ...defaultSettingsForTest, checkout_enabled: true }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...defaultSettingsForTest,
        checkout_enabled: true,
        delivery_fee: 0,
        whatsapp: '',
      }).success,
    ).toBe(true);
  });
  it('rejects unsafe social links', () =>
    expect(
      settingsSchema.safeParse({ ...defaultSettingsForTest, facebook: 'javascript:alert(1)' })
        .success,
    ).toBe(false));
  it('rejects sale prices above regular prices', () => {
    expect(
      productSchema.safeParse({
        name: 'Sofa cover',
        slug: 'sofa-cover',
        sku: 'SC-1',
        category_id: '',
        short_description: '',
        description: '',
        price: 100,
        sale_price: 200,
        active: true,
        featured: false,
        tags: [],
        variants: [
          { sku: 'SC-1-A', size: '', color: '', design: '', price: null, stock: 1, active: true },
        ],
      }).success,
    ).toBe(false);
  });
});
describe('Order summaries', () => {
  it('contains every saved item, contact field and total', () => {
    const message = orderSummary(orderForTest, itemsForTest);
    for (const value of [
      'ORD-TEST',
      'Amina & Sons',
      '923001234567',
      'Street 4 & Block A',
      'Lahore',
      'Punjab',
      'Blue / King',
      'Bedding <special>',
      'Quantity: 2',
      'Quantity: 1',
      'Cash on Delivery',
      'Pending Confirmation',
    ])
      expect(message).toContain(value);
  });
});

describe('Media validation', () => {
  it('rejects SVG and disguised files', () => {
    expect(detectMedia(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
    expect(detectMedia(new Uint8Array([0, 0, 0]))).toBeNull();
  });
  it('recognizes JPEG, PNG and WebP magic bytes', () => {
    expect(detectMedia(new Uint8Array([255, 216, 255]))?.mime).toBe('image/jpeg');
    expect(detectMedia(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))?.mime).toBe('image/png');
    expect(detectMedia(new TextEncoder().encode('RIFF0000WEBP'))?.mime).toBe('image/webp');
  });
});
