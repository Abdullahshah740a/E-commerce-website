import { describe, expect, it } from 'vitest';
import { orderReceipt } from '@/lib/receipt';
import { itemsForTest, orderForTest } from './fixtures';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderReceipt } from '@/components/order-receipt';

describe('customer receipt', () => {
  it('renders an uneditable card, escaped customer text and readable charges', () => {
    const html = renderToStaticMarkup(
      createElement(OrderReceipt, {
        businessName: 'Rahat Bedsheets',
        receipt: orderReceipt(orderForTest, itemsForTest),
      }),
    );
    expect(html).toContain('aria-label="Order receipt"');
    expect(html).toContain('Bedding &lt;special&gt;');
    expect(html).toContain('Total payable on delivery');
    expect(html).toContain('3,300.00');
    expect(html).not.toMatch(/<(textarea|input|select)\b|contenteditable=/i);
    expect(html).toContain('Print / save PDF');
  });
  it('uses the saved order snapshot for items, charges and delivery details', () => {
    const r = orderReceipt(orderForTest, itemsForTest);
    expect(r.total).toBe(330000);
    expect(r.subtotal + r.delivery_fee - r.discount).toBe(r.total);
    expect(r.items).toHaveLength(2);
    expect(r.items.reduce((sum, item) => sum + item.line_total, 0)).toBe(r.subtotal);
    expect(r.customer.instructions).toBe('Near the park');
    expect(r.created_at).toBe(orderForTest.created_at);
    expect(r.message).toContain(orderForTest.reference);
  });
  it('excludes internal and unexpected database fields at every level', () => {
    const r = orderReceipt(
      {
        ...orderForTest,
        internal_notes: 'PRIVATE NOTE',
        idempotency_hash: 'SECRET',
      } as typeof orderForTest,
      itemsForTest,
    );
    expect(r).not.toHaveProperty('internal_notes');
    expect(r).not.toHaveProperty('idempotency_hash');
    expect(r).not.toHaveProperty('id');
    expect(r.customer).not.toHaveProperty('whatsapp');
    expect(r.items[0]).not.toHaveProperty('order_id');
    expect(JSON.stringify(r)).not.toContain('PRIVATE NOTE');
  });
});
