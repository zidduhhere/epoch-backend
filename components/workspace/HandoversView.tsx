'use client';

import { useMemo, useState } from 'react';
import { createHandover, reviewHandover } from '@/app/actions/workspace';
import { formatDateTimeIST } from '@/lib/date-utils';
import type { ClassInfo, Handover, HandoverStatus, Payment, Student } from '@/lib/types';
import { Button, ErrorText, Field, inputClass, rupees, useSubmit } from './ui';

const STATUS_TEXT: Record<HandoverStatus, string> = {
  pending: 'Waiting for the admin to confirm',
  confirmed: 'Received by the treasurer',
  rejected: 'Rejected',
};

function StatusPill({ status }: { status: HandoverStatus }) {
  const look =
    status === 'confirmed' ? 'bg-ink text-white' : status === 'rejected' ? 'border border-alert text-alert' : 'border border-line text-ink-2';
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${look}`}>{STATUS_TEXT[status]}</span>;
}

/** "Part paid: ₹1,000 of ₹2,600, ₹1,600 left" for a student who has not finished paying. */
function partialNote(student?: Student) {
  if (!student || student.amount_paid >= student.amount_due) return null;
  return `Part paid: ${rupees(student.amount_paid)} of ${rupees(student.amount_due)}, ${rupees(student.amount_due - student.amount_paid)} left`;
}

function groupByStudent(payments: Payment[]) {
  const groups = new Map<string, { studentId: string; name: string; payments: Payment[] }>();
  for (const payment of payments) {
    const group = groups.get(payment.student_id) ?? { studentId: payment.student_id, name: payment.student_name, payments: [] };
    group.payments.push(payment);
    groups.set(payment.student_id, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Whose fund is in a handover. */
function WhoseFund({ payments, students }: { payments: Payment[]; students: Map<string, Student> }) {
  return (
    <ul className="mt-2 divide-y divide-line border-y border-line text-sm">
      {groupByStudent(payments).map((group) => {
        const note = partialNote(students.get(group.studentId));
        return (
          <li key={group.studentId} className="flex items-start justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block font-medium">{group.name}</span>
              {note && <span className="block text-alert">{note}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{rupees(group.payments.reduce((sum, p) => sum + p.amount, 0))}</span>
          </li>
        );
      })}
    </ul>
  );
}

function indexStudents(students: Student[]) {
  return new Map(students.map((student) => [student.id, student]));
}

/* ------------------------------------------------------------------ coordinator */

export function CoordinatorHandover(props: { classId: string; students: Student[]; payments: Payment[]; handovers: Handover[] }) {
  const myHandovers = props.handovers.filter((h) => h.class_id === props.classId);
  const byStudent = useMemo(() => indexStudents(props.students), [props.students]);
  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Hand over to the treasurer</h1>
        <p className="mt-1 text-sm text-ink-2">
          Tick the students whose money (UPI and cash) you are giving to the treasurer and enter the amount you hand over. The admin confirms
          once they have received it.
        </p>
      </header>
      <HandoverForm classId={props.classId} students={props.students} payments={props.payments} />
      <section className="mt-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          Your handovers
        </h2>
        <HandoverList handovers={myHandovers} payments={props.payments} students={byStudent} empty="You have not handed over anything yet." />
      </section>
    </>
  );
}

/** Pick students, type the amount, hand over. Used by a coordinator, and by an admin recording one for them. */
function HandoverForm({
  classId,
  students,
  payments,
  byAdmin = false,
}: {
  classId: string;
  students: Student[];
  payments: Payment[];
  byAdmin?: boolean;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState<string | null>(null);
  const submit = useSubmit();
  const byStudent = useMemo(() => indexStudents(students), [students]);

  const ready = useMemo(() => payments.filter((p) => p.class_id === classId && !p.handover_id), [payments, classId]);
  const groups = useMemo(() => groupByStudent(ready), [ready]);
  const total = ready.filter((p) => picked.has(p.id)).reduce((sum, p) => sum + p.amount, 0);
  const amountText = typed ?? (total > 0 ? String(total) : '');
  const amount = Number(amountText);
  const amountProblem =
    picked.size === 0 ? null : !(amount > 0) ? 'Enter the amount handed over.' : amount > total ? `It cannot be more than ${rupees(total)}, what these students paid.` : null;

  function toggle(ids: string[], on: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function handOver() {
    submit.submit(() => createHandover(classId, [...picked], amount), () => {
      setPicked(new Set());
      setTyped(null);
    });
  }

  return (
    <>
      <section className="mt-5" aria-labelledby="ready-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="ready-heading" className="text-lg font-semibold">
            With you, not handed over
          </h2>
          {ready.length > 0 && (
            <Button onClick={() => toggle(ready.map((p) => p.id), picked.size < ready.length)}>
              {picked.size < ready.length ? 'Select all' : 'Clear'}
            </Button>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="mt-2 text-ink-2">Nothing to hand over right now.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-y border-line bg-surface">
            {groups.map((group) => {
              const ids = group.payments.map((p) => p.id);
              const all = ids.every((id) => picked.has(id));
              const note = partialNote(byStudent.get(group.studentId));
              return (
                <li key={group.studentId} className="p-3">
                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 accent-ink"
                      checked={all}
                      onChange={(event) => toggle(ids, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{group.name}</span>
                      {note && <span className="block text-sm text-alert">{note}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{rupees(group.payments.reduce((sum, p) => sum + p.amount, 0))}</span>
                  </label>
                  {group.payments.length > 1 && (
                    <ul className="mt-1 ml-8 space-y-1 text-sm text-ink-2">
                      {group.payments.map((payment) => (
                        <li key={payment.id}>
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              className="size-4 accent-ink"
                              checked={picked.has(payment.id)}
                              onChange={(event) => toggle([payment.id], event.target.checked)}
                            />
                            <span className="tabular-nums">
                              {rupees(payment.amount)} on {formatDateTimeIST(payment.paid_at)}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {ready.length > 0 && (
          <div className="mt-3 space-y-2">
            <Field
              label="Amount handed over (₹)"
              hint={picked.size > 0 ? `${rupees(total)} was paid by the students you ticked. Change this if you hand over less; the rest stays with you for a later handover.` : 'Tick students first.'}
            >
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={amountText}
                disabled={picked.size === 0}
                onChange={(event) => setTyped(event.target.value)}
                className={inputClass}
              />
            </Field>
            <ErrorText>{amountProblem ?? submit.error}</ErrorText>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              disabled={submit.pending || picked.size === 0 || Boolean(amountProblem)}
              onClick={handOver}
            >
              {submit.pending
                ? 'Saving…'
                : picked.size === 0
                  ? 'Choose students to hand over'
                  : byAdmin
                    ? `Record ${rupees(amount || 0)} as received`
                    : `Hand over ${rupees(amount || 0)}`}
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

function HandoverList({
  handovers,
  payments,
  students,
  empty,
  classNames,
  children,
}: {
  handovers: Handover[];
  payments: Payment[];
  students: Map<string, Student>;
  empty: string;
  classNames?: Map<string, string>;
  children?: (handover: Handover) => React.ReactNode;
}) {
  if (handovers.length === 0) return <p className="mt-2 text-ink-2">{empty}</p>;
  return (
    <ul className="mt-2 divide-y divide-line border-y border-line bg-surface">
      {handovers.map((handover) => {
        const items = payments.filter((p) => p.handover_id === handover.id);
        return (
          <li key={handover.id} className="p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold tabular-nums">
                  {rupees(handover.amount)}
                  {classNames && <span className="font-normal text-ink-2">, {classNames.get(handover.class_id) ?? 'Class'}</span>}
                </p>
                <p className="text-sm text-ink-2">
                  {handover.created_by_name}, {formatDateTimeIST(handover.created_at)}
                </p>
              </div>
              <StatusPill status={handover.status} />
            </div>
            {handover.status !== 'pending' && handover.reviewed_by_name && (
              <p className="mt-1 text-sm text-ink-2">
                {handover.status === 'confirmed' ? 'Confirmed' : 'Rejected'} by {handover.reviewed_by_name}
                {handover.reviewed_at ? `, ${formatDateTimeIST(handover.reviewed_at)}` : ''}
                {handover.review_note ? `. ${handover.review_note}` : ''}
              </p>
            )}
            {items.length > 0 && (
              <details className="mt-2" open={handover.status === 'pending' && Boolean(children)}>
                <summary className="cursor-pointer text-sm underline underline-offset-2">Whose fund ({items.length})</summary>
                <WhoseFund payments={items} students={students} />
              </details>
            )}
            {children?.(handover)}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ admin */

export function AdminHandovers({
  classes,
  students,
  payments,
  handovers,
}: {
  classes: ClassInfo[];
  students: Student[];
  payments: Payment[];
  handovers: Handover[];
}) {
  const byStudent = useMemo(() => indexStudents(students), [students]);
  const classNames = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const pending = handovers.filter((h) => h.status === 'pending');
  const reviewed = handovers.filter((h) => h.status !== 'pending');
  const pendingTotal = pending.reduce((sum, h) => sum + h.amount, 0);
  const [recordClass, setRecordClass] = useState('');

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Handovers</h1>
        <p className="mt-1 text-sm text-ink-2">
          {pending.length > 0
            ? `${pending.length} waiting for you, ${rupees(pendingTotal)} in total. Confirm only after you have received the money.`
            : 'Nothing is waiting for you.'}
        </p>
      </header>

      {pending.length > 0 && (
        <section className="mt-5" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-lg font-semibold">
            Waiting to be confirmed
          </h2>
          <HandoverList
            handovers={pending}
            payments={payments}
            students={byStudent}
            classNames={classNames}
            empty=""
          >
            {(handover) => <ReviewControls handoverId={handover.id} />}
          </HandoverList>
        </section>
      )}

      <section className="mt-8" aria-labelledby="record-heading">
        <h2 id="record-heading" className="text-lg font-semibold">
          Record a handover for a coordinator
        </h2>
        <p className="mt-1 text-sm text-ink-2">Use this when a coordinator gave you the money in person. It is saved as already received.</p>
        <select
          value={recordClass}
          onChange={(event) => setRecordClass(event.target.value)}
          aria-label="Class"
          className={`${inputClass} mt-2 sm:max-w-xs`}
        >
          <option value="">Choose a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {recordClass && <HandoverForm key={recordClass} classId={recordClass} students={students} payments={payments} byAdmin />}
      </section>

      <section className="mt-8" aria-labelledby="reviewed-heading">
        <h2 id="reviewed-heading" className="text-lg font-semibold">
          Earlier handovers
        </h2>
        <HandoverList handovers={reviewed} payments={payments} students={byStudent} classNames={classNames} empty="No handovers reviewed yet." />
      </section>
    </>
  );
}

function ReviewControls({ handoverId }: { handoverId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const action = useSubmit();

  return (
    <div className="mt-3 space-y-2">
      {rejecting ? (
        <>
          <input
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why is it rejected? The coordinator will see this."
            aria-label="Reason for rejecting"
            className={inputClass}
          />
          <div className="flex gap-2">
            <Button disabled={action.pending} onClick={() => action.submit(() => reviewHandover(handoverId, false, note))}>
              Reject handover
            </Button>
            <Button variant="quiet" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <Button variant="primary" disabled={action.pending} onClick={() => action.submit(() => reviewHandover(handoverId, true))}>
            {action.pending ? 'Saving…' : 'Confirm received'}
          </Button>
          <Button onClick={() => setRejecting(true)}>Reject</Button>
        </div>
      )}
      <ErrorText>{action.error}</ErrorText>
    </div>
  );
}
