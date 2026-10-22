import Link from 'next/link';
import { adminDb } from '@/lib/supabase';
import { money } from '@/lib/commerce';
import type { Order } from '@/lib/types';
export default async function Admin() {
  const db = await adminDb();
  const results = await Promise.all([
    db.from('products').select('id', { count: 'exact', head: true }),
    db.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
    db
      .from('variants')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .gt('stock', 0)
      .lte('stock', 5),
    db
      .from('variants')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .eq('stock', 0),
    db.from('orders').select('id', { count: 'exact', head: true }),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_confirmation'),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    db.from('orders').select('*').order('created_at', { ascending: false }).limit(8),
  ]);
  if (results.some((r) => r.error)) throw new Error('Unable to load dashboard');
  const labels = [
    'Total products',
    'Active products',
    'Low-stock variants',
    'Out-of-stock variants',
    'Total orders',
    'Pending confirmation',
    'Confirmed orders',
  ];
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">A CLEAR VIEW OF YOUR BUSINESS</span>
          <h1 className="page-title">Store overview.</h1>
        </div>
        <Link className="button" href="/admin/products/new">
          Add a product +
        </Link>
      </div>
      <div className="stats-grid">
        {labels.map((label, i) => (
          <div key={label} className="stat-card">
            <span>{label}</span>
            <strong>{results[i].count ?? 0}</strong>
          </div>
        ))}
      </div>
      <div className="notice">
        Stock is held when an order is saved. Review pending orders regularly; cancel abandoned or
        unverified orders to release stock. Low stock means 1–5 units per active variant.
      </div>
      <h2>Recent orders</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(results[7].data as unknown as Order[]).map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}`}>{o.reference}</Link>
                </td>
                <td>{o.customer.name}</td>
                <td>
                  <span className="badge">{o.status.replaceAll('_', ' ')}</span>
                </td>
                <td>{money(o.total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!results[7].data?.length && <p className="empty">No orders yet.</p>}
    </>
  );
}
