import { NextResponse } from 'next/server';
import { publicDb } from '@/lib/supabase';
import { z } from 'zod';
import { failure, readJson, sameOrigin, noStore } from '@/lib/http';
import type { Product } from '@/lib/types';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const ids = z
      .array(z.uuid())
      .max(30)
      .parse(await readJson(request));
    const { data, error } = await publicDb()
      .from('variants')
      .select('*,products!inner(*,product_media(*))')
      .in('id', ids)
      .eq('active', true)
      .eq('products.active', true);
    if (error) throw error;
    return NextResponse.json(
      {
        items: (data ?? []).map((v) => {
          const p = v.products as Product;
          return {
            variant_id: v.id,
            product_id: p.id,
            name: p.name,
            slug: p.slug,
            sku: v.sku,
            variant: [v.size, v.color, v.design].filter(Boolean).join(' / '),
            expected_price: v.price ?? p.sale_price ?? p.price,
            stock: v.stock,
            image:
              p.product_media.find((m) => m.is_primary)?.url ??
              p.product_media.find((m) => m.type === 'image')?.url,
          };
        }),
      },
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}
