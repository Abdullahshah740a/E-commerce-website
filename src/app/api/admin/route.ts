import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/supabase';
import { categorySchema, productSchema, settingsSchema, orderUpdateSchema } from '@/lib/validation';
import { sameOrigin, readJson, failure, noStore } from '@/lib/http';
import { deliverOrderWebhook } from '@/lib/order-webhooks';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = await adminDb();
    const body = await readJson(request);
    const action = z
      .enum([
        'product',
        'archive',
        'delete-product',
        'category',
        'settings',
        'order',
        'media-order',
        'delete-media',
        'video-url',
        'retry-webhook',
      ])
      .parse(body.action);
    let result: unknown = null;
    if (action === 'retry-webhook')
      result = await deliverOrderWebhook(z.uuid().parse(body.data.id));
    if (action === 'product') {
      const p = productSchema.parse(body.data);
      const r = await db.rpc('save_product', { p });
      if (r.error) {
        if (r.error.message.includes('Inventory changed'))
          return NextResponse.json(
            {
              error:
                'Inventory changed while this editor was open. Reload the page, review current stock, and save again.',
            },
            { status: 409 },
          );
        if (r.error.code === '23505')
          return NextResponse.json(
            { error: 'That slug or SKU is already in use. Choose a unique value.' },
            { status: 409 },
          );
        throw r.error;
      }
      result = r.data;
    }
    if (action === 'archive') {
      const id = z.uuid().parse(body.data.id);
      const r = await db.from('products').update({ active: false }).eq('id', id);
      if (r.error) throw r.error;
    }
    if (action === 'delete-product') {
      const id = z.uuid().parse(body.data.id);
      const { count, error } = await db
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id);
      if (error) throw error;
      if (count)
        return NextResponse.json(
          { error: 'This product has order history. Archive it instead.' },
          { status: 409 },
        );
      const { data: media, error: me } = await db
        .from('product_media')
        .select('storage_key')
        .eq('product_id', id);
      if (me) throw me;
      const r = await db.from('products').delete().eq('id', id);
      if (r.error) throw r.error;
      const keys = (media ?? []).map((m) => m.storage_key).filter(Boolean);
      if (keys.length) {
        const { error: cleanupError } = await db.storage.from('product-media').remove(keys);
        if (cleanupError)
          return NextResponse.json(
            {
              error:
                'Product deleted, but storage cleanup failed. Review its unreferenced files in Supabase Storage.',
            },
            { status: 503, headers: noStore },
          );
      }
    }
    if (action === 'category') {
      const c = categorySchema.parse(body.data);
      const r = c.id
        ? await db.from('categories').update(c).eq('id', c.id)
        : await db.from('categories').insert(c);
      if (r.error) throw r.error;
    }
    if (action === 'settings') {
      const s = settingsSchema.parse(body.data);
      s.city_fees = Object.fromEntries(
        Object.entries(s.city_fees).map(([k, v]) => [k.trim().toLowerCase(), v]),
      );
      const r = await db.from('settings').update({ data: s }).eq('id', true);
      if (r.error) throw r.error;
    }
    if (action === 'order') {
      const o = orderUpdateSchema.parse(body.data);
      const r = await db.rpc('update_order', {
        p_id: o.id,
        p_status: o.status,
        p_payment: o.payment_status,
        p_notes: o.internal_notes,
      });
      if (r.error) {
        if (/cannot be reopened|Delivered orders/.test(r.error.message))
          return NextResponse.json({ error: r.error.message }, { status: 409 });
        throw r.error;
      }
    }
    if (action === 'media-order') {
      const d = z
        .object({
          product_id: z.uuid(),
          ids: z.array(z.uuid()).max(30),
          primary: z.uuid().nullable(),
        })
        .parse(body.data);
      const r = await db.rpc('reorder_media', {
        p_product: d.product_id,
        p_ids: d.ids,
        p_primary: d.primary,
      });
      if (r.error) throw r.error;
    }
    if (action === 'delete-media') {
      const id = z.uuid().parse(body.data.id);
      const { data: m, error } = await db.from('product_media').select('*').eq('id', id).single();
      if (error) throw error;
      const r = await db.from('product_media').delete().eq('id', id);
      if (r.error) throw r.error;
      if (m.storage_key) {
        const { error: storageError } = await db.storage
          .from('product-media')
          .remove([m.storage_key]);
        if (storageError)
          return NextResponse.json(
            {
              error:
                'Media detached, but storage cleanup failed. Retry cleanup in the Supabase dashboard.',
            },
            { status: 503 },
          );
      }
    }
    if (action === 'video-url') {
      const d = z
        .object({ product_id: z.uuid(), url: z.url().startsWith('https://').max(2000) })
        .parse(body.data);
      const { error } = await db.from('product_media').insert({ ...d, type: 'video' });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, data: result }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
