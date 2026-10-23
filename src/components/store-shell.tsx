import Link from 'next/link';
import Image from 'next/image';
import { Armchair, ShieldCheck, Truck } from 'lucide-react';
import { storeData } from '@/lib/data';
import { CartCount } from './cart-count';
export async function Header() {
  const { settings: s } = await storeData();
  return (
    <>
      <div className="announcement">{s.promotion}</div>
      <header className="header">
        <Link href="/" className="brand">
          {s.logo_url ? (
            <Image src={s.logo_url} alt="" width={40} height={40} unoptimized />
          ) : (
            <Armchair size={31} strokeWidth={1.3} />
          )}
          <span>
            {s.business_name}
            <small>HOME & LIVING</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/shop">Shop all</Link>
          <Link href="/shop?collection=sofa-covers">Sofa covers</Link>
          <Link href="/shop?collection=bedsheets">Bedding</Link>
          <Link href="/policies">Our store</Link>
        </nav>
        <div className="header-actions">
          <Link href="/shop" aria-label="Search the catalog" className="search-link">
            Search <span>⌕</span>
          </Link>
          <CartCount />
        </div>
      </header>
    </>
  );
}
export async function Footer() {
  const { settings: s } = await storeData();
  return (
    <>
      <section className="service-strip">
        <div>
          <Truck />
          <span>
            <b>Delivered to your door</b>
            <small>Delivery fees shown before you order</small>
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <b>Cash on Delivery</b>
            <small>Pay when your order arrives</small>
          </span>
        </div>
        <div>
          <Armchair />
          <span>
            <b>A personal touch</b>
            <small>Every order confirmed by our team</small>
          </span>
        </div>
      </section>
      <footer className="footer">
        <div>
          <Link className="brand" href="/">
            {s.business_name}
          </Link>
          <p>{s.description}</p>
          {s.business_name === 'Your textile store' && (
            <small>Temporary branding · store setup in progress</small>
          )}
        </div>
        <div>
          <b>Explore</b>
          <Link href="/shop">All products</Link>
          <Link href="/cart">Your shopping bag</Link>
          <Link href="/policies">Delivery & store policies</Link>
        </div>
        <div>
          <b>Let’s stay in touch</b>
          {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
          {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
          {s.address && <p>{s.address}</p>}
          {s.instagram && <a href={s.instagram}>Instagram</a>}
          {s.facebook && <a href={s.facebook}>Facebook</a>}
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {s.business_name}
          </span>
          <span>Made for a more comfortable home.</span>
          <Link href="/admin">Store administration</Link>
        </div>
      </footer>
    </>
  );
}
