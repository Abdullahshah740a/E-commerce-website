import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="empty container">
      <span className="eyebrow">404 / PAGE NOT FOUND</span>
      <h1>A little out of place.</h1>
      <p>This page or product is no longer available.</p>
      <Link href="/shop" className="button">
        Browse the store
      </Link>
    </section>
  );
}
