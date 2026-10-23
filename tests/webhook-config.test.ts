import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({ privilegedDb: vi.fn() }));
import { orderWebhookUrl, webhookConfigured } from '@/lib/order-webhooks';

afterEach(() => vi.unstubAllEnvs());

describe('Server-side webhook default', () => {
  it('keeps checkout configured when Vercel has no webhook environment variable', () => {
    vi.stubEnv('ORDER_WEBHOOK_URL', undefined);
    expect(webhookConfigured()).toBe(true);
    const url = new URL(orderWebhookUrl());
    expect(url.hostname).toBe('hook.eu1.make.com');
    expect(url.pathname.length).toBeGreaterThan(1);
  });
  it('uses the same default for an empty environment value', () => {
    vi.stubEnv('ORDER_WEBHOOK_URL', '  ');
    expect(webhookConfigured()).toBe(true);
  });
  it('allows a server environment override', () => {
    vi.stubEnv('ORDER_WEBHOOK_URL', ' https://hook.eu1.make.com/test-override ');
    expect(orderWebhookUrl()).toBe('https://hook.eu1.make.com/test-override');
    expect(webhookConfigured()).toBe(true);
  });
  it('rejects an invalid explicit override', () => {
    vi.stubEnv('ORDER_WEBHOOK_URL', 'https://unrelated.example/test');
    expect(webhookConfigured()).toBe(false);
  });
});
