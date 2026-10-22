import Link from 'next/link';
import { adminDb } from '@/lib/supabase';
import { money } from '@/lib/commerce';
import { statuses, type Order } from '@/lib/types';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const db = await adminDb();
  let q = db
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  const term = (params.q || '').replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, 100);
  if (term)
    q = q.or(
      `reference.ilike.%${term}%,customer->>name.ilike.%${term}%,customer->>phone.ilike.%${term}%`,
    );
  if (statuses.some((s) => s === params.status)) q = q.eq('status', params.status!);
  if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from))
    q = q.gte('created_at', `${params.from}T00:00:00+05:00`);
  if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to))
    q = q.lte('created_at', `${params.to}T23:59:59.999+05:00`);
  const { data, error, count } = await q.range((page - 1) * 30, page * 30 - 1);
  if (error) throw error;
  function href(n: number) {
    const u = new URLSearchParams(
      Object.entries(params).filter((v): v is [string, string] => v[1] !== undefined),
    );
    u.set('page', String(n));
    return `?${u}`;
  }
  return (
    <>
      <h1 className="page-title">Orders.</h1>
      <form className="catalog-filters">
        <label>
          Search
          <input name="q" placeholder="Order ID, name or phone" defaultValue={params.q} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={params.status || ''}>
            <option value="">All orders</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input name="from" type="date" defaultValue={params.from} />
        </label>
        <label>
          To
          <input name="to" type="date" defaultValue={params.to} />
        </label>
        <button className="button">Apply</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference / date</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(data as Order[]).map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}`}>{o.reference}</Link>
                  <small>
                    {new Date(o.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                  </small>
                </td>
                <td>
                  {o.customer.name}
                  <small>
                    {o.customer.phone} · {o.customer.city}
                  </small>
                </td>
                <td>
                  <span className="badge">{o.status.replaceAll('_', ' ')}</span>
                </td>
                <td>{o.payment_status}</td>
                <td>{money(o.total, o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && <p className="empty">No orders match these filters.</p>}
      <div className="pagination">
        {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
        <span>
          {count} orders · Page {page}
        </span>
        {page * 30 < (count ?? 0) && <Link href={href(page + 1)}>Next</Link>}
      </div>
    </>
  );
}
