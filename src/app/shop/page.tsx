import Link from 'next/link';
import { storeData, catalog } from '@/lib/data';
import { ProductCard } from '@/components/product-card';
import { catalogParams } from '@/lib/catalog-params';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Shop the collection',
  description: 'Browse sofa covers, bedsheets, cushions and home textile essentials.',
};
export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = catalogParams(await searchParams);
  const { categories, error } = await storeData();
  if (params.collection) {
    const category = categories.find((c) => c.slug === params.collection);
    if (category) params.category = category.id;
    else params.category = '00000000-0000-0000-0000-000000000000';
  }
  const { products, count, error: catalogError } = await catalog(params);
  const page = Number(params.page);
  function pageLink(n: number) {
    const q = new URLSearchParams(
      Object.entries(params).filter((x): x is [string, string] => x[1] !== undefined),
    );
    q.set('page', String(n));
    return `/shop?${q}`;
  }
  return (
    <div className="container section">
      <div className="breadcrumb">
        <Link href="/">Home</Link> / The collection
      </div>
      <span className="eyebrow">TEXTILES FOR THE WAY YOU LIVE</span>
      <h1 className="page-title">Find your kind of comfort.</h1>
      <p className="muted">Thoughtful touches for your sofa, your bedroom, your everyday.</p>
      <form className="catalog-filters" action="/shop">
        <label className="search-field">
          Search
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Search bedding, sofa covers…"
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={params.category || ''}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select name="sort" defaultValue={params.sort || 'newest'}>
            <option value="newest">Newest arrivals</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </label>
        <label>
          Min price (Rs.)
          <input name="min" type="number" min="0" defaultValue={params.min} />
        </label>
        <label>
          Max price (Rs.)
          <input name="max" type="number" min="0" defaultValue={params.max} />
        </label>
        <label>
          Size
          <input name="size" defaultValue={params.size} placeholder="e.g. King" />
        </label>
        <label>
          Color
          <input name="color" defaultValue={params.color} placeholder="e.g. Sage" />
        </label>
        <button className="button">Apply filters</button>
        <Link href="/shop" className="text-link">
          Clear
        </Link>
      </form>
      <div className="catalog-count">
        {count} {count === 1 ? 'piece' : 'pieces'} in the collection
      </div>
      {error || catalogError ? (
        <div className="empty notice">
          <h2>The collection is being prepared.</h2>
          <p>{error || catalogError}</p>
        </div>
      ) : products.length ? (
        <>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <nav className="pagination" aria-label="Catalog pages">
            {page > 1 && (
              <Link href={pageLink(page - 1)} className="button secondary">
                Previous
              </Link>
            )}
            <span>
              Page {page} of {Math.max(1, Math.ceil(count / 12))}
            </span>
            {page * 12 < count && (
              <Link href={pageLink(page + 1)} className="button secondary">
                Next
              </Link>
            )}
          </nav>
        </>
      ) : (
        <div className="empty">
          <h2>No pieces to show just yet.</h2>
          <p>
            {params.q || params.category
              ? 'Try another search or clear your filters.'
              : 'Our team will add the first products soon. Please check back.'}
          </p>
        </div>
      )}
    </div>
  );
}
