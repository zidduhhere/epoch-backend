import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Workspace } from '@/components/workspace/Workspace';
import { loadWorkspace } from '@/lib/server/data';
import { getCurrentUser } from '@/lib/server/session';

export default function Home() {
  return (
    <Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}>
      <SignedInWorkspace />
    </Suspense>
  );
}

async function SignedInWorkspace() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const data = await loadWorkspace(user);
  return <Workspace user={user} data={data} />;
}
