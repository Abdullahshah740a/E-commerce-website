import { AuthForm } from '@/components/auth-form';
export const metadata = { title: 'Choose a new password', robots: { index: false } };
export default function Page() {
  return (
    <section className="auth-card">
      <h1>Choose a new password.</h1>
      <AuthForm mode="reset" />
    </section>
  );
}
