import { createHash, createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkoutSchema } from '@/lib/validation';
import { privilegedDb } from '@/lib/supabase';
import { storeData } from '@/lib/data';
import { whatsappLink, whatsappMessage } from '@/lib/commerce';
import { sameOrigin, readJson, failure, noStore } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = privilegedDb();
    const secret = process.env.CHECKOUT_RATE_LIMIT_SECRET;
    if (!secret || secret.length < 32) throw new Error('Rate limiting is not configured');
    // On Vercel this header is set by the trusted edge. Other hosts must strip and replace it.
    const ip = process.env.VERCEL
      ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
      : request.headers.get('x-real-ip');
    if (process.env.NODE_ENV === 'production' && !ip)
      throw new Error('Trusted client address is unavailable');
    const key = createHmac('sha256', secret)
      .update(ip || 'local-development')
      .digest('hex');
    const { data: allowed, error: rateError } = await db.rpc('take_rate_limit', { p_key: key });
    if (rateError) throw rateError;
    if (!allowed)
      return NextResponse.json(
        { error: 'Too many attempts. Please wait 15 minutes and try again.' },
        { status: 429, headers: noStore },
      );
    const input = checkoutSchema.parse(await readJson(request));
    const canonical = {
      customer: input.customer,
      items: [...input.items].sort((a, b) => a.variant_id.localeCompare(b.variant_id)),
    };
    const hash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
    const { data, error } = await db.rpc('place_order', {
      p_key: input.idempotency_key,
      p_hash: hash,
      p_customer: input.customer,
      p_items: canonical.items,
    });
    if (error) {
      const known = [
        'Price changed. Review your cart',
        'Stock changed. Review your cart',
        'An item is no longer available',
        'Store is not accepting orders yet',
        'Idempotency conflict',
      ];
      const msg = known.find((m) => error.message.includes(m));
      if (msg) return NextResponse.json({ error: msg }, { status: 409, headers: noStore });
      throw error;
    }
    const { settings } = await storeData();
    const message = whatsappMessage(data.order, data.items);
    const link = whatsappLink(settings.whatsapp, message);
    return NextResponse.json(
      {
        reference: data.order.reference,
        message,
        link,
        total: data.order.total,
        currency: data.order.currency,
      },
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}
