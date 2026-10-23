'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Printer } from 'lucide-react';
import { money } from '@/lib/commerce';
import type { Receipt } from '@/lib/receipt';

export function OrderReceipt({
  receipt: r,
  businessName,
}: {
  receipt: Receipt;
  businessName: string;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const date = new Intl.DateTimeFormat('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Karachi',
  }).format(new Date(r.created_at));
  const amount = (value: number) => money(value, r.currency);
  return (
    <div className="receipt">
      <div className="receipt-intro" role="status">
        <span className="receipt-check">
          <Check size={25} aria-hidden="true" />
        </span>
        <span className="eyebrow">ORDER PLACED</span>
        <h1 ref={heading} tabIndex={-1}>
          Thank you for your order.
        </h1>
        <p>Your order is saved. Our team will contact you to confirm delivery.</p>
      </div>
      <article className="receipt-card" aria-label="Order receipt">
        <header className="receipt-header">
          <div>
            <span className="eyebrow">{businessName}</span>
            <h2>Order receipt</h2>
          </div>
          <span className="receipt-badge">{r.status.replaceAll('_', ' ')}</span>
        </header>
        <dl className="receipt-meta">
          <div>
            <dt>Order number</dt>
            <dd>{r.reference}</dd>
          </div>
          <div>
            <dt>Placed on · Pakistan time</dt>
            <dd>
              <time dateTime={r.created_at}>{date}</time>
            </dd>
          </div>
        </dl>
        <div className="receipt-delivery">
          <section aria-labelledby="receipt-delivery-title">
            <h3 id="receipt-delivery-title">Deliver to</h3>
            <p>
              <strong>{r.customer.name}</strong>
            </p>
            <p className="receipt-preserve">{r.customer.address}</p>
            <p>
              {[r.customer.area, r.customer.city, r.customer.province].filter(Boolean).join(', ')}
            </p>
            <p>Pakistan</p>
            <p className="receipt-phone">{r.customer.phone}</p>
          </section>
          <section aria-labelledby="receipt-payment-title">
            <h3 id="receipt-payment-title">Payment</h3>
            <p>
              <strong>Cash on Delivery</strong>
            </p>
            <p>
              {r.payment_status === 'unpaid'
                ? 'No payment has been taken.'
                : `Payment status: ${r.payment_status}`}
            </p>
            {r.payment_status === 'unpaid' && <p>Please pay when your order arrives.</p>}
          </section>
        </div>
        <section className="receipt-items" aria-labelledby="receipt-items-title">
          <h3 id="receipt-items-title">Your items</h3>
          <ul>
            {r.items.map((item, index) => (
              <li key={`${item.sku}-${index}`}>
                <div>
                  <h4>{item.name}</h4>
                  <p>{item.variant}</p>
                  <p className="receipt-sku">SKU: {item.sku}</p>
                  <p>
                    Qty {item.quantity} <span aria-hidden="true">×</span> {amount(item.unit_price)}
                  </p>
                </div>
                <strong className="receipt-item-total">{amount(item.line_total)}</strong>
              </li>
            ))}
          </ul>
        </section>
        <dl className="receipt-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{amount(r.subtotal)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>{r.delivery_fee === 0 ? 'Free' : amount(r.delivery_fee)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>
              {r.discount > 0 ? '−' : ''}
              {amount(r.discount)}
            </dd>
          </div>
          <div className="receipt-grand-total">
            <dt>{r.payment_status === 'unpaid' ? 'Total payable on delivery' : 'Order total'}</dt>
            <dd>{amount(r.total)}</dd>
          </div>
        </dl>
        {(r.customer.instructions || r.customer.notes) && (
          <section className="receipt-notes" aria-label="Order notes">
            {r.customer.instructions && (
              <div>
                <h3>Delivery instructions</h3>
                <p className="receipt-preserve">{r.customer.instructions}</p>
              </div>
            )}
            {r.customer.notes && (
              <div>
                <h3>Your note</h3>
                <p className="receipt-preserve">{r.customer.notes}</p>
              </div>
            )}
          </section>
        )}
        <footer className="receipt-footer">
          Keep this receipt and order number for any questions about your delivery.
        </footer>
      </article>
      <div className="receipt-actions">
        <button type="button" className="button secondary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Print / save PDF
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(r.message);
              setCopyStatus('Order summary copied.');
            } catch {
              setCopyStatus('Copy unavailable. You can print or save your receipt instead.');
            }
          }}
        >
          <Copy size={16} aria-hidden="true" /> Copy summary
        </button>
        <Link className="text-link" href="/shop">
          Continue shopping →
        </Link>
      </div>
      <p className="receipt-copy-status" role="status">
        {copyStatus}
      </p>
    </div>
  );
}
