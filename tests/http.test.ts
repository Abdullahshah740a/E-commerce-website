import { describe, it, expect } from 'vitest';
import { readJson, sameOrigin, failure } from '@/lib/http';
describe('Mutation request boundaries', () => {
  it('accepts same-origin requests and rejects missing or foreign origins', () => {
    expect(() =>
      sameOrigin(
        new Request('https://store.test/api/admin', { headers: { Origin: 'https://store.test' } }),
      ),
    ).not.toThrow();
    expect(() =>
      sameOrigin(
        new Request('https://store.test/api/admin', { headers: { Origin: 'https://other.test' } }),
      ),
    ).toThrow('Invalid request origin');
    expect(() => sameOrigin(new Request('https://store.test/api/admin'))).toThrow();
  });
  it('rejects a large payload before parsing JSON', async () => {
    await expect(
      readJson(
        new Request('https://store.test/api/admin', { method: 'POST', body: 'x'.repeat(100001) }),
      ),
    ).rejects.toThrow('Request is too large');
  });
  it('accepts the browser Host when a proxy normalizes the internal URL', () => {
    expect(() =>
      sameOrigin(
        new Request('http://localhost:3000/api/admin', {
          headers: { Host: '127.0.0.1:3000', Origin: 'http://127.0.0.1:3000' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      sameOrigin(
        new Request('http://localhost:3000/api/admin', {
          headers: { Host: '127.0.0.1:3000', Origin: 'http://evil.test' },
        }),
      ),
    ).toThrow('Invalid request origin');
  });
  it('parses valid JSON and returns helpful invalid-JSON errors', async () => {
    expect(
      await readJson(
        new Request('https://store.test/api/admin', { method: 'POST', body: '{"quantity":2}' }),
      ),
    ).toEqual({ quantity: 2 });
    const response = failure(new SyntaxError('Unexpected character'));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Enter a valid JSON request.');
  });
  it('does not expose database details in an error response', async () => {
    const response = failure(new Error('password=secret or customer phone'));
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain('secret');
    expect(body).not.toContain('customer phone');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
