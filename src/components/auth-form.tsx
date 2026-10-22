'use client';
import { useActionState } from 'react';
import { login, requestReset, resetPassword } from '@/app/auth/actions';
export function AuthForm({ mode = 'login' }: { mode?: 'login' | 'forgot' | 'reset' }) {
  const [state, action, pending] = useActionState(
    mode === 'login' ? login : mode === 'forgot' ? requestReset : resetPassword,
    { error: '' },
  );
  return (
    <form action={action} className="form-stack">
      {mode !== 'reset' && (
        <label>
          Email address
          <input type="email" name="email" autoComplete="username" required />
        </label>
      )}
      {mode !== 'forgot' && (
        <label>
          {mode === 'reset' ? 'New password' : 'Password'}
          <input
            type="password"
            name="password"
            minLength={mode === 'reset' ? 12 : 8}
            autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
            required
          />
        </label>
      )}
      <button className="button" disabled={pending}>
        {pending
          ? 'Please wait…'
          : mode === 'login'
            ? 'Sign in'
            : mode === 'forgot'
              ? 'Send reset link'
              : 'Update password'}
      </button>
      {state.error && (
        <p role="status" className="notice">
          {state.error}
        </p>
      )}
    </form>
  );
}
