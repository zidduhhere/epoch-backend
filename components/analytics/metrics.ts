import type { Bill, ClassInfo, Payment, Student } from '../../lib/types';
import { DEPARTMENTS, YEARS, departmentHasYear } from '../../lib/departments';

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** Rupees with Indian grouping. Negative values keep the sign ahead of the symbol. */
export function money(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded < 0 ? '−' : ''}₹${Math.abs(rounded).toLocaleString('en-IN')}`;
}

/** Whole percent, rounded down so a class is never shown at 100% while money is still due. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.floor((part / whole) * 100) : null;
}

/** Part of a whole for charts, rounded to the nearest percent. */
export function shareOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function classLabel(cls: Pick<ClassInfo, 'branch' | 'year'>): string {
  return `${cls.branch} Year ${cls.year}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString('en-IN')} ${count === 1 ? one : many}`;
}

export interface Totals {
  studentCount: number;
  /** Total students the admin says the class has; 0 when not set. */
  enrolled: number;
  unpaidStudentCount: number;
  paidInFullCount: number;
  partialCount: number;
  target: number;
  collected: number;
  outstanding: number;
  upi: number;
  cash: number;
  withCoordinators: number;
  awaitingTreasurer: number;
  inVault: number;
}

export interface ClassStats extends Totals {
  cls: ClassInfo;
}

const emptyTotals = (): Totals => ({
  studentCount: 0,
  enrolled: 0,
  unpaidStudentCount: 0,
  paidInFullCount: 0,
  partialCount: 0,
  target: 0,
  collected: 0,
  outstanding: 0,
  upi: 0,
  cash: 0,
  withCoordinators: 0,
  awaitingTreasurer: 0,
  inVault: 0,
});

function addStudent(totals: Totals, student: Student) {
  const due = Number(student.amount_due) || 0;
  const paid = Number(student.amount_paid) || 0;

  totals.studentCount += 1;
  totals.target += due;
  totals.collected += paid;
  // Per student, so one overpayment cannot hide another student's balance.
  totals.outstanding += Math.max(0, due - paid);
  if (paid < due) totals.unpaidStudentCount += 1;
  if (due > 0 && paid >= due) totals.paidInFullCount += 1;
  else if (paid > 0) totals.partialCount += 1;
}

/** UPI and cash totals, and where each payment is: coordinator, treasurer or vault. UPI is handed over too. */
function addPayment(totals: Totals, payment: Payment) {
  if (payment.mode === 'upi') totals.upi += payment.amount;
  else totals.cash += payment.amount;

  if (payment.handover_status === 'confirmed') totals.inVault += payment.amount;
  else if (payment.handover_status === 'pending') totals.awaitingTreasurer += payment.amount;
  else totals.withCoordinators += payment.amount;
}

export function totalsForStudents(students: Student[], payments: Payment[] = []): Totals {
  const totals = emptyTotals();
  students.forEach((student) => addStudent(totals, student));
  payments.forEach((payment) => addPayment(totals, payment));
  return totals;
}

export function rollUp(rows: Totals[]): Totals {
  const totals = emptyTotals();
  const keys = Object.keys(totals) as (keyof Totals)[];
  rows.forEach((row) => keys.forEach((key) => (totals[key] += row[key])));
  return totals;
}

export function statsByClass(classes: ClassInfo[], students: Student[], payments: Payment[] = []): ClassStats[] {
  const byClass = new Map<string, ClassStats>(
    classes.map((cls) => [cls.id, { cls, ...emptyTotals() }]),
  );
  students.forEach((student) => {
    const stats = byClass.get(student.class_id);
    if (stats) addStudent(stats, student);
  });
  payments.forEach((payment) => {
    const stats = byClass.get(payment.class_id);
    if (stats) addPayment(stats, payment);
  });
  // Students the admin counted but nobody has entered yet still owe the full fee.
  byClass.forEach((stats) => {
    stats.enrolled = stats.cls.total_students ?? 0;
    const missing = Math.max(0, stats.enrolled - stats.studentCount);
    const owed = missing * (Number(stats.cls.target_per_student) || 0);
    stats.target += owed;
    stats.outstanding += owed;
    stats.unpaidStudentCount += missing;
  });
  return Array.from(byClass.values());
}

/** Lowest share collected first; only classes with students and money still due. */
export function furthestBehind(stats: ClassStats[], limit = 3): ClassStats[] {
  return stats
    .filter((row) => (row.studentCount > 0 || row.enrolled > 0) && row.outstanding > 0 && row.target > 0)
    .sort((a, b) => a.collected / a.target - b.collected / b.target || b.outstanding - a.outstanding)
    .slice(0, limit);
}

export interface AttentionLink {
  classId: string;
  label: string;
  amountLabel: string;
}

export interface AttentionItem {
  key: string;
  title: string;
  detail: string;
  amount: number;
  links: AttentionLink[];
  opensBills?: boolean;
}

function cashItem(
  stats: ClassStats[],
  key: string,
  title: string,
  detail: string,
  amountOf: (row: ClassStats) => number,
): AttentionItem {
  const rows = stats.filter((row) => amountOf(row) > 0).sort((a, b) => amountOf(b) - amountOf(a));
  return {
    key,
    title,
    detail: `${detail} ${plural(rows.length, 'class', 'classes')}, largest first.`,
    amount: rows.reduce((sum, row) => sum + amountOf(row), 0),
    links: rows.map((row) => ({
      classId: row.cls.id,
      label: classLabel(row.cls),
      amountLabel: money(amountOf(row)),
    })),
  };
}

export function buildAttentionItems(
  stats: ClassStats[],
  behind: ClassStats[],
  bills: Bill[],
  isFiltered: boolean,
): AttentionItem[] {
  const pendingBills = bills.filter((bill) => bill.status === 'pending');
  const behindCount = plural(behind.length, 'class', 'classes');

  const items: AttentionItem[] = [
    cashItem(
      stats,
      'with-coordinators',
      'Money with coordinators',
      'Collected from students but not handed over yet.',
      (row) => row.withCoordinators,
    ),
    cashItem(
      stats,
      'awaiting-treasurer',
      'Money awaiting treasurer',
      'Handed over, but the treasurer has not verified it.',
      (row) => row.awaitingTreasurer,
    ),
    {
      key: 'expenses',
      title: 'Expenses awaiting approval',
      detail: `${plural(pendingBills.length, 'expense')} to approve or reject${
        isFiltered ? ', across the whole event' : ''
      }.`,
      amount: pendingBills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0),
      links: [],
      opensBills: true,
    },
    {
      key: 'behind',
      title: 'Classes furthest behind',
      detail: `Still due from the ${behindCount} with the lowest share collected.`,
      amount: behind.reduce((sum, row) => sum + row.outstanding, 0),
      links: behind.map((row) => ({
        classId: row.cls.id,
        label: classLabel(row.cls),
        amountLabel: `${percentOf(row.collected, row.target)}%, ${money(row.outstanding)} due`,
      })),
    },
  ];

  return items.filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
}

export function departmentsInOrder(selected: string | 'all'): string[] {
  return selected === 'all' ? [...DEPARTMENTS] : [selected];
}

export function yearsInOrder(selected: number | 'all'): number[] {
  return selected === 'all' ? [...YEARS] : [selected];
}

/** Classes whose department is outside the fixed list cannot appear in the grid. */
export function isOnGrid(cls: ClassInfo): boolean {
  return (DEPARTMENTS as readonly string[]).includes(cls.branch) && departmentHasYear(cls.branch, cls.year);
}

function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  // A leading formula character would otherwise execute when opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function downloadCsv(stats: ClassStats[], scope: string | null) {
  const headers = [
    'Class',
    'Year',
    'Department',
    'Section',
    'Students entered',
    'Total students',
    'Target (₹)',
    'Collected (₹)',
    'Still due (₹)',
    'Collected (%)',
    'UPI (₹)',
    'Cash (₹)',
    'With coordinators (₹)',
    'Awaiting treasurer (₹)',
    'Received by treasurer (₹)',
    'Coordinator 1',
    'Coordinator 2',
  ];

  const order = (branch: string) => {
    const index = (DEPARTMENTS as readonly string[]).indexOf(branch);
    return index === -1 ? DEPARTMENTS.length : index;
  };
  const rows = [...stats]
    .sort((a, b) => order(a.cls.branch) - order(b.cls.branch) || a.cls.year - b.cls.year)
    .map((row) =>
      [
        row.cls.name,
        row.cls.year,
        row.cls.branch,
        row.cls.section,
        row.studentCount,
        row.enrolled || '',
        row.target,
        row.collected,
        row.outstanding,
        percentOf(row.collected, row.target) ?? '',
        row.upi,
        row.cash,
        row.withCoordinators,
        row.awaitingTreasurer,
        row.inVault,
        row.cls.coordinator_1_name ?? '',
        row.cls.coordinator_2_name ?? '',
      ].map(csvCell),
    );

  const csv = [headers.map(csvCell), ...rows].map((row) => row.join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  const slug = scope ? `${scope.replace(/[^A-Za-z0-9]+/g, '_')}_` : '';
  link.href = url;
  link.download = `EPOCH_Analytics_${slug}${new Date().toLocaleDateString('en-CA')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


export interface DayRow {
  date: string; // YYYY-MM-DD, India
  total: number;
  upi: number;
  cash: number;
  count: number;
  cumulative: number;
}

/** One row per calendar day from the first payment to today, including days with nothing collected. */
export function dailyCollection(payments: Payment[], today: string): DayRow[] {
  if (payments.length === 0) return [];
  const byDay = new Map<string, DayRow>();
  for (const payment of payments) {
    const row = byDay.get(payment.paid_on) ?? { date: payment.paid_on, total: 0, upi: 0, cash: 0, count: 0, cumulative: 0 };
    row.total += payment.amount;
    row[payment.mode] += payment.amount;
    row.count += 1;
    byDay.set(payment.paid_on, row);
  }

  const first = [...byDay.keys()].sort()[0];
  const rows: DayRow[] = [];
  let running = 0;
  for (let date = first; date <= today; date = addDays(date, 1)) {
    const row = byDay.get(date) ?? { date, total: 0, upi: 0, cash: 0, count: 0, cumulative: 0 };
    running += row.total;
    rows.push({ ...row, cumulative: running });
  }
  return rows;
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T12:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

export function dayLabel(date: string, withWeekday = false): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withWeekday ? { weekday: 'short' } : {}),
    timeZone: 'UTC',
  });
}

/** Short rupee label for a chart bar: ₹950, ₹12.5k, ₹1.2L. */
export function compactMoney(amount: number): string {
  const value = Math.round(amount);
  if (value >= 100000) return `₹${(value / 100000).toFixed(value >= 1000000 ? 0 : 1).replace(/\.0$/, '')}L`;
  if (value >= 10000) return `₹${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return money(value);
}
