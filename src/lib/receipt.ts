import { orderSummary } from './commerce';
import type { Order, OrderItem } from './types';

export type Receipt = Pick<
  Order,
  | 'reference'
  | 'status'
  | 'created_at'
  | 'subtotal'
  | 'delivery_fee'
  | 'discount'
  | 'total'
  | 'currency'
  | 'payment_status'
> & {
  message: string;
  customer: Pick<
    Order['customer'],
    'name' | 'phone' | 'address' | 'area' | 'city' | 'province' | 'instructions' | 'notes'
  >;
  items: Pick<OrderItem, 'name' | 'sku' | 'variant' | 'quantity' | 'unit_price' | 'line_total'>[];
};

// Explicit projection: never expose internal notes, idempotency hashes or database IDs.
export function orderReceipt(order: Order, items: OrderItem[]): Receipt {
  const c = order.customer;
  return {
    reference: order.reference,
    status: order.status,
    created_at: order.created_at,
    subtotal: order.subtotal,
    delivery_fee: order.delivery_fee,
    discount: order.discount,
    total: order.total,
    currency: order.currency,
    payment_status: order.payment_status,
    message: orderSummary(order, items),
    customer: {
      name: c.name,
      phone: c.phone,
      address: c.address,
      area: c.area,
      city: c.city,
      province: c.province,
      instructions: c.instructions,
      notes: c.notes,
    },
    items: items.map(({ name, sku, variant, quantity, unit_price, line_total }) => ({
      name,
      sku,
      variant,
      quantity,
      unit_price,
      line_total,
    })),
  };
}
