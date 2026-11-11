'use client';

import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { addExpense, reviewExpense } from '@/app/actions/workspace';
import type { Bill, ExpenseCategory } from '@/lib/types';
import { Button, ErrorText, Field, inputClass, rupees, Sheet, useSubmit } from './ui';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  decorations: 'Decorations',
  sound_and_lights: 'Sound and lights',
  refreshments_food: 'Food and refreshments',
  prizes_mementos: 'Prizes and mementos',
  logistics_transport: 'Transport',
  printing_badges: 'Printing and badges',
  miscellaneous: 'Other',
};

const STATUS_LABELS: Record<Bill['status'], string> = {
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed',
};

export function ExpensesView({ bills }: { bills: Bill[] }) {
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState<Bill | null>(null);
  const approve = useSubmit();

  const spent = bills.filter((b) => b.status === 'approved' || b.status === 'reimbursed').reduce((sum, b) => sum + b.amount, 0);
  const pending = bills.filter((b) => b.status === 'pending');
  const pendingTotal = pending.reduce((sum, b) => sum + b.amount, 0);

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-1 tabular-nums text-ink-2">
            {rupees(spent)} approved
            {pending.length > 0 && (
              <>
                , <span className="font-medium text-alert">{rupees(pendingTotal)} awaiting approval</span>
              </>
            )}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          Add invoice
        </Button>
      </header>

      <div className="mt-3">
        <ErrorText>{approve.error}</ErrorText>
      </div>

      {bills.length === 0 ? (
        <p className="mt-6 max-w-md text-ink-2">No invoices yet. Add one when money is spent on the event.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line bg-surface">
          {bills.map((bill) => (
            <li key={bill.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{bill.title}</p>
                <p className="text-sm text-ink-2">
                  {bill.vendor_name}, {CATEGORY_LABELS[bill.category]}, {bill.bill_date}
                </p>
                {/^https?:\/\//i.test(bill.receipt_url) && (
                  <a href={bill.receipt_url} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                    View receipt
                  </a>
                )}
                {bill.rejection_reason && <p className="text-sm text-ink-2">Rejected: {bill.rejection_reason}</p>}
              </div>
              <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                <div className="sm:text-right">
                  <p className="font-semibold tabular-nums">{rupees(bill.amount)}</p>
                  <p className={`text-sm ${bill.status === 'pending' ? 'text-alert' : 'text-ink-2'}`}>{STATUS_LABELS[bill.status]}</p>
                </div>
                {bill.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button onClick={() => setRejecting(bill)}>Reject</Button>
                    <Button variant="primary" disabled={approve.pending} onClick={() => approve.submit(() => reviewExpense(bill.id, 'approved'))}>
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={adding} title="Add invoice" onClose={() => setAdding(false)}>
        <AddExpenseForm onSaved={() => setAdding(false)} />
      </Sheet>
      <Sheet open={Boolean(rejecting)} title="Reject invoice" onClose={() => setRejecting(null)}>
        {rejecting && <RejectForm bill={rejecting} onSaved={() => setRejecting(null)} />}
      </Sheet>
    </>
  );
}

function RejectForm({ bill, onSaved }: { bill: Bill; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const save = useSubmit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.submit(() => reviewExpense(bill.id, 'rejected', reason), onSaved);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-ink-2">
        {bill.title}, {rupees(bill.amount)}
      </p>
      <Field label="Reason">
        <input required value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={inputClass} />
      </Field>
      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" variant="primary" disabled={save.pending} className="w-full">
        Reject invoice
      </Button>
    </form>
  );
}

function AddExpenseForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('decorations');
  const [date, setDate] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const save = useSubmit();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.submit(() => addExpense({ title, vendor, category, amount: Number(amount), date, receiptUrl, notes }), onSaved);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="What was it for?">
        <input required value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Paid to">
        <input required value={vendor} onChange={(event) => setVendor(event.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <input type="number" inputMode="decimal" min={1} step="any" required value={amount} onChange={(event) => setAmount(event.target.value)} className={`${inputClass} tabular-nums`} />
        </Field>
        <Field label="Invoice date">
          <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Category">
        <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} className={inputClass}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Receipt link (optional)">
        <input type="url" value={receiptUrl} placeholder="https://" onChange={(event) => setReceiptUrl(event.target.value)} className={inputClass} />
      </Field>
      <Field label="Remarks (optional)">
        <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
      </Field>
      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" variant="primary" disabled={save.pending} className="w-full">
        {save.pending ? 'Adding…' : 'Add invoice'}
      </Button>
    </form>
  );
}
