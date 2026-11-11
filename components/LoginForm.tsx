'use client';

import { useActionState } from 'react';
import { signIn } from '@/app/actions/auth';
import { inputClass } from './workspace/ui';

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Mobile number</span>
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder="98765 43210"
          required
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="on-ink h-11 w-full rounded bg-ink font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-sm text-ink-2">Forgot your password? Ask the admin to reset it.</p>
    </form>
  );
}
