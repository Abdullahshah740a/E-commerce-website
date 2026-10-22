'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from './cart-provider';
import { money } from '@/lib/commerce';
import type { CartItem } from '@/lib/types';
export function CartPage() {
  const { items, ready, update, remove, replace } = useCart();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items.map((i) => i.variant_id)),
        signal: AbortSignal.timeout(30000),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const next: CartItem[] = data.items
        .filter((i: CartItem) => i.stock > 0)
        .map((i: CartItem) => ({
          ...i,
          quantity: Math.min(
            i.stock,
            items.find((old) => old.variant_id === i.variant_id)?.quantity ?? 1,
          ),
        }));
      replace(next);
      setMessage(
        'Bag updated with current prices and availability. Please review the totals before checkout.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to refresh your bag.');
    }
    setBusy(false);
  }
  if (!ready) return <p role="status">Loading your bag…</p>;
  if (!items.length)
    return (
      <div className="empty">
        <ShoppingBag size={42} strokeWidth={1} />
        <h1>Your bag is waiting for a little comfort.</h1>
        <p>Find something lovely for your home.</p>
        <Link href="/shop" className="button">
          Explore the collection
        </Link>
      </div>
    );
  return (
    <>
      <span className="eyebrow">YOUR NEXT HOME UPGRADE</span>
      <h1 className="page-title">Your shopping bag.</h1>
      <div className="checkout-grid">
        <div>
          {items.map((i) => (
            <article className="cart-line" key={i.variant_id}>
              <div>
                <Link href={`/products/${i.slug}`}>
                  <h3>{i.name}</h3>
                </Link>
                <p>
                  {i.variant || 'Standard'} · {i.sku}
                </p>
                <span>{money(i.expected_price)} each</span>
              </div>
              <label>
                Quantity
                <input
                  aria-label={`Quantity for ${i.name}`}
                  type="number"
                  min="1"
                  max={Math.min(99, i.stock)}
                  value={i.quantity}
                  onChange={(e) => update(i.variant_id, Number(e.target.value) || 1)}
                />
              </label>
              <b>{money(i.quantity * i.expected_price)}</b>
              <button
                className="icon-button"
                aria-label={`Remove ${i.name}`}
                onClick={() => remove(i.variant_id)}
              >
                <Trash2 size={18} />
              </button>
            </article>
          ))}
          <div className="row">
            <Link href="/shop" className="text-link">
              ← Continue shopping
            </Link>
            <button className="button secondary" onClick={refresh} disabled={busy}>
              {busy ? 'Updating…' : 'Refresh prices & stock'}
            </button>
          </div>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </div>
        <aside className="summary-card">
          <h2>A little closer to home.</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <b>{money(items.reduce((n, i) => n + i.quantity * i.expected_price, 0))}</b>
          </div>
          <p>
            Delivery calculated at checkout. Prices and availability are verified when you submit.
          </p>
          <Link className="button" href="/checkout">
            Continue to checkout →
          </Link>
          <small>Guest checkout · Cash on Delivery</small>
        </aside>
      </div>
    </>
  );
}
