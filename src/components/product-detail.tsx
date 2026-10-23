'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Armchair, Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { Product } from '@/lib/types';
import { money, effectivePrice } from '@/lib/commerce';
import { useCart } from './cart-provider';
import { ImageLightbox } from './image-lightbox';
import { ProductVideo } from './product-video';
export function ProductDetail({ product: p }: { product: Product }) {
  const variants = p.variants.filter((v) => v.active);
  const [variantId, setVariant] = useState(
    variants.find((v) => v.stock > 0)?.id || variants[0]?.id || '',
  );
  const v = variants.find((v) => v.id === variantId);
  const media = [...p.product_media].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position,
  );
  const [selected, setSelected] = useState(media[0]);
  const [zoom, setZoom] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState('');
  const { add, items } = useCart();
  const inCart = items.find((i) => i.variant_id === v?.id)?.quantity ?? 0;
  const remaining = Math.max(0, (v?.stock ?? 0) - inCart);
  function addItem() {
    if (!v || quantity > remaining) return;
    const saved = add({
      variant_id: v.id,
      product_id: p.id,
      name: p.name,
      slug: p.slug,
      sku: v.sku,
      variant: [v.size, v.color, v.design].filter(Boolean).join(' / '),
      quantity,
      expected_price: effectivePrice(p, v),
      stock: v.stock,
      image: media.find((m) => m.type === 'image')?.url,
    });
    setAdded(saved);
    setCartError(
      saved
        ? ''
        : 'Your bag is full or the available quantity is already in it. Review your bag before adding more.',
    );
  }
  return (
    <div className="product-detail">
      <div>
        <div className="detail-photo">
          {selected?.type === 'image' ? (
            <button onClick={() => setZoom(true)} aria-label="Enlarge product image">
              <Image
                src={selected.url}
                alt={p.name}
                fill
                sizes="(max-width: 800px) 100vw, 50vw"
                unoptimized={!selected.storage_key}
                priority
              />
            </button>
          ) : selected?.type === 'video' ? (
            <ProductVideo key={selected.id} url={selected.url} title={`${p.name} product video`} />
          ) : (
            <Armchair size={100} strokeWidth={1} />
          )}
        </div>
        <div className="gallery-thumbs">
          {media.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              aria-label={`View ${m.type} ${i + 1}`}
              aria-pressed={selected?.id === m.id}
            >
              {m.type === 'image' ? (
                <Image src={m.url} alt="" width={72} height={72} unoptimized={!m.storage_key} />
              ) : (
                <span>▶ Video</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="product-info">
        <span className="eyebrow">A LITTLE COMFORT, BEAUTIFULLY CHOSEN</span>
        <h1>{p.name}</h1>
        <p className="detail-price">
          {money(v ? effectivePrice(p, v) : (p.sale_price ?? p.price))}
          {p.sale_price !== null && v?.price == null && <del>{money(p.price)}</del>}
        </p>
        <p>{p.short_description}</p>
        <label>
          Choose your size, color & design
          <select
            value={variantId}
            onChange={(e) => {
              setVariant(e.target.value);
              setQuantity(1);
              setAdded(false);
              setCartError('');
            }}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stock === 0}>
                {[v.size, v.color, v.design].filter(Boolean).join(' / ') || 'Standard'} ·{' '}
                {money(effectivePrice(p, v))}
                {v.stock === 0 ? ' · Out of stock' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className={remaining ? 'stock' : 'muted'}>
          {remaining ? `${remaining} available to add` : 'Currently unavailable'}
          <small>SKU: {v?.sku || p.sku}</small>
        </p>
        <div className="purchase-row">
          <div className="quantity">
            <button
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus size={14} />
            </button>
            <span>{quantity}</span>
            <button
              aria-label="Increase quantity"
              disabled={quantity >= remaining || quantity >= 99}
              onClick={() => setQuantity((q) => Math.min(99, remaining, q + 1))}
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            className="button"
            onClick={addItem}
            disabled={!v || quantity > remaining || remaining === 0}
          >
            {added ? <Check size={17} /> : <ShoppingBag size={17} />}{' '}
            {added ? 'Added to bag' : 'Add to bag'}
          </button>
        </div>
        {added && (
          <Link className="text-link" href="/cart">
            View your bag →
          </Link>
        )}
        {cartError && (
          <p className="notice" role="alert">
            {cartError} <Link href="/cart">View your bag</Link>
          </p>
        )}
        <div className="product-assurance">
          Cash on Delivery · Order confirmed by phone
          <br />
          Delivery fee calculated at checkout
        </div>
        <details open>
          <summary>About this piece</summary>
          <p className="preserve-lines">{p.description || p.short_description}</p>
        </details>
      </div>
      {zoom && selected && (
        <ImageLightbox src={selected.url} name={p.name} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}
