import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Armchair, BedDouble, Layers, Leaf } from 'lucide-react';
import { storeData, catalog, bestSellers } from '@/lib/data';
import { ProductCard } from '@/components/product-card';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const [{ settings: s, categories, error }, featured, latest, popular] = await Promise.all([
    storeData(),
    catalog({ featured: 'true' }),
    catalog(),
    bestSellers(),
  ]);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-line" /> THE ART OF EVERYDAY LIVING
          </span>
          <h1>{s.hero_title}</h1>
          <p>{s.hero_text}</p>
          <Link href="/shop" className="button">
            Explore the collection <ArrowRight size={17} />
          </Link>
          <div className="hero-note">
            <Leaf size={17} />
            <span>Little changes. A whole new feeling.</span>
          </div>
        </div>
        <div
          className="hero-art"
          role="img"
          aria-label="Decorative illustration of a sage sofa with cushions and a woven throw"
        >
          <div className="wall-line" />
          <div className="picture-frame">
            <div />
          </div>
          <div className="vase">
            <i />
            <i />
            <i />
          </div>
          <div className="sofa-back" />
          <div className="sofa-seat" />
          <div className="sofa-arm left" />
          <div className="sofa-arm right" />
          <div className="cushion one" />
          <div className="cushion two" />
          <div className="throw" />
          <div className="sofa-leg left" />
          <div className="sofa-leg right" />
          <div className="rug" />
          <span className="art-caption">A little inspiration for your home · illustration</span>
        </div>
        <div className="hero-bottom">
          <span>YOUR HOME, BEAUTIFULLY REIMAGINED</span>
          <span>01 — A softer everyday</span>
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR NEXT LITTLE UPGRADE</span>
            <h2>Comfort, room by room.</h2>
          </div>
          <Link className="text-link" href="/shop">
            Explore all <ArrowRight size={16} />
          </Link>
        </div>
        <div className="category-grid">
          {(categories.length
            ? categories.slice(0, 4)
            : [
                { id: 'sofa-covers', name: 'Sofa Covers', slug: 'sofa-covers' },
                { id: 'bedsheets', name: 'Bedsheets', slug: 'bedsheets' },
                { id: 'cushion-covers', name: 'Cushion Covers', slug: 'cushion-covers' },
                { id: 'bedding-sets', name: 'Bedding Sets', slug: 'bedding-sets' },
              ]
          ).map((c, i) => (
            <Link
              href={`/shop?collection=${c.slug}`}
              className={`category-card category-${i}`}
              key={c.id}
            >
              <div className="category-symbol">
                {'image_url' in c && c.image_url ? (
                  <Image src={c.image_url} alt="" width={240} height={160} unoptimized />
                ) : i === 0 ? (
                  <Armchair size={78} strokeWidth={0.8} />
                ) : i === 1 ? (
                  <BedDouble size={78} strokeWidth={0.8} />
                ) : (
                  <Layers size={78} strokeWidth={0.8} />
                )}
              </div>
              <span>
                <b>{c.name}</b>
                <ArrowUpRightIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section container collection-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CHOSEN WITH HOME IN MIND</span>
            <h2>A softer kind of everyday.</h2>
          </div>
          <Link href="/shop" className="text-link">
            Shop the collection <ArrowRight size={16} />
          </Link>
        </div>
        {error || featured.error ? (
          <div className="empty catalog-empty">
            <Layers size={35} strokeWidth={1} />
            <h3>Good things are on their way.</h3>
            <p>{error || featured.error}</p>
            <Link href="/shop" className="text-link">
              Visit the catalog <ArrowRight size={16} />
            </Link>
          </div>
        ) : featured.products.length ? (
          <div className="product-grid">
            {featured.products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="empty catalog-empty">
            <h3>Our collection is coming together.</h3>
            <p>Featured textiles will appear here as our team adds them.</p>
          </div>
        )}
      </section>
      <section className="story-band">
        <span className="eyebrow">FROM OUR FAMILY TO YOUR HOME</span>
        <h2>
          It’s the little details
          <br />
          that make a house feel like home.
        </h2>
        <p>
          Fresh bedding. A favourite cushion. A sofa that feels new again.
          <br />
          Find something lovely for your everyday spaces.
        </p>
        <Link href="/shop" className="text-link">
          Find your finishing touch <ArrowRight size={17} />
        </Link>
      </section>
      {popular.length > 0 && (
        <section className="section container">
          <span className="eyebrow">FAVOURITES FOR A REASON</span>
          <h2>Most loved, most lived in.</h2>
          <p>Popular pieces from our fulfilled orders.</p>
          <div className="product-grid">
            {popular.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
      {latest.products.length > 0 && (
        <section className="section container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FRESH FINDS</span>
              <h2>New to the collection.</h2>
            </div>
          </div>
          <div className="product-grid">
            {latest.products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
function ArrowUpRightIcon() {
  return <span aria-hidden="true">↗</span>;
}
