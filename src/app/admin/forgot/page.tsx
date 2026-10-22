import { AuthForm } from '@/components/auth-form';
export const metadata = { title: 'Reset password', robots: { index: false } };
export default function Page() {
  return (
    <section className="auth-card">
      <h1>Reset your password.</h1>
      <p>We’ll email a secure reset link.</p>
      <AuthForm mode="forgot" />
    </section>
  );
}
