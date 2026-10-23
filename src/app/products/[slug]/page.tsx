import Link from 'next/link';
import { notFound } from 'next/navigation';
import { productBySlug, storeData, catalog } from '@/lib/data';
import { ProductDetail } from '@/components/product-detail';
import { ProductCard } from '@/components/product-card';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await productBySlug((await params).slug);
  return {
    title: p?.name || 'Product not found',
    description: p?.short_description,
    alternates: { canonical: `/products/${p?.slug || ''}` },
    openGraph: {
      title: p?.name,
      description: p?.short_description,
      images: p?.product_media
        .filter((m) => m.type === 'image')
        .slice(0, 1)
        .map((m) => m.url),
    },
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await productBySlug((await params).slug);
  if (!p) notFound();
  const [{ settings }, related] = await Promise.all([
    storeData(),
    catalog({ category: p.category_id ?? undefined }),
  ]);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    sku: p.sku,
    image: p.product_media.filter((m) => m.type === 'image').map((m) => m.url),
    offers: p.variants
      .filter((v) => v.active)
      .map((v) => ({
        '@type': 'Offer',
        priceCurrency: settings.currency,
        price: ((v.price ?? p.sale_price ?? p.price) / 100).toFixed(2),
        availability: `https://schema.org/${v.stock > 0 ? 'InStock' : 'OutOfStock'}`,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/products/${p.slug}`,
      })),
  };
  return (
    <div className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <div className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop">The collection</Link> / {p.name}
      </div>
      <ProductDetail product={p} />
      {related.products.filter((r) => r.id !== p.id).length > 0 && (
        <section className="section">
          <h2>You might also love.</h2>
          <div className="product-grid">
            {related.products
              .filter((r) => r.id !== p.id)
              .slice(0, 4)
              .map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
