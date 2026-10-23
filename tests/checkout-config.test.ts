import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { CheckoutSetupError, checkoutRateSecret } from '@/lib/checkout-config';

describe('Production checkout configuration', () => {
  it('derives a stable independent rate-limit key if only the Supabase server key is set', () => {
    const env = { SUPABASE_SECRET_KEY: 'test-only-server-key' };
    const value = checkoutRateSecret(env);
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(value).not.toBe(env.SUPABASE_SECRET_KEY);
    expect(checkoutRateSecret(env)).toBe(value);
    expect(checkoutRateSecret({ SUPABASE_SECRET_KEY: 'another-test-key' })).not.toBe(value);
  });
  it('retains an explicit valid rate-limit key', () => {
    const secret = 'x'.repeat(32);
    expect(
      checkoutRateSecret({ SUPABASE_SECRET_KEY: 'test-key', CHECKOUT_RATE_LIMIT_SECRET: secret }),
    ).toBe(secret);
  });
  it('identifies missing server credentials without including their values', () => {
    try {
      checkoutRateSecret({});
      throw new Error('Should reject missing configuration');
    } catch (error) {
      expect(error).toBeInstanceOf(CheckoutSetupError);
      expect((error as CheckoutSetupError).code).toBe('CHECKOUT_SERVER_KEY_MISSING');
    }
  });
  it('rejects a short explicitly configured rate-limit secret', () => {
    expect(() =>
      checkoutRateSecret({
        SUPABASE_SECRET_KEY: 'test-only-server-key',
        CHECKOUT_RATE_LIMIT_SECRET: 'short',
      }),
    ).toThrow(CheckoutSetupError);
  });
});
