import type { CartItem } from './types';

export function cartQuantity(quantity: number, stock: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(stock) || stock < 1) return 0;
  return Math.max(1, Math.min(99, Math.floor(stock), Math.floor(quantity)));
}

export function addCartItem(items: CartItem[], item: CartItem): CartItem[] | null {
  const existing = items.find((i) => i.variant_id === item.variant_id);
  if (!existing && items.length >= 30) return null;
  const quantity = cartQuantity((existing?.quantity ?? 0) + item.quantity, item.stock);
  if (!quantity || (existing && quantity <= existing.quantity)) return null;
  const next = { ...item, quantity };
  return existing
    ? items.map((i) => (i.variant_id === item.variant_id ? next : i))
    : [...items, next];
}
