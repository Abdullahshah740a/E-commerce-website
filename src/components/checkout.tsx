'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from './cart-provider';
import { money, deliveryFee } from '@/lib/commerce';
import type { Settings } from '@/lib/types';
type Receipt = {
  reference: string;
  message: string;
  link: { url: string; copyRequired: boolean } | null;
  total: number;
  currency: string;
};
export function Checkout({ settings: s }: { settings: Settings }) {
  const { items, ready, clear } = useCart();
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
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      submitting.current ||
      !ready ||
      !items.length ||
      !s.checkout_enabled ||
      shipping === null ||
      !s.whatsapp
    )
      return;
    submitting.current = true;
    let popup: Window | null = null;
    try {
      popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
    } catch {
      /* Checkout can continue using the receipt's WhatsApp link. */
    }
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
      try {
        if (result.link && !result.link.copyRequired && popup)
          popup.location.replace(result.link.url);
        else popup?.close();
      } catch {
        popup?.close(); /* The saved receipt still provides a retry link. */
      }
    } catch (e) {
      popup?.close();
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
        <span className="eyebrow">ORDER SAVED · PENDING CONFIRMATION</span>
        <h1>One more step: send your message.</h1>
        <p>
          Your order <b>{receipt.reference}</b> has been saved. Open WhatsApp and tap <b>Send</b>.
          Our team will call to confirm availability and delivery.
        </p>
        <p>
          Total payable on delivery: <b>{money(receipt.total, receipt.currency)}</b>
        </p>
        {receipt.link?.copyRequired && (
          <p className="notice">
            This order is too long for a reliable WhatsApp link. Copy the full summary below, then
            paste it into WhatsApp.
          </p>
        )}
        <div className="row">
          {receipt.link && (
            <a href={receipt.link.url} target="_blank" rel="noreferrer" className="button">
              Open / retry WhatsApp ↗
            </a>
          )}
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
          Opening WhatsApp does not send the message or confirm your order. Keep this order
          reference for follow-up.
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
              WhatsApp number (if different)
              <input name="whatsapp" type="tel" maxLength={30} />
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
          {(!s.checkout_enabled || shipping === null || !s.whatsapp) && (
            <p className="notice">
              {!s.whatsapp || shipping === null
                ? 'Ordering is unavailable because delivery or WhatsApp is not configured. Please contact the store.'
                : 'Online orders are temporarily paused. Please contact the store or try again later.'}
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
            disabled={busy || !s.checkout_enabled || shipping === null || !s.whatsapp}
          >
            {busy ? 'Saving your order…' : 'Save order & open WhatsApp ↗'}
          </button>
          <small>
            You must tap Send in WhatsApp. <Link href="/policies">Store policies</Link>
          </small>
        </aside>
      </form>
    </>
  );
}
