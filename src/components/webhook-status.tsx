'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAction } from './admin-common';

export function WebhookStatus({
  orderId,
  delivery,
}: {
  orderId: string;
  delivery: {
    status: string;
    attempts: number;
    last_error: string | null;
    delivered_at: string | null;
  } | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  return (
    <section className="summary-card">
      <h2>Make order notification</h2>
      <p>
        Status: <b>{delivery?.status || 'No notification queued'}</b>
        {delivery ? ` · ${delivery.attempts} attempt(s)` : ''}
      </p>
      {delivery?.last_error && <p role="status">{delivery.last_error}</p>}
      {delivery && delivery.status !== 'delivered' && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage('');
            try {
              const state = await adminAction('retry-webhook', { id: orderId });
              setMessage(
                state === 'delivered'
                  ? 'Make accepted the order notification.'
                  : 'Delivery checked. Refresh to see its current status.',
              );
              router.refresh();
            } catch {
              setMessage('Unable to retry. Please refresh and try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Sending…' : 'Retry notification'}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
