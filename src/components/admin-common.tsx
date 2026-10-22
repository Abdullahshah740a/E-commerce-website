'use client';
import { useState } from 'react';
export async function adminAction(action: string, data: unknown) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to save changes.');
  return result.data;
}
export function ArchiveButton({ id, permanent = false }: { id: string; permanent?: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="button secondary small"
        disabled={busy}
        onClick={async () => {
          if (
            !confirm(
              permanent
                ? 'Permanently delete this product and its media? Products with order history cannot be deleted.'
                : 'Archive this product? Customers will no longer be able to buy it.',
            )
          )
            return;
          setBusy(true);
          try {
            await adminAction(permanent ? 'delete-product' : 'archive', { id });
            window.location.reload();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to change product.');
          }
          setBusy(false);
        }}
      >
        {busy ? 'Please wait…' : permanent ? 'Delete' : 'Archive'}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
