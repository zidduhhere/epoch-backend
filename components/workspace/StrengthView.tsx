'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { setClassStrengths } from '@/app/actions/workspace';
import { DEPARTMENTS } from '@/lib/departments';
import type { ClassInfo } from '@/lib/types';
import { Button, ErrorText, inputClass, useSubmit } from './ui';

const toText = (count?: number) => (count === undefined ? '' : String(count));

export function StrengthView({ classes }: { classes: ClassInfo[] }) {
  const sorted = useMemo(
    () =>
      [...classes].sort(
        (a, b) =>
          DEPARTMENTS.indexOf(a.branch as (typeof DEPARTMENTS)[number]) -
            DEPARTMENTS.indexOf(b.branch as (typeof DEPARTMENTS)[number]) || a.year - b.year,
      ),
    [classes],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(classes.map((cls) => [cls.id, toText(cls.total_students)])),
  );
  const [saved, setSaved] = useState(false);
  const save = useSubmit();

  const invalid = (text: string) => text !== '' && !/^\d{1,3}$/.test(text);
  const hasInvalid = Object.values(values).some(invalid);
  const changed = sorted.filter((cls) => (values[cls.id] ?? '') !== toText(cls.total_students));
  const total = sorted.reduce((sum, cls) => sum + (Number(values[cls.id]) || 0), 0);
  const unset = sorted.filter((cls) => (values[cls.id] ?? '') === '').length;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const entries = changed.map((cls) => ({
      classId: cls.id,
      count: values[cls.id] === '' ? null : Number(values[cls.id]),
    }));
    save.submit(() => setClassStrengths(entries), () => setSaved(true));
  }

  return (
    <form onSubmit={handleSubmit}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Class strength</h1>
          <p className="mt-1 text-sm text-ink-2">
            Total students in each class. Analytics uses this so the target covers every student, not only those entered so far.
          </p>
        </div>
        <Button variant="primary" type="submit" disabled={save.pending || hasInvalid || changed.length === 0}>
          {save.pending ? 'Saving…' : 'Save'}
        </Button>
      </header>

      <p className="mt-4 font-medium tabular-nums">
        {total.toLocaleString('en-IN')} students across the college
        {unset > 0 && <span className="font-normal text-alert"> · {unset} classes not set</span>}
      </p>
      <div className="mt-2" role="status">
        <ErrorText>{save.error}</ErrorText>
        {saved && changed.length === 0 && <p className="text-sm text-ink-2">Saved.</p>}
      </div>

      <ul className="mt-2 divide-y divide-line border-y border-line bg-surface">
        {sorted.map((cls) => (
          <li key={cls.id} className="flex items-center justify-between gap-3 p-3">
            <label htmlFor={`strength-${cls.id}`} className="font-medium">
              {cls.name}
            </label>
            <input
              id={`strength-${cls.id}`}
              type="text"
              inputMode="numeric"
              placeholder="Not set"
              aria-invalid={invalid(values[cls.id] ?? '')}
              value={values[cls.id] ?? ''}
              onChange={(event) => {
                setSaved(false);
                setValues((current) => ({ ...current, [cls.id]: event.target.value.trim() }));
              }}
              className={`${inputClass} w-28 text-right tabular-nums ${invalid(values[cls.id] ?? '') ? 'border-alert' : ''}`}
            />
          </li>
        ))}
      </ul>
    </form>
  );
}
