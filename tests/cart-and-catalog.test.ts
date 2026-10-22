import { describe, expect, it } from 'vitest';
import { addCartItem, cartQuantity } from '@/lib/cart';
import { catalogParams } from '@/lib/catalog-params';
import type { CartItem } from '@/lib/types';

const item: CartItem = {
  variant_id: 'variant-1',
  product_id: 'product-1',
  name: 'Test product',
  slug: 'test-product',
  variant: 'King',
  sku: 'TEST',
  quantity: 1,
  expected_price: 10000,
  stock: 10,
};

describe('Cart limits and quantity recovery', () => {
  it('uses whole quantities and respects available stock and the order limit', () => {
    expect(cartQuantity(2.9, 10)).toBe(2);
    expect(cartQuantity(20, 3)).toBe(3);
    expect(cartQuantity(200, 300)).toBe(99);
    expect(cartQuantity(-5, 10)).toBe(1);
  });
  it('rejects invalid quantities and unavailable stock', () => {
    expect(cartQuantity(NaN, 10)).toBe(0);
    expect(cartQuantity(Infinity, 10)).toBe(0);
    expect(addCartItem([], { ...item, stock: 0 })).toBeNull();
  });
  it('reports a full cart rather than pretending another product was added', () => {
    const full = Array.from({ length: 30 }, (_, i) => ({ ...item, variant_id: `v-${i}` }));
    expect(addCartItem(full, item)).toBeNull();
    expect(addCartItem(full, { ...item, variant_id: 'v-0' })?.[0].quantity).toBe(2);
    expect(full[0].quantity).toBe(1);
  });
  it('merges variants and rejects a no-op when all available stock is already in the bag', () => {
    expect(addCartItem([item], { ...item, quantity: 2 })?.[0].quantity).toBe(3);
    expect(addCartItem([{ ...item, quantity: 10 }], item)).toBeNull();
  });
});

describe('Catalog URL validation', () => {
  it('accepts repeated URL parameters without passing arrays into the catalog RPC', () => {
    expect(catalogParams({ q: ['bedsheet', 'ignored'], page: ['2', '3'] })).toMatchObject({
      q: 'bedsheet',
      page: '2',
    });
  });
  it('normalizes fractional, oversized and invalid pages consistently', () => {
    expect(catalogParams({ page: '2.9' }).page).toBe('2');
    expect(catalogParams({ page: '999999' }).page).toBe('10000');
    for (const page of ['Infinity', 'NaN', '-2', ''])
      expect(catalogParams({ page }).page).toBe('1');
  });
  it('keeps malformed categories from failing the database UUID parser', () => {
    expect(catalogParams({ category: 'bad-id' }).category).toBe(
      '00000000-0000-0000-0000-000000000000',
    );
    const id = '11111111-1111-4111-8111-111111111111';
    expect(catalogParams({ category: id }).category).toBe(id);
  });
  it('defaults unknown sorts without changing legitimate filters', () => {
    expect(catalogParams({ sort: 'invalid', color: 'Sage' })).toMatchObject({
      sort: 'newest',
      color: 'Sage',
    });
    expect(catalogParams({ sort: 'price-asc' }).sort).toBe('price-asc');
  });
});
