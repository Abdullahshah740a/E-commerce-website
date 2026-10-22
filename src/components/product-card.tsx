import Link from 'next/link';
import Image from 'next/image';
import { Armchair, ArrowUpRight } from 'lucide-react';
import type { Product } from '@/lib/types';
import { money, effectivePrice } from '@/lib/commerce';
export function ProductCard({ product: p }: { product: Product }) {
  const image =
    p.product_media.find((m) => m.is_primary && m.type === 'image') ??
    p.product_media.filter((m) => m.type === 'image').sort((a, b) => a.position - b.position)[0];
  const variants = p.variants.filter((v) => v.active);
  const price = variants.length
    ? Math.min(...variants.map((v) => effectivePrice(p, v)))
    : (p.sale_price ?? p.price);
  const stock = variants.reduce((n, v) => n + v.stock, 0);
  return (
    <Link href={`/products/${p.slug}`} className="product-card">
      <div className="product-photo">
        {image ? (
          <Image
            src={image.url}
            alt={p.name}
            fill
            sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 25vw"
            unoptimized={!image.storage_key}
          />
        ) : (
          <Armchair size={64} strokeWidth={1} />
        )}
        <span className="product-label">
          {stock === 0
            ? 'Out of stock'
            : p.sale_price !== null
              ? 'On sale'
              : p.featured
                ? 'Featured'
                : ''}
        </span>
        <span className="product-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="product-copy">
        <h3>{p.name}</h3>
        <p>{p.short_description}</p>
        <b>{money(price)}</b>
        {p.sale_price !== null && variants.every((v) => v.price === null) && (
          <del>{money(p.price)}</del>
        )}
      </div>
    </Link>
  );
}
