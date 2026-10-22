import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { isConfigured } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administrator sign in', robots: { index: false, follow: false } };
export default function Login() {
  return (
    <section className="auth-card">
      <span className="eyebrow">STORE ADMINISTRATION</span>
      <h1>Welcome back.</h1>
      <p>Sign in to manage your products and orders.</p>
      {!isConfigured() ? (
        <p className="notice">Configure Supabase in .env.local to enable administrator login.</p>
      ) : (
        <AuthForm />
      )}
      <Link href="/admin/forgot" className="text-link">
        Forgot your password?
      </Link>
    </section>
  );
}
