'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from './cart-provider';
import { money, deliveryFee } from '@/lib/commerce';
import type { Settings } from '@/lib/types';
type Receipt = {
  reference: string;
  message: string;
  status: string;
  total: number;
  currency: string;
};
export function Checkout({
  settings: s,
  notificationsReady,
}: {
  settings: Settings;
  notificationsReady: boolean;
}) {
  const { items, ready, clear } = useCart();
  const router = useRouter();
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [copied, setCopied] = useState(false);
  const key = useRef('');
  const attempt = useRef('');
  const submitting = useRef(false);
  useEffect(() => {
    key.current = crypto.randomUUID();
    try {
      key.current = sessionStorage.getItem('checkout-key') || key.current;
      attempt.current = sessionStorage.getItem('checkout-fingerprint') || '';
      sessionStorage.setItem('checkout-key', key.current);
    } catch {
      /* Idempotency still works for retries during this page session. */
    }
  }, []);
  const subtotal = items.reduce((n, i) => n + i.expected_price * i.quantity, 0);
  const shipping = deliveryFee(s, subtotal, city);
  const unavailable = !s.checkout_enabled || shipping === null || !notificationsReady;
  useEffect(() => {
    // A checkout tab can retain server props from before environment/settings changes.
    // Refresh the server props while retaining the customer's existing form and cart.
    const refresh = () => router.refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    if (unavailable) refresh();
    const timer = unavailable ? window.setInterval(refresh, 15000) : undefined;
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [router, unavailable]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      submitting.current ||
      !ready ||
      !items.length ||
      !s.checkout_enabled ||
      shipping === null ||
      !notificationsReady
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError('');
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const data = {
      customer: form,
      items: items.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
        expected_price: i.expected_price,
      })),
    };
    try {
      const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(data)),
      );
      const fingerprint = Array.from(new Uint8Array(bytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (attempt.current && attempt.current !== fingerprint) key.current = crypto.randomUUID();
      attempt.current = fingerprint;
      try {
        sessionStorage.setItem('checkout-key', key.current);
        sessionStorage.setItem('checkout-fingerprint', fingerprint);
      } catch {}
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, idempotency_key: key.current }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Unable to save your order.');
      setReceipt(result);
      clear();
      try {
        sessionStorage.removeItem('checkout-key');
        sessionStorage.removeItem('checkout-fingerprint');
      } catch {}
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'TimeoutError'
          ? 'The connection timed out. Your order may already be saved. Retry with the same details to safely recover it without placing a duplicate order.'
          : e instanceof Error
            ? e.message
            : 'Unable to save your order. Please try again.',
      );
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  if (receipt)
    return (
      <div className="receipt">
        <span className="eyebrow">ORDER PLACED</span>
        <h1>Thank you. Your order is placed!</h1>
        <p>
          Your order <b>{receipt.reference}</b> has been placed successfully. Keep your receipt
          below. Our team will contact you to confirm delivery.
        </p>
        <p>
          Total payable on delivery: <b>{money(receipt.total, receipt.currency)}</b>
        </p>
        <div className="row">
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(receipt.message);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copied' : 'Copy complete summary'}
          </button>
        </div>
        <details open>
          <summary>Your order summary</summary>
          <textarea aria-label="Saved order summary" readOnly value={receipt.message} rows={18} />
        </details>
        <p>
          Payment method: Cash on Delivery. No payment has been taken. Keep this order reference for
          follow-up.
        </p>
        <Link className="text-link" href="/shop">
          Continue shopping →
        </Link>
      </div>
    );
  if (!ready) return <p>Loading your bag…</p>;
  if (!items.length)
    return (
      <div className="empty">
        <h1>Your bag is empty.</h1>
        <Link href="/shop" className="button">
          Browse products
        </Link>
      </div>
    );
  return (
    <>
      <div className="breadcrumb">
        <Link href="/cart">Shopping bag</Link> / Checkout
      </div>
      <span className="eyebrow">A FEW DETAILS, THEN YOU’RE HOME</span>
      <h1 className="page-title">Let’s get it to your door.</h1>
      <form className="checkout-grid" onSubmit={submit}>
        <div>
          <h2>Contact & delivery</h2>
          <div className="form-grid">
            <label>
              Full name
              <input name="name" required minLength={2} maxLength={100} autoComplete="name" />
            </label>
            <label>
              Mobile phone
              <input
                name="phone"
                type="tel"
                required
                maxLength={30}
                placeholder="03XX XXXXXXX"
                autoComplete="tel"
              />
            </label>
            <label>
              Province / region
              <select name="province" required defaultValue="">
                <option value="" disabled>
                  Select province / region
                </option>
                {[
                  'Punjab',
                  'Sindh',
                  'Khyber Pakhtunkhwa',
                  'Balochistan',
                  'Islamabad Capital Territory',
                  'Azad Jammu & Kashmir',
                  'Gilgit-Baltistan',
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              City
              <input
                name="city"
                required
                minLength={2}
                maxLength={100}
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              Area / locality
              <input name="area" required minLength={2} maxLength={150} />
            </label>
            <label className="wide">
              Complete delivery address
              <textarea
                name="address"
                required
                minLength={10}
                maxLength={500}
                autoComplete="street-address"
                rows={3}
              />
            </label>
            <label className="wide">
              Landmark or delivery instructions (optional)
              <input name="instructions" maxLength={500} />
            </label>
            <label className="wide">
              Order notes (optional)
              <textarea name="notes" maxLength={1000} rows={3} />
            </label>
          </div>
          <p className="muted">
            Country: {s.country}. Your contact and address are used to process and deliver your
            order.
          </p>
        </div>
        <aside className="summary-card">
          <h2>Your order</h2>
          {items.map((i) => (
            <div key={i.variant_id} className="summary-item">
              <div>
                <b>
                  {i.name} × {i.quantity}
                </b>
                <small>
                  {i.variant || 'Standard'} · {i.sku}
                </small>
                <small>{money(i.expected_price)} each</small>
              </div>
              <span>{money(i.quantity * i.expected_price)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Delivery</span>
            <span>{shipping === null ? 'Not configured' : money(shipping)}</span>
          </div>
          <div className="summary-row">
            <span>Discount</span>
            <span>{money(0)}</span>
          </div>
          <div className="summary-row total">
            <b>Total payable</b>
            <b>{shipping === null ? '—' : money(subtotal + shipping)}</b>
          </div>
          <div className="payment-box">
            <b>Cash on Delivery</b>
            <p>
              Pay when your order arrives. Your order remains pending until our team confirms it by
              phone.
            </p>
          </div>
          {(!s.checkout_enabled || shipping === null || !notificationsReady) && (
            <p className="notice">
              {!notificationsReady || shipping === null
                ? 'Ordering is temporarily unavailable. Please contact the store or try again later.'
                : 'Online orders are temporarily paused. Please contact the store or try again later.'}{' '}
              <button type="button" className="text-link" onClick={() => router.refresh()}>
                Check again
              </button>
            </p>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
              <br />
              <Link href="/cart">Review and refresh your bag</Link>
            </div>
          )}
          <button
            className="button"
            type="submit"
            disabled={busy || !s.checkout_enabled || shipping === null || !notificationsReady}
          >
            {busy ? 'Placing your order…' : 'Confirm order'}
          </button>
          <small>
            By confirming, you agree to our <Link href="/policies">store policies</Link>.
          </small>
        </aside>
      </form>
    </>
  );
}
