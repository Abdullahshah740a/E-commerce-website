import 'server-only';
import { createHmac } from 'node:crypto';

export class CheckoutSetupError extends Error {
  constructor(public readonly code: string) {
    super('Order service setup is incomplete. Please contact the store.');
  }
}

export function checkoutRateSecret(env: Record<string, string | undefined> = process.env) {
  const serverKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!serverKey) throw new CheckoutSetupError('CHECKOUT_SERVER_KEY_MISSING');
  const configured = env.CHECKOUT_RATE_LIMIT_SECRET?.trim();
  if (configured) {
    if (configured.length < 32) throw new CheckoutSetupError('CHECKOUT_RATE_SECRET_INVALID');
    return configured;
  }
  // A distinct, deterministic HMAC key avoids requiring another production
  // variable while retaining keyed hashes. Never expose the server key itself.
  return createHmac('sha256', serverKey).update('rahat-checkout-rate-limit-v1').digest('hex');
}
