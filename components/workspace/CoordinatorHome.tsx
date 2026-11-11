'use client';

import { useMemo } from 'react';
import { addDays, dayLabel, money, percentOf, plural, statsByClass, todayIST } from '@/components/analytics/metrics';
import type { ClassInfo, Handover, Payment, Student } from '@/lib/types';
import { Button } from './ui';

/** A coordinator's own dashboard: the last three days, progress, and money still to hand over. */
export function CoordinatorHome({
  cls,
  students,
  payments,
  handovers,
  onOpenStudents,
  onOpenHandover,
}: {
  cls: ClassInfo;
  students: Student[];
  payments: Payment[];
  handovers: Handover[];
  onOpenStudents: () => void;
  onOpenHandover: () => void;
}) {
  const today = todayIST();
  const days = [
    { date: today, title: 'Today' },
    { date: addDays(today, -1), title: 'Yesterday' },
    { date: addDays(today, -2), title: 'Day before yesterday' },
  ].map((day) => {
    const rows = payments.filter((p) => p.paid_on === day.date);
    return { ...day, total: rows.reduce((sum, p) => sum + p.amount, 0), count: rows.length };
  });

  const stats = useMemo(() => statsByClass([cls], students, payments)[0], [cls, students, payments]);
  const percent = percentOf(stats.collected, stats.target);
  const partial = students.filter((s) => s.amount_paid > 0 && s.amount_paid < s.amount_due);
  const partialLeft = partial.reduce((sum, s) => sum + (s.amount_due - s.amount_paid), 0);
  const pending = handovers.filter((h) => h.status === 'pending').length;

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{cls.name}</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {cls.total_students !== undefined
            ? `${plural(cls.total_students, 'student')} in your class, ${students.length} entered so far`
            : `${students.length} students entered. The admin has not set the class strength yet.`}
        </p>
      </header>

      <section className="mt-5" aria-label="Collected in the last three days">
        <h2 className="sr-only">Collected in the last three days</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {days.map((day) => (
            <div key={day.date} className="border border-line bg-surface p-4">
              <p className="text-sm text-ink-2">
                {day.title}, {dayLabel(day.date)}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{money(day.total)}</p>
              <p className="mt-1 text-sm text-ink-2">{day.count === 0 ? 'Nothing recorded' : plural(day.count, 'payment')}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-2">Missed a payment? Add it from the Students screen. It is dated the day you enter it.</p>
      </section>

      <section className="mt-8" aria-label="Progress">
        <h2 className="text-lg font-semibold">Progress</h2>
        <p className="mt-2 tabular-nums">
          <span className="text-3xl font-semibold tracking-tight">{money(stats.collected)}</span>
          <span className="text-ink-2"> of {money(stats.target)} expected</span>
        </p>
        <div className="mt-2 h-1.5 bg-line" role="img" aria-label={`${percent ?? 0}% collected`}>
          <div className="h-full bg-ink" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
        </div>
        <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm tabular-nums">
          <span className="text-ink-2">
            {stats.paidInFullCount} of {plural(stats.enrolled || stats.studentCount, 'student')} paid in full
          </span>
          {stats.outstanding > 0 && <span className="font-medium text-alert">{money(stats.outstanding)} still due</span>}
        </p>
        {partial.length > 0 && (
          <p className="mt-2 text-sm text-alert">
            {plural(partial.length, 'student')} part paid, {money(partialLeft)} left between them.
          </p>
        )}
      </section>

      <section className="mt-8" aria-label="Money to hand over">
        <h2 className="text-lg font-semibold">UPI and cash handover</h2>
        <dl className="mt-2 divide-y divide-line border-y border-line bg-surface text-sm tabular-nums">
          <div className="flex justify-between gap-3 p-3">
            <dt>With you, not handed over</dt>
            <dd className="font-semibold">{money(stats.withCoordinators)}</dd>
          </div>
          <div className="flex justify-between gap-3 p-3">
            <dt>Handed over, waiting for the admin{pending > 0 ? ` (${pending})` : ''}</dt>
            <dd className="font-semibold">{money(stats.awaitingTreasurer)}</dd>
          </div>
          <div className="flex justify-between gap-3 p-3">
            <dt>Received by the treasurer</dt>
            <dd className="font-semibold">{money(stats.inVault)}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onOpenHandover}>
            Hand over
          </Button>
          <Button onClick={onOpenStudents}>Open students</Button>
        </div>
      </section>
    </>
  );
}
