'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAction } from './admin-common';
import { statuses, type Order } from '@/lib/types';
export function OrderEditor({ order: o }: { order: Order }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        if (
          f.status === 'cancelled' &&
          o.status !== 'cancelled' &&
          !confirm('Cancel this order and return its stock? Cancelled orders cannot be reopened.')
        )
          return;
        setBusy(true);
        try {
          await adminAction('order', { id: o.id, ...f });
          setMessage('Order updated.');
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Unable to update order.');
        }
        setBusy(false);
      }}
    >
      <div className="form-grid">
        <label>
          Order status
          <select name="status" defaultValue={o.status}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment status
          <select name="payment_status" defaultValue={o.payment_status}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="wide">
          Internal notes (private)
          <textarea
            name="internal_notes"
            defaultValue={o.internal_notes}
            maxLength={5000}
            rows={5}
          />
        </label>
      </div>
      <button className="button" disabled={busy}>
        {busy ? 'Saving…' : 'Update order'}
      </button>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </form>
  );
}
