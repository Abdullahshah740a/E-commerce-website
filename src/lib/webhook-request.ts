import { orderSummary } from './commerce';
import type { Order, OrderItem } from './types';

export type OrderEvent = {
  event_id: string;
  schema_version: number;
  event: string;
  money_unit: string;
  order: Omit<Order, 'internal_notes' | 'updated_at' | 'order_items'>;
  items: OrderItem[];
};

export function makeWebhookUrl(value: string | undefined) {
  try {
    const url = new URL(value || '');
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'hook.eu1.make.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function webhookPayload(event: OrderEvent) {
  const o = event.order;
  return {
    ...event,
    summary: orderSummary(o, event.items),
    totals: {
      currency: o.currency,
      subtotal: o.subtotal / 100,
      delivery_fee: o.delivery_fee / 100,
      discount: o.discount / 100,
      total: o.total / 100,
      unit: 'rupees',
    },
  };
}

export async function sendOrderWebhook(url: string, event: OrderEvent, send: typeof fetch = fetch) {
  const endpoint = makeWebhookUrl(url);
  if (!endpoint) return { ok: false, error: 'Webhook is not configured.' };
  try {
    const response = await send(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': event.event_id },
      body: JSON.stringify(webhookPayload(event)),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      cache: 'no-store',
    });
    // Never store the receiver's response body; it may contain echoed customer data.
    await response.body?.cancel();
    return response.ok
      ? { ok: true, error: null }
      : { ok: false, error: `Webhook returned HTTP ${response.status}.` };
  } catch {
    return { ok: false, error: 'Webhook connection failed or timed out.' };
  }
}
