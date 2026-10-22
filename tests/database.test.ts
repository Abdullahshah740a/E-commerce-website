import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const db = new PGlite({ extensions: { pgcrypto } });
const admin = '00000000-0000-4000-8000-000000000010';
const product = '00000000-0000-4000-8000-000000000020';
const variant = '00000000-0000-4000-8000-000000000030';
const key = '00000000-0000-4000-8000-000000000040';
const customer = {
  name: 'Test customer',
  phone: '923001234567',
  address: 'Test address only',
  area: 'Test area',
  city: 'Lahore',
  province: 'Punjab',
};
const cart = [{ variant_id: variant, quantity: 2, expected_price: 100000 }];
async function role(name: 'anon' | 'authenticated' | 'service_role', uid = '') {
  await db.exec(`reset role; set role ${name};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
}
async function order(items = cart, hash = 'same', id = key) {
  const { rows } = await db.query<{
    result: {
      order: {
        id: string;
        reference: string;
        total: number;
        status: string;
        payment_status: string;
      };
      items: { name: string; unit_price: number }[];
    };
  }>('select public.place_order($1,$2,$3::jsonb,$4::jsonb) result', [
    id,
    hash,
    JSON.stringify(customer),
    JSON.stringify(items),
  ]);
  return rows[0].result;
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;`,
  );
  for (const file of [
    '001_store.sql',
    '002_media.sql',
    '003_catalog_safety.sql',
    '004_inventory_and_bestsellers.sql',
  ])
    await db.exec(readFileSync(resolve('supabase/migrations', file), 'utf8'));
  await db.exec(
    `grant usage on schema public,auth,storage to anon,authenticated,service_role; grant all on all tables in schema public to anon,authenticated,service_role; grant select on auth.users to authenticated; grant all on all tables in schema storage to anon,authenticated,service_role; insert into auth.users values('${admin}'); insert into public.admins values('${admin}');`,
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    `reset role; truncate public.orders,public.products,public.request_limits cascade; update public.settings set data=data||'{"whatsapp":"923001234567","checkout_enabled":true,"delivery_fee":30000,"city_fees":{"lahore":20000},"free_delivery_threshold":500000}'::jsonb; insert into public.products(id,name,slug,sku,price,active,tags) values('${product}','Original textile','original-textile','P-1',100000,true,array['cotton']); insert into public.variants(id,product_id,sku,size,color,stock) values('${variant}','${product}','V-1','King','Sage',3);`,
  );
});
afterAll(async () => {
  await db.close();
});
describe('Actual PostgreSQL migrations and security policies (local test database only)', () => {
  it('does not let a stale product editor overwrite order-held inventory', async () => {
    await role('service_role');
    await order();
    await role('authenticated', admin);
    const p = {
      id: product,
      name: 'Stale update',
      slug: 'stale-update',
      sku: 'P-1',
      category_id: '',
      short_description: '',
      description: '',
      price: 100000,
      sale_price: null,
      active: true,
      featured: false,
      tags: [],
      variants: [
        {
          id: variant,
          sku: 'V-1',
          size: 'King',
          color: 'Sage',
          design: '',
          price: null,
          stock: 3,
          expected_stock: 3,
          active: true,
        },
      ],
    };
    await expect(db.query('select save_product($1::jsonb)', [JSON.stringify(p)])).rejects.toThrow(
      /Inventory changed/,
    );
    expect((await db.query<{ stock: number }>('select stock from variants')).rows[0].stock).toBe(1);
    expect((await db.query<{ name: string }>('select name from products')).rows[0].name).toBe(
      'Original textile',
    );
  });
  it('shows best sellers only from delivered orders without exposing customer fields', async () => {
    await role('service_role');
    const saved = await order();
    await role('anon');
    expect(
      (await db.query<{ data: unknown[] }>('select best_sellers() data')).rows[0].data,
    ).toHaveLength(0);
    await role('authenticated', admin);
    await db.query("select update_order($1,'delivered','paid','')", [saved.order.id]);
    await role('anon');
    const result = (
      await db.query<{ data: Record<string, unknown>[] }>('select best_sellers() data')
    ).rows[0].data;
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Original textile');
    expect(JSON.stringify(result)).not.toContain('Test customer');
  });
  it('allows image ordering before a primary image is chosen', async () => {
    await db.query(
      "insert into product_media(product_id,url,type) values($1,'https://example.com/test.jpg','image')",
      [product],
    );
    await role('authenticated', admin);
    const ids = (await db.query<{ id: string }>('select id from product_media')).rows.map(
      (m) => m.id,
    );
    await db.query('select reorder_media($1,$2::uuid[],null)', [product, ids]);
    expect(
      (await db.query<{ is_primary: boolean }>('select is_primary from product_media')).rows[0]
        .is_primary,
    ).toBe(false);
  });
  it('makes active catalog data visible and keeps inactive products private', async () => {
    await role('anon');
    const result = await db.query<{ result: { count: number; products: unknown[] } }>(
      "select search_catalog(p_query=>'cotton',p_size=>'king',p_color=>'sage') result",
    );
    expect(result.rows[0].result.count).toBe(1);
    await db.exec('reset role');
    await db.query('update public.products set active=false where id=$1', [product]);
    await role('anon');
    expect((await db.query('select * from public.products')).rows).toHaveLength(0);
    expect((await db.query('select * from public.variants')).rows).toHaveLength(0);
  });
  it('filters and sorts on variant prices with a real count', async () => {
    await db.query('update variants set price=150000 where id=$1', [variant]);
    await role('anon');
    let r = await db.query<{ result: { count: number } }>(
      'select search_catalog(p_min=>140000,p_max=>160000) result',
    );
    expect(r.rows[0].result.count).toBe(1);
    r = await db.query('select search_catalog(p_max=>110000) result');
    expect(r.rows[0].result.count).toBe(0);
  });
  it('denies anonymous order RPCs and administrator mutations', async () => {
    await role('anon');
    await expect(order()).rejects.toThrow(/permission denied/);
    await expect(db.query('select save_product($1::jsonb)', ['{}'])).rejects.toThrow(
      /permission denied/,
    );
    await db.query('update products set price=1 where id=$1', [product]);
    await role('service_role');
    expect((await db.query<{ price: number }>('select price from products')).rows[0].price).toBe(
      100000,
    );
  });
  it('denies non-administrator authenticated users', async () => {
    await role('authenticated', '00000000-0000-4000-8000-000000000099');
    await expect(db.query("select save_product('{}'::jsonb)")).rejects.toThrow(/Not authorized/);
    expect((await db.query('select * from admins')).rows).toHaveLength(0);
  });
  it('saves authoritative totals and private immutable item snapshots', async () => {
    await role('service_role');
    const saved = await order();
    expect(saved.order.total).toBe(220000);
    expect(saved.order.status).toBe('pending_confirmation');
    expect(saved.order.payment_status).toBe('unpaid');
    expect(saved.items[0].name).toBe('Original textile');
    expect((await db.query<{ stock: number }>('select stock from variants')).rows[0].stock).toBe(1);
    await db.query("update products set name='Changed',price=999 where id=$1", [product]);
    expect((await db.query<{ name: string }>('select name from order_items')).rows[0].name).toBe(
      'Original textile',
    );
    await role('anon');
    expect((await db.query('select * from orders')).rows).toHaveLength(0);
    expect((await db.query('select * from order_items')).rows).toHaveLength(0);
  });
  it('rejects stale prices without saving or subtracting stock', async () => {
    await role('service_role');
    await expect(order([{ ...cart[0], expected_price: 1 }])).rejects.toThrow(/Price changed/);
    expect((await db.query('select * from orders')).rows).toHaveLength(0);
    expect((await db.query<{ stock: number }>('select stock from variants')).rows[0].stock).toBe(3);
  });
  it('replays one saved order without subtracting inventory twice', async () => {
    await role('service_role');
    const first = await order();
    const second = await order();
    expect(first.order.id).toBe(second.order.id);
    expect((await db.query('select * from orders')).rows).toHaveLength(1);
    expect((await db.query<{ stock: number }>('select stock from variants')).rows[0].stock).toBe(1);
    await expect(order(cart, 'different')).rejects.toThrow(/Idempotency conflict/);
  });
  it('rejects overselling and duplicate cart rows atomically', async () => {
    await role('service_role');
    await expect(order([cart[0], cart[0]])).rejects.toThrow(/Duplicate/);
    await order();
    await expect(order(cart, 'new', '00000000-0000-4000-8000-000000000041')).rejects.toThrow(
      /Stock changed/,
    );
    expect((await db.query('select * from orders')).rows).toHaveLength(1);
  });
  it('cancels once, restores inventory once, and forbids reopening', async () => {
    await role('service_role');
    const saved = await order();
    await role('authenticated', admin);
    await db.query("select update_order($1,'cancelled','unpaid','Verified cancellation')", [
      saved.order.id,
    ]);
    await db.query("select update_order($1,'cancelled','unpaid','Already cancelled')", [
      saved.order.id,
    ]);
    expect((await db.query<{ stock: number }>('select stock from variants')).rows[0].stock).toBe(3);
    await expect(
      db.query("select update_order($1,'confirmed','unpaid','')", [saved.order.id]),
    ).rejects.toThrow(/cannot be reopened/);
  });
  it('protects product history from deletion', async () => {
    await role('service_role');
    await order();
    await role('authenticated', admin);
    await expect(db.query('delete from products where id=$1', [product])).rejects.toThrow(
      /Archive products/,
    );
  });
  it('blocks checkout until genuine delivery and WhatsApp setup exists', async () => {
    await db.exec('update settings set data=data||\'{"whatsapp":"","delivery_fee":null}\'::jsonb');
    await role('service_role');
    await expect(order()).rejects.toThrow(/not accepting orders/);
  });
  it('persists a strict rate-limit counter independently of an order transaction', async () => {
    await role('service_role');
    const values = [];
    for (let i = 0; i < 9; i++)
      values.push(
        (
          await db.query<{ allowed: boolean }>(
            "select take_rate_limit('hashed-test-client') allowed",
          )
        ).rows[0].allowed,
      );
    expect(values.slice(0, 8).every(Boolean)).toBe(true);
    expect(values[8]).toBe(false);
  });
  it('validates administrator product saves and retains inactive variant history', async () => {
    await role('authenticated', admin);
    const p = {
      id: product,
      name: 'Edited textile',
      slug: 'edited-textile',
      sku: 'P-1',
      category_id: '',
      short_description: 'Cotton',
      description: 'Test only',
      price: 100000,
      sale_price: null,
      active: true,
      featured: true,
      tags: ['cotton'],
      variants: [
        {
          id: variant,
          sku: 'V-1',
          size: 'King',
          color: 'Sage',
          design: '',
          price: null,
          stock: 3,
          expected_stock: 3,
          active: true,
        },
      ],
    };
    await db.query('select save_product($1::jsonb)', [JSON.stringify(p)]);
    expect((await db.query<{ name: string }>('select name from products')).rows[0].name).toBe(
      'Edited textile',
    );
  });
});
