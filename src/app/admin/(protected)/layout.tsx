import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/supabase';
import { logout } from '@/app/auth/actions';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Store administration', robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  try {
    await adminDb();
  } catch {
    redirect('/admin/login');
  }
  return (
    <div className="admin-layout container">
      <aside className="admin-nav">
        <span className="eyebrow">YOUR STORE</span>
        <Link href="/admin">Overview</Link>
        <Link href="/admin/products">Products & inventory</Link>
        <Link href="/admin/categories">Categories</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/settings">Store settings</Link>
        <Link href="/shop" target="_blank">
          View storefront ↗
        </Link>
        <form action={logout}>
          <button className="button secondary small">Sign out</button>
        </form>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
