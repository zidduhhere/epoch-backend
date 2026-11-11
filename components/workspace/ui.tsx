'use client';

import { useEffect, useRef, useState, useTransition, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ActionResult } from '@/lib/types';

export const inputClass =
  'h-11 w-full rounded border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 lg:h-10 lg:text-sm';

export function rupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Who made an audit entry, with the position when the person is a titled admin. */
export function actorLabel(name: string, role: string) {
  return role === 'admin' || role === 'class_rep' ? name : `${name} (${role})`;
}

/** Runs a Server Function and tracks whether it is pending and any error it returned. */
export function useSubmit() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function submit(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError('');
    startTransition(async () => {
      const result = await action();
      if (result.ok) onDone?.();
      else setError(result.error);
    });
  }

  return { pending, error, submit };
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' };

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  const look = {
    primary: 'on-ink bg-ink text-white font-medium',
    secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
    quiet: 'text-ink underline-offset-2 hover:underline',
  }[variant];

  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-1.5 rounded px-3 text-sm whitespace-nowrap disabled:opacity-60 lg:h-9 ${look} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-2">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-alert">
      {children}
    </p>
  );
}

/** A bottom sheet on phones and a centred dialog on larger screens. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface py-2 pr-2 pl-4">
        <h2 className="truncate font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded hover:bg-canvas">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{open && children}</div>
    </dialog>
  );
}
