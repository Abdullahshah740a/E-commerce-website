import { createHash, createHmac } from 'node:crypto';
import { NextResponse, after } from 'next/server';
import { checkoutSchema } from '@/lib/validation';
import { privilegedDb } from '@/lib/supabase';
import { orderSummary } from '@/lib/commerce';
import { deliverOrderWebhook, webhookConfigured } from '@/lib/order-webhooks';
import { sameOrigin, readJson, failure, noStore } from '@/lib/http';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = privilegedDb();
    if (!webhookConfigured()) throw new Error('Order notifications are not configured');
    // Fail before stock/order changes if the required migration is absent.
    const { error: queueError } = await db.from('order_webhooks').select('order_id').limit(0);
    if (queueError) throw queueError;
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
    const message = orderSummary(data.order, data.items);
    after(async () => {
      await deliverOrderWebhook(data.order.id);
    });
    return NextResponse.json(
      {
        reference: data.order.reference,
        message,
        status: data.order.status,
        total: data.order.total,
        currency: data.order.currency,
      },
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}
