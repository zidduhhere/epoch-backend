'use client';

import { useMemo, useState } from 'react';
import { ClassInfo, Student, PaymentLedgerEntry, Payment, Bill } from '../lib/types';
import { DEPARTMENTS, YEARS, departmentHasYear } from '../lib/departments';
import { CollectionGrid } from './analytics/CollectionGrid';
import { NeedsAttention } from './analytics/NeedsAttention';
import { BarChart } from './analytics/BarChart';
import { DailyCollection } from './analytics/DailyCollection';
import { PieChart } from './analytics/PieChart';
import type { PiePart } from './analytics/PieChart';
import {
  buildAttentionItems,
  dailyCollection,
  departmentsInOrder,
  downloadCsv,
  focusRing,
  furthestBehind,
  isOnGrid,
  money,
  percentOf,
  plural,
  rollUp,
  statsByClass,
  todayIST,
  totalsForStudents,
  yearsInOrder,
} from './analytics/metrics';

interface AdminAnalyticsDashboardProps {
  classes: ClassInfo[];
  students: Student[];
  ledger: PaymentLedgerEntry[];
  payments: Payment[];
  bills: Bill[];
  onNavigateToClass: (classId: string) => void;
  onNavigateToBills?: () => void;
}

const DEPARTMENT_TONES: PiePart['tone'][] = ['strong', 'quiet', 'medium'];

const selectClass = `h-11 w-full cursor-pointer rounded-sm border border-line bg-surface px-2 text-base text-ink sm:h-10 sm:w-auto sm:text-sm ${focusRing}`;

export function AdminAnalyticsDashboard({
  classes,
  students,
  payments,
  bills,
  onNavigateToClass,
  onNavigateToBills,
}: AdminAnalyticsDashboardProps) {
  const [year, setYear] = useState<number | 'all'>('all');
  const [department, setDepartment] = useState<string | 'all'>('all');

  const isFiltered = year !== 'all' || department !== 'all';
  const scope = isFiltered
    ? [department !== 'all' ? department : null, year !== 'all' ? `Year ${year}` : null].filter(Boolean).join(' ')
    : null;

  const allStats = useMemo(() => statsByClass(classes, students, payments), [classes, students, payments]);
  const stats = useMemo(
    () =>
      allStats.filter(
        (row) => (year === 'all' || row.cls.year === year) && (department === 'all' || row.cls.branch === department),
      ),
    [allStats, year, department],
  );

  const totals = useMemo(() => rollUp(stats), [stats]);
  const days = useMemo(() => {
    const ids = new Set(stats.map((row) => row.cls.id));
    return dailyCollection(
      payments.filter((payment) => ids.has(payment.class_id)),
      todayIST(),
    );
  }, [stats, payments]);
  const notEntered = stats.reduce((sum, row) => sum + Math.max(0, row.enrolled - row.studentCount), 0);
  const statusParts: PiePart[] = [
    { name: 'Paid in full', amount: totals.paidInFullCount, tone: 'strong' },
    { name: 'Part paid', note: 'Some of the fee is still due', amount: totals.partialCount, tone: 'medium' },
    {
      name: 'Not paid yet',
      amount: Math.max(0, totals.studentCount - totals.paidInFullCount - totals.partialCount),
      tone: 'quiet',
    },
    { name: 'Not entered yet', note: 'Counted in class strength', amount: notEntered, tone: 'remaining' },
  ];
  const countStudents = (value: number) => plural(value, 'student');
  const eventTotals = useMemo(() => totalsForStudents(students, payments), [students, payments]);
  const behind = useMemo(() => furthestBehind(stats), [stats]);
  const behindIds = useMemo(() => new Set(behind.map((row) => row.cls.id)), [behind]);
  const attention = useMemo(
    () => buildAttentionItems(stats, behind, bills, isFiltered),
    [stats, behind, bills, isFiltered],
  );

  const approvedExpenses = bills
    .filter((bill) => bill.status === 'approved' || bill.status === 'reimbursed')
    .reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  const vaultBalance = eventTotals.collected - approvedExpenses;
  const cashNotVerified = eventTotals.withCoordinators + eventTotals.awaitingTreasurer;

  const noStudentsAnywhere = students.length === 0 && !classes.some((cls) => cls.total_students);
  const percent = percentOf(totals.collected, totals.target);
  const classesWithoutStudents = stats.filter((row) => row.studentCount === 0 && row.enrolled === 0).length;
  const offGridCount = stats.filter((row) => !isOnGrid(row.cls)).length;
  const scopeHasStudents = totals.studentCount > 0 || totals.enrolled > 0;
  const classesMissingStrength = stats.filter((row) => row.enrolled === 0).length;

  const barRows = (names: string[], match: (row: (typeof stats)[number], name: string) => boolean) =>
    names.map((name) => ({ name, totals: rollUp(stats.filter((row) => match(row, name))) }));
  const departmentRows = barRows(departmentsInOrder(department), (row, name) => row.cls.branch === name);
  const yearRows = barRows(
    yearsInOrder(year).map((value) => `Year ${value}`),
    (row, name) => `Year ${row.cls.year}` === name,
  );
  const departmentParts: PiePart[] = departmentRows.map(({ name, totals: row }, index) => ({
    name,
    sliceLabel: name,
    note:
      row.target > 0 ? `${percentOf(row.collected, row.target)}% of its ${money(row.target)} target` : undefined,
    amount: row.collected,
    tone: DEPARTMENT_TONES[index % DEPARTMENT_TONES.length],
  }));
  const stillToCollect: PiePart | null =
    totals.outstanding > 0
      ? {
          name: 'Still to collect',
          note: 'Left to reach the target',
          amount: totals.outstanding,
          tone: 'remaining',
        }
      : null;
  const showDepartmentPie = departmentParts.filter((part) => part.amount > 0).length > 1;
  const showDepartmentBars = departmentRows.length > 1;
  const showYearBars = yearRows.length > 1;

  const showVault = !noStudentsAnywhere || bills.some((bill) => bill.status !== 'rejected');
  const showAttention = !noStudentsAnywhere || attention.length > 0;

  return (
    <div className="space-y-10 text-ink">
      {!noStudentsAnywhere && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold">Analytics</h2>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <label className="block text-sm text-ink-2">
              Department
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className={`mt-1 block ${selectClass}`}
              >
                <option value="all">All departments</option>
                {DEPARTMENTS.map((name) => (
                  <option key={name} value={name} disabled={year !== 'all' && !departmentHasYear(name, year)}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-ink-2">
              Year
              <select
                value={year}
                onChange={(event) => setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                className={`mt-1 block ${selectClass}`}
              >
                <option value="all">All years</option>
                {YEARS.map((value) => (
                  <option
                    key={value}
                    value={value}
                    disabled={department !== 'all' && !departmentHasYear(department, value)}
                  >
                    Year {value}
                  </option>
                ))}
              </select>
            </label>
            {isFiltered && (
              <button
                type="button"
                onClick={() => {
                  setYear('all');
                  setDepartment('all');
                }}
                className={`h-11 cursor-pointer rounded-sm px-2 text-sm text-ink-2 underline underline-offset-2 hover:text-ink sm:h-10 ${focusRing}`}
              >
                Clear filters
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadCsv(stats, scope)}
              className={`h-11 cursor-pointer rounded-sm border border-line bg-surface px-3 text-sm font-medium hover:border-ink sm:h-10 ${
                isFiltered ? '' : 'col-span-2'
              } ${focusRing}`}
            >
              {scope ? `Export ${scope} as CSV` : 'Export CSV'}
            </button>
          </div>
        </div>
      )}

      <section aria-label="Collection summary" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        {noStudentsAnywhere ? (
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold leading-tight">No students added yet</h2>
            <p className="mt-3 text-base text-ink-2">
              {classes.length > 0
                ? `${plural(classes.length, 'class is', 'classes are')} set up. Open a class below and add its students. Collection totals will appear here after that.`
                : 'No classes have been set up yet. Add the classes first, then their students.'}
            </p>
          </div>
        ) : !scopeHasStudents ? (
          <div className="max-w-xl">
            <h3 className="text-3xl font-semibold leading-tight">No students in {scope} yet</h3>
            <p className="mt-3 text-base text-ink-2">Open the class below and add its students.</p>
          </div>
        ) : (
          <div className="min-w-0">
            <h3 className="text-base text-ink-2">Collected{scope ? ` from ${scope}` : ''}</h3>
            <p className="mt-1 text-5xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl">
              {money(totals.collected)}
            </p>
            <p className="mt-3 text-lg">
              {percent === null ? 'No amount due' : `${percent}% of ${money(totals.target)} target`}
            </p>
            <div
              role="img"
              aria-label={`${percent ?? 0}% of the target collected`}
              className="mt-3 h-2 max-w-2xl bg-line"
            >
              <div className="h-full bg-ink" style={{ width: `${Math.min(percent ?? 0, 100)}%` }} />
            </div>
            <p className="mt-3 text-sm text-ink-2">
              {totals.outstanding > 0
                ? `${money(totals.outstanding)} still due from ${plural(totals.unpaidStudentCount, 'student')}.`
                : 'Every student has paid in full.'}
              {classesWithoutStudents > 0 &&
                ` The target leaves out ${plural(classesWithoutStudents, 'class', 'classes')} with no students yet.`}
              {totals.enrolled > 0 &&
                ` ${totals.studentCount.toLocaleString('en-IN')} of ${plural(totals.enrolled, 'student')} entered so far.`}
              {classesMissingStrength > 0 &&
                totals.enrolled > 0 &&
                ` ${plural(classesMissingStrength, 'class', 'classes')} still need a total student count.`}
            </p>
          </div>
        )}

        {showVault && (
          <div className="border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <h3 className="text-base text-ink-2">Vault balance{isFiltered ? ', whole event' : ''}</h3>
            <p
              className={`mt-1 text-4xl font-semibold leading-none tracking-tight tabular-nums ${
                vaultBalance < 0 ? 'text-alert' : ''
              }`}
            >
              {money(vaultBalance)}
            </p>
            <p className="mt-3 text-sm text-ink-2">
              {money(eventTotals.collected)} collected minus {money(approvedExpenses)} approved expenses.
            </p>
            {vaultBalance < 0 && (
              <p className="mt-2 text-sm font-medium text-alert">Approved expenses are more than the money collected.</p>
            )}
            {cashNotVerified > 0 && (
              <p className="mt-2 text-sm text-ink-2">
                Includes {money(cashNotVerified)} the treasurer has not confirmed receiving.
              </p>
            )}
          </div>
        )}
      </section>

      {showAttention && (
        <NeedsAttention
          items={attention}
          onNavigateToClass={onNavigateToClass}
          onNavigateToBills={onNavigateToBills}
        />
      )}

      {!noStudentsAnywhere && (
        <section aria-labelledby="daily-heading" className="min-w-0 border-t border-line pt-4">
          <h3 id="daily-heading" className="text-xl font-semibold">
            Collection day by day{scope ? `, ${scope}` : ''}
          </h3>
          <p className="mt-1 mb-4 text-sm text-ink-2">Money recorded on each day, UPI and cash, and the running total against the target.</p>
          <DailyCollection rows={days} target={totals.target} />
        </section>
      )}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:gap-16">
        <section aria-labelledby="by-class-heading" className="min-w-0 border-t border-line pt-4">
          <h3 id="by-class-heading" className="text-xl font-semibold">
            {noStudentsAnywhere ? 'Classes' : 'Where we are behind'}
          </h3>
          <p className="mt-1 mb-4 text-sm text-ink-2">
            {noStudentsAnywhere
              ? 'Select a class to open it and add students.'
              : `Share collected and amount still due for each class. Select a class to open it.${
                  behind.length > 0 ? ' Red marks the classes furthest behind.' : ''
                }`}
          </p>
          <CollectionGrid
            stats={stats}
            departments={departmentsInOrder(department)}
            years={yearsInOrder(year)}
            behindIds={behindIds}
            onNavigateToClass={onNavigateToClass}
          />
          {offGridCount > 0 && department === 'all' && (
            <p className="mt-3 text-sm text-ink-2">
              {plural(offGridCount, 'class', 'classes')} outside these departments {offGridCount === 1 ? 'is' : 'are'}{' '}
              counted in the totals but not shown here.
            </p>
          )}
        </section>

        {scopeHasStudents && (
          <div className="grid content-start gap-10 md:grid-cols-2 xl:grid-cols-1">
            <section aria-labelledby="custody-heading" className="min-w-0 border-t border-line pt-4">
              <h3 id="custody-heading" className="mb-3 text-xl font-semibold">
                Where the money is
              </h3>
              {totals.collected > 0 ? (
                <PieChart
                  label="Money by who holds it"
                  parts={[
                    {
                      name: 'With coordinators',
                      note: 'Not handed over yet',
                      amount: totals.withCoordinators,
                      tone: 'quiet',
                    },
                    {
                      name: 'Awaiting treasurer',
                      note: 'Handed over, not verified',
                      amount: totals.awaitingTreasurer,
                      tone: 'medium',
                    },
                    {
                      name: 'In vault',
                      note: 'Confirmed by the admin',
                      amount: totals.inVault,
                      tone: 'strong',
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-ink-2">No payments recorded yet.</p>
              )}
            </section>

            <section aria-labelledby="method-heading" className="min-w-0 border-t border-line pt-4">
              <h3 id="method-heading" className="text-xl font-semibold">
                UPI and cash
              </h3>
              <p className="mt-1 mb-3 text-sm text-ink-2">
                {percent === null
                  ? 'Share of the total contribution.'
                  : `${money(totals.collected)} collected, ${percent}% of the ${money(totals.target)} target.`}
              </p>
              {totals.collected > 0 ? (
                <PieChart
                  label="Money collected by payment method"
                  parts={[
                    { name: 'UPI', sliceLabel: 'UPI', amount: totals.upi, tone: 'strong' },
                    { name: 'Cash', sliceLabel: 'Cash', amount: totals.cash, tone: 'medium' },
                    ...(stillToCollect ? [stillToCollect] : []),
                  ]}
                />
              ) : (
                <p className="text-sm text-ink-2">No payments recorded yet.</p>
              )}
            </section>

            <section aria-labelledby="status-heading" className="min-w-0 border-t border-line pt-4">
              <h3 id="status-heading" className="mb-3 text-xl font-semibold">
                Students by payment status
              </h3>
              <PieChart label="Students by payment status" parts={statusParts} formatValue={countStudents} />
            </section>
          </div>
        )}
      </div>

      {totals.collected > 0 && (showDepartmentPie || showDepartmentBars || showYearBars) && (
        <div className="grid gap-10 lg:grid-cols-2 xl:gap-16">
          {showDepartmentPie && (
            <section aria-labelledby="department-share-heading" className="min-w-0 border-t border-line pt-4">
              <h3 id="department-share-heading" className="text-xl font-semibold">
                Money collected by department
              </h3>
              <p className="mt-1 mb-3 text-sm text-ink-2">
                Each slice is a share of the overall target; the grey slice is what is still to collect.
              </p>
              <PieChart
                label="Money collected by department against the target"
                parts={stillToCollect ? [...departmentParts, stillToCollect] : departmentParts}
              />
            </section>
          )}
          {(showDepartmentBars || showYearBars) && (
            <section aria-labelledby="progress-heading" className="min-w-0 border-t border-line pt-4">
              <h3 id="progress-heading" className="mb-3 text-xl font-semibold">
                Progress against target
              </h3>
              <div className="space-y-5">
                {showYearBars && <BarChart label="By year" rows={yearRows} />}
                {showDepartmentBars && <BarChart label="By department" rows={departmentRows} />}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
