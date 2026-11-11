'use client';

import { useState } from 'react';
import { formatDateTimeIST } from '@/lib/date-utils';
import type { ClassInfo, PaymentLedgerEntry } from '@/lib/types';
import { actorLabel, Button, rupees } from './ui';

const PAGE = 100;
/** The server sends at most this many entries (lib/server/data.ts). */
const SERVER_LIMIT = 2000;

const ACTION_LABELS: Record<PaymentLedgerEntry['action'], string> = {
  INITIAL_ENTRY: 'First payment',
  EDIT: 'Amount changed',
  FULL_PAYMENT: 'Paid in full',
  PARTIAL_PAYMENT: 'Part payment',
  CORRECTION: 'Reset to ₹0',
  CASH_HANDOVER_CONFIRMED: 'Cash handover',
  TREASURER_VERIFIED: 'Cash received',
};

function signedRupees(amount: number) {
  return `${amount > 0 ? '+' : '−'}${rupees(Math.abs(amount))}`;
}

export function AuditLogView({
  ledger,
  classes,
  showClass,
}: {
  ledger: PaymentLedgerEntry[];
  classes: ClassInfo[];
  showClass: boolean;
}) {
  const [shown, setShown] = useState(PAGE);
  const classNames = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-ink-2">Every payment change and handover, newest first. Entries cannot be edited.{ledger.length >= SERVER_LIMIT && ` Only the latest ${SERVER_LIMIT} are shown.`}</p>

      {ledger.length === 0 ? (
        <p className="mt-6 text-ink-2">Nothing recorded yet. Changes appear here as payments are saved.</p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line border-y border-line bg-surface">
            {ledger.slice(0, shown).map((entry) => (
              <li key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {entry.student_name}
                    {showClass && classNames.has(entry.class_id) && <span className="font-normal text-ink-2"> in {classNames.get(entry.class_id)}</span>}
                  </p>
                  <p className="text-sm text-ink-2">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                    {entry.reason ? `: ${entry.reason}` : ''}
                  </p>
                  <p className="text-sm text-ink-2">
                    {actorLabel(entry.modifier_name, entry.modifier_role)}, {formatDateTimeIST(entry.created_at)}
                  </p>
                </div>
                {entry.delta !== 0 && (
                  <div className="text-right tabular-nums">
                    <p className="font-semibold">{signedRupees(entry.delta)}</p>
                    <p className="text-sm text-ink-2">Now {rupees(entry.new_amount)}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {shown < ledger.length && (
            <Button onClick={() => setShown((count) => count + PAGE)} className="mt-3">
              Show more
            </Button>
          )}
        </>
      )}
    </>
  );
}
