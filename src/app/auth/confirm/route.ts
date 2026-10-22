import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sessionDb } from '@/lib/supabase';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');
  const db = await sessionDb();
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/admin/reset', url.origin));
  }
  if (token_hash && type === 'recovery') {
    const { error } = await db.auth.verifyOtp({ type: type as EmailOtpType, token_hash });
    if (!error) return NextResponse.redirect(new URL('/admin/reset', url.origin));
  }
  return NextResponse.redirect(new URL('/admin/login?error=expired-link', url.origin));
}
