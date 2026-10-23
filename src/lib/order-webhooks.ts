import 'server-only';
import { privilegedDb } from './supabase';
import { makeWebhookUrl, sendOrderWebhook, type OrderEvent } from './webhook-request';

export function webhookConfigured() {
  return !!makeWebhookUrl(process.env.ORDER_WEBHOOK_URL);
}

export async function deliverOrderWebhook(orderId: string) {
  const db = privilegedDb();
  const url = process.env.ORDER_WEBHOOK_URL || '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db.rpc('claim_order_webhook', { p_order: orderId });
    if (error) return 'unavailable';
    const job = data?.[0];
    // Delivered or already leased by another request: do not send a second copy.
    if (!job) return 'unchanged';
    const event = { ...job.payload, event_id: job.event_id } as OrderEvent;
    const sent = await sendOrderWebhook(url, event);
    const { error: saveError } = await db
      .from('order_webhooks')
      .update({
        status: sent.ok ? 'delivered' : 'failed',
        delivered_at: sent.ok ? new Date().toISOString() : null,
        last_error: sent.error,
        lease_token: null,
        locked_at: null,
      })
      .eq('order_id', orderId)
      .eq('lease_token', job.lease_token);
    if (saveError) return 'unavailable';
    if (sent.ok) return 'delivered';
  }
  return 'failed';
}
