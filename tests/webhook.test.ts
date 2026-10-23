import { describe, it, expect, vi } from 'vitest';
import {
  makeWebhookUrl,
  sendOrderWebhook,
  webhookPayload,
  type OrderEvent,
} from '@/lib/webhook-request';
import { orderForTest, itemsForTest } from './fixtures';

const {
  internal_notes: _notes,
  updated_at: _updated,
  order_items: _items,
  ...order
} = orderForTest;
const event: OrderEvent = {
  event_id: 'test-event',
  event: 'order.placed',
  schema_version: 1,
  money_unit: 'paisa',
  order,
  items: itemsForTest,
};
const url = 'https://hook.eu1.make.com/test-only';

describe('Make order notifications', () => {
  it('allows only the configured HTTPS Make region without redirects or credentials', () => {
    expect(makeWebhookUrl(url)).toBe(url);
    for (const value of [
      undefined,
      'http://hook.eu1.make.com/x',
      'https://evil.test/x',
      'https://hook.eu1.make.com.evil.test/x',
      'https://user:pass@hook.eu1.make.com/x',
    ])
      expect(makeWebhookUrl(value)).toBeNull();
  });
  it('includes all saved customer/items data and explicit rupee totals', () => {
    const payload = webhookPayload(event);
    expect(payload.order.customer).toEqual(orderForTest.customer);
    expect(payload.items).toEqual(itemsForTest);
    expect(payload.totals.total).toBe(order.total / 100);
    expect(payload.totals.unit).toBe('rupees');
    expect(payload.money_unit).toBe('paisa');
    expect(payload.summary).toContain(order.reference);
    for (const item of itemsForTest) expect(payload.summary).toContain(item.sku);
    expect(payload.order).not.toHaveProperty('internal_notes');
    expect(payload.order).not.toHaveProperty('internal_notes', _notes);
    expect(payload.order).not.toHaveProperty('updated_at', _updated);
    expect(payload.order).not.toHaveProperty('order_items', _items);
  });
  it('posts stable event identity as JSON and accepts a queued 202 response', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('Accepted', { status: 202 }));
    expect((await sendOrderWebhook(url, event, send)).ok).toBe(true);
    const [endpoint, options] = send.mock.calls[0];
    expect(endpoint).toBe(url);
    expect(options?.redirect).toBe('error');
    expect(options?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Idempotency-Key': event.event_id,
    });
    expect(JSON.parse(String(options?.body)).event_id).toBe(event.event_id);
  });
  it('records safe errors without saving echoed customer data or the endpoint', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private echo', { status: 500 }));
    expect(await sendOrderWebhook(url, event, send)).toEqual({
      ok: false,
      error: 'Webhook returned HTTP 500.',
    });
    send.mockRejectedValueOnce(new Error(`Connection to ${url} failed`));
    expect((await sendOrderWebhook(url, event, send)).error).toBe(
      'Webhook connection failed or timed out.',
    );
  });
  it('does not send to an invalid endpoint', async () => {
    const send = vi.fn<typeof fetch>();
    expect((await sendOrderWebhook('http://localhost', event, send)).ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
