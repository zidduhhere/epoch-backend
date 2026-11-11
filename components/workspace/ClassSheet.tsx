'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Download, PartyPopper, Plus, Search } from 'lucide-react';
import { addStudent, getStudentHistory, recordPayment } from '@/app/actions/workspace';
import { congratulation } from '@/lib/congrats';
import { downloadCsv } from '@/lib/csv';
import { formatDateTimeIST } from '@/lib/date-utils';
import type { ClassInfo, Payment, PaymentLedgerEntry, PaymentMode, Student } from '@/lib/types';
import { actorLabel, Button, ErrorText, Field, inputClass, rupees, Sheet, useSubmit } from './ui';

/** Where this student's money is, split by stage: "₹1,000 received, ₹500 with coordinator". */
function cashPlace(payments: Payment[]) {
  const cash = payments;
  if (cash.length === 0) return null;
  const sum = (status: 'confirmed' | 'pending' | 'with') =>
    cash
      .filter((p) => (status === 'with' ? !p.handover_status || p.handover_status === 'rejected' : p.handover_status === status))
      .reduce((total, p) => total + p.amount, 0);
  return [
    [sum('confirmed'), 'received by treasurer'],
    [sum('pending'), 'awaiting treasurer'],
    [sum('with'), 'with coordinator'],
  ]
    .filter(([amount]) => Number(amount) > 0)
    .map(([amount, label]) => `${rupees(Number(amount))} ${label}`)
    .join(', ');
}

function PaymentStatus({ student }: { student: Student }) {
  if (student.amount_paid >= student.amount_due) {
    return (
      <span className="inline-flex items-center gap-1">
        <Check className="size-4" aria-hidden />
        Paid
      </span>
    );
  }
  if (student.amount_paid > 0) {
    return (
      <span className="text-alert">
        Part paid, {rupees(student.amount_due - student.amount_paid)} left
      </span>
    );
  }
  return <span className="text-alert">Unpaid</span>;
}

export function ClassSheet({
  cls,
  students,
  payments,
  isAdmin,
}: {
  cls: ClassInfo;
  students: Student[];
  payments: Payment[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState('');
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [cheer, setCheer] = useState<string | null>(null);

  useEffect(() => {
    if (!cheer) return;
    const timer = setTimeout(() => setCheer(null), 7000);
    return () => clearTimeout(timer);
  }, [cheer]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.phone?.includes(q) || s.notes?.toLowerCase().includes(q),
    );
  }, [students, query]);

  const target = students.reduce((sum, s) => sum + s.amount_due, 0);
  const collected = students.reduce((sum, s) => sum + s.amount_paid, 0);
  const paidInFull = students.filter((s) => s.amount_paid >= s.amount_due).length;
  const due = target - collected;
  const percent = target > 0 ? (collected / target) * 100 : 0;
  const openStudent = students.find((s) => s.id === openStudentId) ?? null;
  const paymentsByStudent = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const payment of payments) map.set(payment.student_id, [...(map.get(payment.student_id) ?? []), payment]);
    return map;
  }, [payments]);
  const placeOf = (student: Student) => cashPlace(paymentsByStudent.get(student.id) ?? []);

  const coordinators = [
    [cls.coordinator_1_name, cls.coordinator_1_phone],
    [cls.coordinator_2_name, cls.coordinator_2_phone],
  ].filter(([name]) => name);

  function exportCsv() {
    downloadCsv(`${cls.name.replace(/\s+/g, '_')}_students.csv`, [
      ['#', 'Student', 'Phone', 'Fee', 'Paid', 'Mode', 'Status', 'Where the money is', 'Remarks', 'Last updated by'],
      ...students.map((s, index) => [
        index + 1,
        s.name,
        s.phone ?? '',
        s.amount_due,
        s.amount_paid,
        s.payment_mode.toUpperCase(),
        s.amount_paid >= s.amount_due ? 'Paid' : s.amount_paid > 0 ? 'Partial' : 'Unpaid',
        placeOf(s) ?? '',
        s.notes ?? '',
        s.updated_by_name ?? '',
      ]),
    ]);
  }

  return (
    <>
      {cheer && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md items-start gap-3 rounded border border-line bg-surface p-3 shadow-lg lg:bottom-6"
        >
          <PartyPopper className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="flex-1 text-sm font-medium">{cheer}</p>
          <button onClick={() => setCheer(null)} className="text-sm text-ink-2 underline">
            Dismiss
          </button>
        </div>
      )}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{cls.name}</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {cls.total_students !== undefined
            ? `${cls.total_students} students in the class, ${students.length} entered so far`
            : `${students.length} students entered. Class strength not set yet.`}
        </p>
        {isAdmin && (
          <p className="mt-0.5 text-sm text-ink-2">
            {coordinators.length > 0 ? `Coordinators: ${coordinators.map(([name, phone]) => `${name} (${phone})`).join(', ')}` : 'No coordinator login yet'}
          </p>
        )}
      </header>

      {students.length > 0 && (
        <section className="mt-4" aria-label="Collection summary">
          <p className="tabular-nums">
            <span className="text-3xl font-semibold tracking-tight">{rupees(collected)}</span>
            <span className="text-ink-2"> of {rupees(target)}</span>
          </p>
          <div className="mt-2 h-1.5 bg-line">
            <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm tabular-nums">
            <span className="text-ink-2">
              {paidInFull} of {students.length} students paid in full
            </span>
            {due > 0 && <span className="font-medium text-alert">{rupees(due)} still due</span>}
          </p>
        </section>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {students.length > 0 && (
          <div className="relative min-w-0 flex-1 basis-full sm:basis-64 sm:max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search students"
              aria-label="Search students"
              className={`${inputClass} pl-9`}
            />
          </div>
        )}
        <div className="flex flex-1 justify-end gap-2 sm:flex-none lg:ml-auto">
          {students.length > 0 && (
            <Button onClick={exportCsv} className="flex-1 sm:flex-none">
              <Download className="size-4" aria-hidden />
              Export
            </Button>
          )}
          <Button variant="primary" onClick={() => setAdding(true)} className="flex-1 sm:flex-none">
            <Plus className="size-4" aria-hidden />
            Add student
          </Button>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="mt-6 max-w-md text-ink-2">No students in this class yet. Add each student to start recording payments.</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-ink-2">No students match “{query}”.</p>
      ) : (
        <>
          {/* Phone rows */}
          <ul className="mt-1 divide-y divide-line border-y border-line bg-surface lg:hidden">
            {visible.map((student) => (
              <li key={student.id}>
                <button onClick={() => setOpenStudentId(student.id)} className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{student.name}</span>
                    <span className="block truncate text-sm text-ink-2">
                      {placeOf(student) || (student.amount_paid > 0 ? 'UPI' : (student.phone ?? 'No payment yet'))}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums">
                    <span className="block font-medium">{rupees(student.amount_paid)}</span>
                    <PaymentStatus student={student} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="mt-1 hidden border border-line bg-surface lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-ink-2">
                  <th className="w-10 px-3 py-2 font-medium tabular-nums">#</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 text-right font-medium">Paid</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 font-medium">Handover</th>
                  <th className="px-3 py-2 font-medium">Remarks</th>
                  <th className="px-3 py-2 font-medium">Updated by</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((student, index) => {
                  return (
                    <tr key={student.id} className="hover:bg-canvas">
                      <td className="px-3 py-2 tabular-nums text-ink-2">{index + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{student.name}</span>
                        {student.phone && <span className="block text-ink-2 tabular-nums">{student.phone}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{rupees(student.amount_paid)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        <PaymentStatus student={student} />
                      </td>
                      <td className="px-3 py-2 text-ink-2">{student.amount_paid > 0 ? student.payment_mode.toUpperCase() : '—'}</td>
                      <td className="px-3 py-2 text-ink-2">{placeOf(student) || '—'}</td>
                      <td className="max-w-48 truncate px-3 py-2 text-ink-2" title={student.notes}>
                        {student.notes || '—'}
                      </td>
                      <td className="px-3 py-2 text-ink-2">{student.updated_by_name || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <Button onClick={() => setOpenStudentId(student.id)} aria-label={`Edit ${student.name}`}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Sheet open={Boolean(openStudent)} title={openStudent?.name ?? ''} onClose={() => setOpenStudentId(null)}>
        {openStudent && <StudentEditor key={openStudent.id} student={openStudent} payments={paymentsByStudent.get(openStudent.id) ?? []} onSaved={(message) => {
          setOpenStudentId(null);
          setCheer(message);
        }} />}
      </Sheet>

      <Sheet open={adding} title={`Add student to ${cls.name}`} onClose={() => setAdding(false)}>
        <AddStudentForm
          classId={cls.id}
          fee={cls.target_per_student}
          onSaved={(message) => {
            setAdding(false);
            setCheer(message);
          }}
        />
      </Sheet>
    </>
  );
}

function ModeChoice({ mode, onChange }: { mode: PaymentMode; onChange: (mode: PaymentMode) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Paid by</legend>
      <div className="grid grid-cols-2 gap-2">
        {(['upi', 'cash'] as const).map((option) => (
          <label key={option} className={`flex h-11 cursor-pointer items-center justify-center rounded border text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${mode === option ? 'border-ink bg-ink font-medium text-white' : 'border-line bg-surface'}`}>
            <input type="radio" name="mode" className="sr-only" checked={mode === option} onChange={() => onChange(option)} />
            {option === 'upi' ? 'UPI' : 'Cash'}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StudentEditor({
  student,
  payments,
  onSaved,
}: {
  student: Student;
  payments: Payment[];
  onSaved: (message: string | null) => void;
}) {
  const left = Math.max(0, student.amount_due - student.amount_paid);
  const [amount, setAmount] = useState(left > 0 ? String(left) : '');
  const [mode, setMode] = useState<PaymentMode>(student.payment_mode);
  const [notes, setNotes] = useState('');
  const save = useSubmit();
  const [history, setHistory] = useState<PaymentLedgerEntry[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const place = cashPlace(payments);

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const paying = Number(amount);
    const message = congratulation(student.name, student.amount_paid + paying, student.amount_due);
    save.submit(() => recordPayment(student.id, { amount: paying, mode, notes }), () => onSaved(message));
  }

  async function loadHistory() {
    setLoadingHistory(true);
    setHistoryError('');
    const result = await getStudentHistory(student.id);
    setLoadingHistory(false);
    if (result.ok) setHistory(result.entries);
    else setHistoryError(result.error);
  }

  return (
    <div className="space-y-5">
      <section aria-label="Payment summary">
        <p className="tabular-nums">
          <span className="text-2xl font-semibold">{rupees(student.amount_paid)}</span>
          <span className="text-ink-2"> of {rupees(student.amount_due)} paid</span>
        </p>
        <p className="mt-1 text-sm">
          <PaymentStatus student={student} />
        </p>
        {place && <p className="mt-1 text-sm text-ink-2">Handover: {place}</p>}
      </section>

      {left > 0 ? (
        <form onSubmit={handleSave} className="space-y-4 border-t border-line pt-4">
          <Field label="Amount paying now" hint={`${rupees(left)} is left to collect. You cannot enter more than that.`}>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0.01}
                max={left}
                step="any"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={`${inputClass} tabular-nums`}
              />
              <Button type="button" onClick={() => setAmount(String(left))}>
                Pay the rest
              </Button>
            </div>
          </Field>
          <ModeChoice mode={mode} onChange={setMode} />
          <Field label="Remarks (optional)">
            <input value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
          </Field>
          <ErrorText>{save.error}</ErrorText>
          <Button type="submit" variant="primary" disabled={save.pending} className="w-full">
            {save.pending ? 'Saving…' : 'Add payment'}
          </Button>
        </form>
      ) : (
        <p className="border-t border-line pt-4 text-sm text-ink-2">This student has paid the full fee.</p>
      )}

      <section className="border-t border-line pt-4">
        <h3 className="font-semibold">Payments</h3>
        {payments.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">No payments recorded yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {[...payments].reverse().map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="block tabular-nums">
                    {rupees(payment.amount)} by {payment.mode === 'upi' ? 'UPI' : 'cash'}
                  </span>
                  <span className="block text-ink-2">
                    {payment.created_by_name}, {formatDateTimeIST(payment.paid_at)}
                  </span>
                </span>
                {(
                  <span className="shrink-0 text-right text-ink-2">
                    {payment.handover_status === 'confirmed'
                      ? 'Received'
                      : payment.handover_status === 'pending'
                        ? 'Awaiting treasurer'
                        : 'With coordinator'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-line pt-4">
        <h3 className="font-semibold">History</h3>
        {history === null ? (
          <Button onClick={loadHistory} disabled={loadingHistory} className="mt-2">
            {loadingHistory ? 'Loading…' : 'Show history'}
          </Button>
        ) : history.length === 0 ? (
          <p className="mt-1 text-sm text-ink-2">No changes recorded yet.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="py-2">
                <p className="tabular-nums">
                  {entry.delta !== 0 ? `${rupees(entry.old_amount)} to ${rupees(entry.new_amount)}` : entry.reason}
                </p>
                <p className="text-ink-2">
                  {actorLabel(entry.modifier_name, entry.modifier_role)}, {formatDateTimeIST(entry.created_at)}
                </p>
                {entry.delta !== 0 && entry.reason && <p className="text-ink-2">{entry.reason}</p>}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-2">
          <ErrorText>{historyError}</ErrorText>
        </div>
      </section>
    </div>
  );
}

function AddStudentForm({ classId, fee, onSaved }: { classId: string; fee: number; onSaved: (message: string | null) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('0');
  const [mode, setMode] = useState<PaymentMode>('upi');
  const [notes, setNotes] = useState('');
  const save = useSubmit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const paid = Number(amount);
    save.submit(
      () => addStudent(classId, { name, phone, amount: paid, mode, notes }),
      () => onSaved(congratulation(name, paid, fee)),
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Name">
        <input required value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Phone (optional)">
        <input type="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Amount paid now" hint={`Fee is ${rupees(fee)}. Enter 0 if nothing is paid yet.`}>
        <input type="number" inputMode="decimal" min={0} max={fee} step="any" required value={amount} onChange={(event) => setAmount(event.target.value)} className={`${inputClass} tabular-nums`} />
      </Field>
      <ModeChoice mode={mode} onChange={setMode} />
      <Field label="Remarks (optional)">
        <input value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
      </Field>
      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" variant="primary" disabled={save.pending} className="w-full">
        {save.pending ? 'Adding…' : 'Add student'}
      </Button>
    </form>
  );
}
