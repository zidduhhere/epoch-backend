import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/server/session';

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center bg-surface px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-tight">EPOCH 2026 fund collection</h1>
        <p className="mt-2 text-ink-2">Sign in with the mobile number your admin registered.</p>
        <Suspense fallback={<LoginForm />}>
          <RedirectIfSignedIn />
        </Suspense>
      </div>
    </main>
  );
}

async function RedirectIfSignedIn() {
  // A stale cookie resolves to no user here and simply shows the form.
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect('/');
  return <LoginForm />;
}
