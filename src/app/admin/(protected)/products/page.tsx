import Link from 'next/link';
import { adminDb } from '@/lib/supabase';
import { ArchiveButton } from '@/components/admin-common';
import { money } from '@/lib/commerce';
import type { Product } from '@/lib/types';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const db = await adminDb();
  let q = db
    .from('products')
    .select('*,variants(*)', { count: 'exact' })
    .order('created_at', { ascending: false });
  const term = (params.q || '').replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, 100);
  if (term) q = q.ilike('name', `%${term}%`);
  const { data, error, count } = await q.range((page - 1) * 30, page * 30 - 1);
  if (error) throw error;
  return (
    <>
      <div className="section-heading">
        <h1 className="page-title">Products.</h1>
        <Link href="/admin/products/new" className="button">
          Add product +
        </Link>
      </div>
      <form className="row">
        <input
          name="q"
          defaultValue={params.q}
          aria-label="Search products"
          placeholder="Search products…"
        />
        <button className="button secondary">Search</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data as Product[]).map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                  <small>{p.sku}</small>
                </td>
                <td>{money(p.sale_price ?? p.price)}</td>
                <td>{p.variants.filter((v) => v.active).reduce((n, v) => n + v.stock, 0)}</td>
                <td>{p.active ? 'Active' : 'Draft / archived'}</td>
                <td>
                  <div className="row">
                    <Link href={`/admin/products/${p.id}`} className="text-link">
                      Edit
                    </Link>
                    <ArchiveButton id={p.id} />
                    <ArchiveButton id={p.id} permanent />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && (
        <div className="empty">
          <h2>Your collection starts here.</h2>
          <p>Add your first product, then upload its photos and set variant stock.</p>
        </div>
      )}
      <div className="pagination">
        {page > 1 && <Link href={`?page=${page - 1}&q=${encodeURIComponent(term)}`}>Previous</Link>}
        <span>
          {count} products · Page {page}
        </span>
        {page * 30 < (count ?? 0) && (
          <Link href={`?page=${page + 1}&q=${encodeURIComponent(term)}`}>Next</Link>
        )}
      </div>
    </>
  );
}
