'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold">This page could not load</h1>
      <p className="mt-2 text-ink-2">Check your connection and try again. If it keeps happening, tell the admin.</p>
      <button onClick={reset} className="on-ink mt-6 h-11 rounded bg-ink px-4 font-medium text-white">
        Try again
      </button>
    </main>
  );
}
