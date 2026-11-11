'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { createLogin, resetLoginPassword, setLoginActive } from '@/app/actions/workspace';
import { DEPARTMENTS } from '@/lib/departments';
import type { Account, ClassInfo } from '@/lib/types';
import { Button, ErrorText, Field, inputClass, Sheet, useSubmit } from './ui';

export function LoginsView({
  accounts,
  classes,
  currentUserId,
}: {
  accounts: Account[];
  classes: ClassInfo[];
  currentUserId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<Account | null>(null);
  const [query, setQuery] = useState('');
  const toggle = useSubmit();

  const sortedClasses = useMemo(
    () =>
      [...classes].sort(
        (a, b) =>
          DEPARTMENTS.indexOf(a.branch as (typeof DEPARTMENTS)[number]) - DEPARTMENTS.indexOf(b.branch as (typeof DEPARTMENTS)[number]) ||
          a.year - b.year,
      ),
    [classes],
  );
  const classNames = new Map(classes.map((c) => [c.id, c.name]));
  const covered = new Set(accounts.filter((a) => a.is_active).map((a) => a.assigned_class_id));
  const missing = classes.filter((c) => !covered.has(c.id)).length;

  const q = query.trim().toLowerCase();
  const visible = accounts.filter(
    (a) =>
      !q ||
      a.full_name.toLowerCase().includes(q) ||
      a.phone.includes(q) ||
      a.title?.toLowerCase().includes(q) ||
      classNames.get(a.assigned_class_id ?? '')?.toLowerCase().includes(q),
  );

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logins</h1>
          {missing > 0 && (
            <p className="mt-1 font-medium text-alert">
              {missing} of {classes.length} classes have no coordinator
            </p>
          )}
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          Add login
        </Button>
      </header>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, number, class or position"
        aria-label="Search logins"
        className={`${inputClass} mt-4 sm:max-w-sm`}
      />

      <div className="mt-3">
        <ErrorText>{toggle.error}</ErrorText>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-ink-2">No logins match.</p>
      ) : (
        <ul className="mt-1 divide-y divide-line border-y border-line bg-surface">
          {visible.map((account) => (
            <li key={account.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {account.full_name}
                  {!account.is_active && <span className="font-normal text-ink-2"> (disabled)</span>}
                </p>
                <p className="text-sm tabular-nums text-ink-2">
                  {account.phone}, {account.role === 'admin' ? (account.title ?? 'Admin') : (classNames.get(account.assigned_class_id ?? '') ?? 'No class')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button onClick={() => setResetting(account)}>Reset password</Button>
                {account.id !== currentUserId && (
                  <Button disabled={toggle.pending} onClick={() => toggle.submit(() => setLoginActive(account.id, !account.is_active))}>
                    {account.is_active ? 'Disable' : 'Enable'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={adding} title="Add login" onClose={() => setAdding(false)}>
        <AddLoginForm classes={sortedClasses} onSaved={() => setAdding(false)} />
      </Sheet>
      <Sheet open={Boolean(resetting)} title={`Reset password for ${resetting?.full_name ?? ''}`} onClose={() => setResetting(null)}>
        {resetting && <ResetForm account={resetting} onSaved={() => setResetting(null)} />}
      </Sheet>
    </>
  );
}

function AddLoginForm({ classes, onSaved }: { classes: ClassInfo[]; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'class_rep' | 'admin'>('class_rep');
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const save = useSubmit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.submit(() => createLogin({ fullName, phone, password, role, title, classId: role === 'class_rep' ? classId : undefined }), onSaved);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <Field label="Name">
        <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Mobile number" hint="This is what they sign in with.">
        <input type="tel" inputMode="numeric" required value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Password" hint="At least 8 characters. Share it with them privately.">
        <input type="text" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Role">
        <select value={role} onChange={(event) => setRole(event.target.value as 'class_rep' | 'admin')} className={inputClass}>
          <option value="class_rep">Class coordinator</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      {role === 'admin' && (
        <Field label="Position" hint="Shown beside their name in the audit log.">
          <input required list="admin-positions" maxLength={60} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
          <datalist id="admin-positions">
            <option value="Treasurer" />
            <option value="Main coordinator" />
          </datalist>
        </Field>
      )}
      {role === 'class_rep' && (
        <Field label="Class">
          <select required value={classId} onChange={(event) => setClassId(event.target.value)} className={inputClass}>
            <option value="">Choose a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" variant="primary" disabled={save.pending} className="w-full">
        {save.pending ? 'Adding…' : 'Add login'}
      </Button>
    </form>
  );
}

function ResetForm({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const save = useSubmit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.submit(() => resetLoginPassword(account.id, password), onSaved);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <Field label="New password" hint="At least 8 characters. They will be signed out everywhere.">
        <input type="text" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
      </Field>
      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" variant="primary" disabled={save.pending} className="w-full">
        Reset password
      </Button>
    </form>
  );
}
