import 'server-only';
import { db } from './db';
import type {
  Account,
  Bill,
  ClassInfo,
  CurrentUser,
  Handover,
  Payment,
  PaymentLedgerEntry,
  PaymentMode,
  Student,
  WorkspaceData,
} from '../types';

const PAGE_SIZE = 1000;
const LEDGER_LIMIT = 2000;

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from an untyped Supabase client */

export function mapLedgerEntry(row: any, viewer: CurrentUser): PaymentLedgerEntry {
  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    student_name: row.student_name,
    student_roll: row.student_roll ?? undefined,
    old_amount: Number(row.old_amount) || 0,
    new_amount: Number(row.new_amount) || 0,
    delta: Number(row.delta) || 0,
    payment_mode: row.payment_mode ?? 'cash',
    reference_id: row.reference_id ?? undefined,
    action: row.action,
    reason: row.reason ?? undefined,
    rep_handover_verified: Boolean(row.rep_handover_verified),
    treasurer_verified: Boolean(row.treasurer_verified),
    modifier_name: row.modifier_name,
    // This column holds a phone number, which only the admin may see.
    modifier_email: viewer.role === 'admin' ? row.modifier_email : '',
    modifier_role: row.modifier_role,
    created_at: row.created_at,
  };
}

function mapStudent(row: any): Student {
  const due = Number(row.amount_due) || 0;
  const paid = Number(row.amount_paid) || 0;
  return {
    id: row.id,
    class_id: row.class_id,
    roll_number: row.roll_number ?? undefined,
    name: row.name,
    phone: row.phone ?? undefined,
    amount_due: due,
    amount_paid: paid,
    payment_mode: (row.payment_mode ?? 'upi') as PaymentMode,
    reference_id: row.reference_id ?? undefined,
    notes: row.notes ?? undefined,
    rep_handover_verified: Boolean(row.rep_handover_verified),
    treasurer_verified: Boolean(row.treasurer_verified),
    status: paid >= due ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    updated_at: row.updated_at,
    updated_by_name: row.updated_by_name ?? undefined,
    updated_by_role: row.updated_by_role ?? undefined,
  };
}

function mapBill(row: any): Bill {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    vendor_name: row.vendor_name,
    category: row.category,
    amount: Number(row.amount) || 0,
    bill_date: row.bill_date,
    receipt_url: row.receipt_url ?? '',
    status: row.status,
    submitted_by_name: row.submitted_by_name ?? 'Unknown',
    submitted_at: row.created_at,
    approved_by_name: row.approved_by_name ?? undefined,
    rejection_reason: row.rejection_reason ?? undefined,
  };
}

/** PostgREST returns at most 1000 rows, and all classes together exceed that. */
async function fetchAllStudents(classId?: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db()
      .from('students')
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (classId) query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

function mapPayment(row: any): Payment {
  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    student_name: row.student?.name ?? 'Student',
    amount: Number(row.amount) || 0,
    mode: row.mode,
    notes: row.notes ?? undefined,
    paid_at: row.paid_at,
    paid_on: row.paid_on,
    created_by_name: row.created_by_name,
    handover_id: row.handover_id ?? undefined,
    handover_status: row.handover?.status ?? undefined,
  };
}

function mapHandover(row: any): Handover {
  return {
    id: row.id,
    class_id: row.class_id,
    amount: Number(row.amount) || 0,
    status: row.status,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    reviewed_by_name: row.reviewed_by_name ?? undefined,
    reviewed_at: row.reviewed_at ?? undefined,
    review_note: row.review_note ?? undefined,
  };
}

async function fetchAllPayments(classId?: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db()
      .from('payments')
      .select('*, student:students(name), handover:handovers(status)')
      .order('paid_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (classId) query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function loadAccounts(): Promise<Account[]> {
  // Listed column by column so password_hash can never reach the browser.
  const { data, error } = await db()
    .from('profiles')
    .select('id, phone, full_name, role, title, assigned_class_id, is_active')
    .not('password_hash', 'is', null)
    .order('full_name', { ascending: true });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    phone: row.phone,
    full_name: row.full_name,
    role: row.role,
    title: row.title ?? undefined,
    assigned_class_id: row.assigned_class_id ?? undefined,
    is_active: row.is_active,
  }));
}

/** Everything the viewer may see. A coordinator gets only their own class. */
export async function loadWorkspace(user: CurrentUser): Promise<WorkspaceData> {
  const isAdmin = user.role === 'admin';
  const classId = user.assigned_class_id;

  if (!isAdmin && !classId) {
    return { classes: [], students: [], ledger: [], payments: [], handovers: [], bills: [], accounts: [] };
  }

  let classQuery = db().from('classes').select('*').order('year').order('branch');
  let ledgerQuery = db().from('payment_ledger').select('*').order('created_at', { ascending: false }).limit(LEDGER_LIMIT);
  if (!isAdmin) {
    classQuery = classQuery.eq('id', classId!);
    ledgerQuery = ledgerQuery.eq('class_id', classId!);
  }

  let handoverQuery = db().from('handovers').select('*').order('created_at', { ascending: false }).limit(5000);
  if (!isAdmin) handoverQuery = handoverQuery.eq('class_id', classId!);

  const [classResult, students, payments, handoverResult, ledgerResult, billResult, accounts] = await Promise.all([
    classQuery,
    fetchAllStudents(isAdmin ? undefined : classId),
    fetchAllPayments(isAdmin ? undefined : classId),
    handoverQuery,
    ledgerQuery,
    isAdmin ? db().from('bills').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    isAdmin ? loadAccounts() : Promise.resolve([] as Account[]),
  ]);
  if (classResult.error) throw classResult.error;
  if (handoverResult.error) throw handoverResult.error;
  if (ledgerResult.error) throw ledgerResult.error;
  if (billResult.error) throw billResult.error;

  const classes: ClassInfo[] = classResult.data.map((row) => {
    const [first, second] = accounts.filter((a) => a.is_active && a.assigned_class_id === row.id);
    return {
      id: row.id,
      year: row.year,
      branch: row.branch,
      section: row.section,
      name: `${row.branch} Year ${row.year}`,
      target_per_student: Number(row.target_per_student) || 2600,
      total_students: row.total_students ?? undefined,
      coordinator_1_name: first?.full_name ?? '',
      coordinator_1_phone: first?.phone ?? '',
      coordinator_2_name: second?.full_name ?? '',
      coordinator_2_phone: second?.phone ?? '',
    };
  });

  return {
    classes,
    students: students.map(mapStudent),
    payments: payments.map(mapPayment),
    handovers: handoverResult.data.map(mapHandover),
    ledger: ledgerResult.data.map((row) => mapLedgerEntry(row, user)),
    bills: (billResult.data ?? []).map(mapBill),
    accounts,
  };
}
