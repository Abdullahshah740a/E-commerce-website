import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // Next's proxy can normalize request.url to localhost. Compare with the actual
  // HTTP Host instead; browsers cannot choose an unrelated Host for a request.
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  let valid = false;
  try {
    const source = new URL(origin || '');
    valid = source.host === host && source.protocol === url.protocol;
  } catch {}
  if (!valid) throw new Error('Invalid request origin');
}
export async function readJson(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 100000)
    throw new Error('Request is too large');
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Empty JSON body');
  const decoder = new TextDecoder();
  let length = 0;
  let raw = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 100000) {
      await reader.cancel();
      throw new Error('Request is too large');
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  return JSON.parse(raw);
}
export function failure(error: unknown) {
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: 'Enter a valid JSON request.' },
      { status: 400, headers: noStore },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : '';
  if (message === 'Unauthorized')
    return NextResponse.json({ error: 'Please sign in as an administrator.' }, { status: 401 });
  if (['Invalid request origin', 'Request is too large'].includes(message))
    return NextResponse.json({ error: message }, { status: 400 });
  return NextResponse.json(
    {
      error:
        'The request could not be completed. Please try again or check the store configuration.',
    },
    { status: 503, headers: noStore },
  );
}
export const noStore = { 'Cache-Control': 'private, no-store' };
