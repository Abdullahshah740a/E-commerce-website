import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/supabase';
import { money } from '@/lib/commerce';
import { OrderEditor } from '@/components/order-editor';
import type { Order } from '@/lib/types';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const db = await adminDb();
  const { data, error } = await db
    .from('orders')
    .select('*,order_items(*)')
    .eq('id', (await params).id)
    .maybeSingle();
  if (error || !data) notFound();
  const o = data as Order;
  const c = o.customer;
  return (
    <>
      <span className="eyebrow">
        {o.status.replaceAll('_', ' ')} · {o.payment_status}
      </span>
      <h1 className="page-title">{o.reference}</h1>
      <p>
        Created {new Date(o.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })} ·
        Updated {new Date(o.updated_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
      </p>
      <div className="summary-card">
        <h2>{c.name}</h2>
        <p>
          {c.address}
          <br />
          {c.area}, {c.city}, {c.province}, Pakistan
        </p>
        <div className="row">
          <a className="button secondary small" href={`tel:+${c.phone}`}>
            Call +{c.phone}
          </a>
          <a
            className="button secondary small"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/${c.whatsapp || c.phone}`}
          >
            Contact on WhatsApp ↗
          </a>
        </div>
        {c.instructions && <p>Instructions: {c.instructions}</p>}
        {c.notes && <p>Customer notes: {c.notes}</p>}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product / variant</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {o.order_items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.name}
                  <small>
                    {i.variant || 'Standard'} · {i.sku}
                  </small>
                </td>
                <td>{i.quantity}</td>
                <td>{money(i.unit_price, o.currency)}</td>
                <td>{money(i.line_total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="order-totals">
        <p>
          Subtotal <b>{money(o.subtotal, o.currency)}</b>
        </p>
        <p>
          Delivery <b>{money(o.delivery_fee, o.currency)}</b>
        </p>
        <p>
          Discount <b>{money(o.discount, o.currency)}</b>
        </p>
        <p>
          Total · Cash on Delivery <b>{money(o.total, o.currency)}</b>
        </p>
      </div>
      <OrderEditor order={o} />
    </>
  );
}
