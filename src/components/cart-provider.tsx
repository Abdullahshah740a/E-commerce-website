'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { CartItem } from '@/lib/types';
import { addCartItem, cartQuantity } from '@/lib/cart';
type CartContextType = {
  items: CartItem[];
  ready: boolean;
  add: (item: CartItem) => boolean;
  update: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};
const Context = createContext<CartContextType | null>(null);
const storageKey = 'textile-cart-v1';
const itemSchema = z.object({
  variant_id: z.uuid(),
  product_id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  variant: z.string(),
  sku: z.string(),
  quantity: z.number().int().min(1).max(99),
  expected_price: z.number().int().min(0),
  image: z.string().optional(),
  stock: z.number().int().min(0),
});
const serverSnapshot = { items: [] as CartItem[], ready: false };
let cached = serverSnapshot;
let cachedRaw: string | null | undefined;
let memoryOnly = false;
const listeners = new Set<() => void>();
function getSnapshot() {
  if (typeof window === 'undefined') return serverSnapshot;
  if (memoryOnly && cached.ready) return cached;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return cached.ready ? cached : (cached = { items: [], ready: true });
  }
  if (raw !== cachedRaw || !cached.ready) {
    cachedRaw = raw;
    try {
      const parsed = z
        .array(itemSchema)
        .max(30)
        .safeParse(JSON.parse(raw || '[]'));
      cached = { items: parsed.success ? parsed.data : [], ready: true };
    } catch {
      cached = { items: [], ready: true };
    }
  }
  return cached;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function write(items: CartItem[]) {
  cached = { items, ready: true };
  cachedRaw = JSON.stringify(items);
  try {
    localStorage.setItem(storageKey, cachedRaw);
  } catch {
    memoryOnly = true;
  }
  listeners.forEach((fn) => fn());
}
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { items, ready } = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  function add(item: CartItem) {
    const next = addCartItem(getSnapshot().items, item);
    if (!next) return false;
    write(next);
    return true;
  }
  return (
    <Context.Provider
      value={{
        items,
        ready,
        add,
        update: (id, q) =>
          write(
            getSnapshot().items.map((i) =>
              i.variant_id === id ? { ...i, quantity: cartQuantity(q, i.stock) || 1 } : i,
            ),
          ),
        remove: (id) => write(getSnapshot().items.filter((i) => i.variant_id !== id)),
        clear: () => write([]),
        replace: write,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCart() {
  const c = useContext(Context);
  if (!c) throw new Error('Cart context missing');
  return c;
}
