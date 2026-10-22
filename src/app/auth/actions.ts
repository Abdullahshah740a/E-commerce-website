'use server';
import { sessionDb } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { z } from 'zod';
export async function login(_previous: { error: string }, form: FormData) {
  const result = z
    .object({ email: z.email(), password: z.string().min(8).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!result.success)
    return { error: 'Enter a valid email and password (at least 8 characters).' };
  try {
    const db = await sessionDb();
    const { data, error } = await db.auth.signInWithPassword(result.data);
    if (error || !data.user) return { error: 'Unable to sign in. Check your email and password.' };
    const { data: admin } = await db
      .from('admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (!admin) {
      await db.auth.signOut();
      return { error: 'This account is not authorized to administer the store.' };
    }
  } catch {
    return { error: 'Authentication is unavailable. Check the Supabase configuration.' };
  }
  redirect('/admin');
}
export async function logout() {
  const db = await sessionDb();
  await db.auth.signOut();
  redirect('/admin/login');
}
export async function requestReset(_previous: { error: string }, form: FormData) {
  const email = z.email().safeParse(form.get('email'));
  if (!email.success) return { error: 'Enter a valid email.' };
  try {
    const db = await sessionDb();
    const url = process.env.NEXT_PUBLIC_SITE_URL;
    if (!url) return { error: 'The site URL is not configured.' };
    const { error } = await db.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${url}/auth/confirm?next=/admin/reset`,
    });
    if (error) return { error: 'Unable to request a reset. Please try again later.' };
    return { error: 'If the account exists, a reset link will arrive by email.' };
  } catch {
    return { error: 'Authentication is not configured.' };
  }
}
export async function resetPassword(_previous: { error: string }, form: FormData) {
  const password = z.string().min(12).max(200).safeParse(form.get('password'));
  if (!password.success) return { error: 'Use at least 12 characters.' };
  try {
    const db = await sessionDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { error: 'Open the password reset link from your email first.' };
    const { error } = await db.auth.updateUser({ password: password.data });
    if (error) return { error: 'Unable to update the password. Request a new reset link.' };
    await db.auth.signOut();
  } catch {
    return { error: 'Authentication is unavailable.' };
  }
  redirect('/admin/login');
}
