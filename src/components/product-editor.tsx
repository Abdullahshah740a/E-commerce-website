'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAction } from './admin-common';
import { MediaManager } from './media-manager';
import { money } from '@/lib/commerce';
import type { Category, Product } from '@/lib/types';
type EditableVariant = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  design: string;
  price: string;
  stock: number;
  active: boolean;
};
export function ProductEditor({
  product: p,
  categories,
}: {
  product: Product | null;
  categories: Category[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [variants, setVariants] = useState<EditableVariant[]>(
    p?.variants.map((v) => ({ ...v, price: v.price === null ? '' : String(v.price / 100) })) || [
      { sku: '', size: '', color: '', design: '', price: '', stock: 0, active: true },
    ],
  );
  const [formKey, setFormKey] = useState(0);
  function change(i: number, key: keyof EditableVariant, value: string | number | boolean) {
    setVariants((v) => v.map((row, n) => (n === i ? { ...row, [key]: value } : row)));
  }
  function draft(form: HTMLFormElement) {
    const f = Object.fromEntries(new FormData(form));
    return {
      id: p?.id,
      name: f.name,
      slug: f.slug,
      sku: f.sku,
      category_id: f.category_id,
      short_description: f.short_description,
      description: f.description,
      price: Math.round(Number(f.price) * 100),
      sale_price: f.sale_price === '' ? null : Math.round(Number(f.sale_price) * 100),
      active: f.active === 'on',
      featured: f.featured === 'on',
      tags: String(f.tags)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      variants: variants.map((v) => ({
        ...v,
        expected_stock: p?.variants.find((old) => old.id === v.id)?.stock,
        price: v.price === '' ? null : Math.round(Number(v.price) * 100),
      })),
    };
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = draft(e.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const id = await adminAction('product', d);
      setMessage('Product saved.');
      if (!p) router.replace(`/admin/products/${id}`);
      else router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to save product.');
    }
    setBusy(false);
  }
  return (
    <>
      <h1 className="page-title">{p ? 'Edit product.' : 'Add a new piece.'}</h1>
      <form
        key={formKey}
        onSubmit={submit}
        className="form-stack"
        onChange={() => setPreview(null)}
      >
        <div className="form-grid">
          <label>
            Product name
            <input name="name" defaultValue={p?.name} required maxLength={180} />
          </label>
          <label>
            URL slug
            <input
              name="slug"
              defaultValue={p?.slug}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="sage-stretch-sofa-cover"
            />
          </label>
          <label>
            Product SKU
            <input name="sku" defaultValue={p?.sku} required />
          </label>
          <label>
            Category
            <select name="category_id" defaultValue={p?.category_id || ''}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Regular price (Rs.)
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              max="1000000"
              required
              defaultValue={p ? p.price / 100 : ''}
            />
          </label>
          <label>
            Sale price (Rs., optional)
            <input
              name="sale_price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={p?.sale_price == null ? '' : p.sale_price / 100}
            />
          </label>
          <label className="wide">
            Short description
            <input name="short_description" maxLength={400} defaultValue={p?.short_description} />
          </label>
          <label className="wide">
            Full description
            <textarea name="description" rows={6} maxLength={10000} defaultValue={p?.description} />
          </label>
          <label className="wide">
            Tags (comma separated)
            <input name="tags" defaultValue={p?.tags.join(', ')} />
          </label>
          <label className="check-label">
            <input name="active" type="checkbox" defaultChecked={p?.active} />
            Active / visible in store
          </label>
          <label className="check-label">
            <input name="featured" type="checkbox" defaultChecked={p?.featured} />
            Featured on homepage
          </label>
        </div>
        <h2>Variants & inventory</h2>
        <p className="muted">
          Every product needs at least one variant. For a single option, leave size, color and
          design empty. An optional variant price overrides the product price.
        </p>
        {variants.map((v, i) => (
          <fieldset className="variant-editor" key={v.id || i}>
            <legend>Variant {i + 1}</legend>
            <div className="form-grid">
              <label>
                Variant SKU
                <input required value={v.sku} onChange={(e) => change(i, 'sku', e.target.value)} />
              </label>
              <label>
                Size
                <input value={v.size} onChange={(e) => change(i, 'size', e.target.value)} />
              </label>
              <label>
                Color
                <input value={v.color} onChange={(e) => change(i, 'color', e.target.value)} />
              </label>
              <label>
                Design / pattern
                <input value={v.design} onChange={(e) => change(i, 'design', e.target.value)} />
              </label>
              <label>
                Override price (Rs.)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v.price}
                  onChange={(e) => change(i, 'price', e.target.value)}
                />
              </label>
              <label>
                Available stock
                <input
                  type="number"
                  required
                  min="0"
                  max="1000000"
                  value={v.stock}
                  onChange={(e) => change(i, 'stock', Number(e.target.value))}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={v.active}
                  onChange={(e) => change(i, 'active', e.target.checked)}
                />
                Variant active
              </label>
            </div>
            <button
              className="text-link"
              type="button"
              disabled={variants.length <= 1}
              onClick={() => {
                if (
                  confirm('Remove this variant from the editor? It will be disabled when you save.')
                )
                  setVariants((rows) => rows.filter((_, n) => n !== i));
              }}
            >
              Remove variant
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setVariants((v) => [
              ...v,
              { sku: '', size: '', color: '', design: '', price: '', stock: 0, active: true },
            ])
          }
        >
          Add variant +
        </button>
        <div className="row">
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={(e) => setPreview(draft(e.currentTarget.form!))}
          >
            Preview draft
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              if (confirm('Discard unsaved changes?')) {
                setFormKey((k) => k + 1);
                setVariants(
                  p?.variants.map((v) => ({
                    ...v,
                    price: v.price === null ? '' : String(v.price / 100),
                  })) || [
                    { sku: '', size: '', color: '', design: '', price: '', stock: 0, active: true },
                  ],
                );
              }
            }}
          >
            Discard changes
          </button>
        </div>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </form>
      {preview && (
        <section className="summary-card">
          <span className="eyebrow">DRAFT PREVIEW · NOT YET SAVED</span>
          <h2>{String(preview.name)}</h2>
          <b>{money(Number(preview.sale_price ?? preview.price))}</b>
          <p>{String(preview.short_description)}</p>
          <p className="preserve-lines">{String(preview.description)}</p>
          <p>
            {variants
              .map((v) => [v.size, v.color, v.design].filter(Boolean).join(' / ') || 'Standard')
              .join(' • ')}
          </p>
        </section>
      )}
      {p ? (
        <MediaManager productId={p.id} initialMedia={p.product_media} />
      ) : (
        <p className="notice">
          Images and videos are optional. Save your product first, then upload them here for
          customers to view before buying.
        </p>
      )}
    </>
  );
}
