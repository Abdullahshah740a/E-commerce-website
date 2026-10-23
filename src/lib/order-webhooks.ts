import 'server-only';
import { privilegedDb } from './supabase';
import { makeWebhookUrl, sendOrderWebhook, type OrderEvent } from './webhook-request';

// Owner-requested default. Keep this module server-only so the endpoint never
// enters the browser bundle. An environment value can override it later.
const DEFAULT_ORDER_WEBHOOK_URL = 'https://hook.eu1.make.com/b1q2d69jbmsjsdgvmcomu6tauf4rnek1';

export function orderWebhookUrl() {
  return process.env.ORDER_WEBHOOK_URL?.trim() || DEFAULT_ORDER_WEBHOOK_URL;
}

export function webhookConfigured() {
  return !!makeWebhookUrl(orderWebhookUrl());
}

export async function deliverOrderWebhook(orderId: string) {
  const db = privilegedDb();
  const url = orderWebhookUrl();
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
