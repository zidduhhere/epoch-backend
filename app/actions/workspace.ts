'use server';

import { revalidatePath } from 'next/cache';
import { normalizePhone } from '@/lib/phone';
import { mapLedgerEntry } from '@/lib/server/data';
import { db } from '@/lib/server/db';
import { hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/server/password';
import { endAllSessions, getCurrentUser } from '@/lib/server/session';
import type { ActionResult, CurrentUser, ExpenseCategory, PaymentLedgerEntry, PaymentMode } from '@/lib/types';

// Server Functions are reachable by direct POST. Every one below authorizes on
// the server and takes the acting user from the session, never from the client.

const CATEGORIES: ExpenseCategory[] = [
  'decorations',
  'sound_and_lights',
  'refreshments_food',
  'prizes_mementos',
  'logistics_transport',
  'printing_badges',
  'miscellaneous',
];

const SESSION_ENDED = 'Your session has ended. Sign in again.';
const NOT_ALLOWED = 'You do not have access to this.';

async function run(work: (user: CurrentUser) => Promise<string | void>, adminOnly = false): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_ENDED };
    if (adminOnly && user.role !== 'admin') return { ok: false, error: NOT_ALLOWED };

    const problem = await work(user);
    if (problem) return { ok: false, error: problem };

    revalidatePath('/');
    return { ok: true };
  } catch (cause) {
    console.error('Action failed:', cause);
    return { ok: false, error: 'That could not be saved. Check your connection and try again.' };
  }
}

function canUseClass(user: CurrentUser, classId: string) {
  return user.role === 'admin' || user.assigned_class_id === classId;
}

function stampedBy(user: CurrentUser) {
  return {
    updated_by: user.id,
    updated_by_name: user.full_name,
    updated_by_role: user.title ?? user.role,
    updated_at: new Date().toISOString(),
  };
}

function cleanNotes(notes: unknown) {
  return typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null;
}

function isValidAmount(amount: unknown, max: number): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= max;
}

function round2(amount: number) {
  return Math.round(amount * 100) / 100;
}

function isValidMode(mode: unknown): mode is PaymentMode {
  return mode === 'upi' || mode === 'cash';
}

async function findStudent(id: string) {
  const { data, error } = await db().from('students').select('id, class_id, amount_due').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Database rules (P0001) carry a message meant for the person using the app. */
function ruleMessage(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === 'P0001') return error.message;
  throw error;
}

function roleLabel(user: CurrentUser) {
  return user.title ?? user.role;
}

/** Records one more payment. `amount` is what is being paid now, never above what is left. */
export async function recordPayment(
  studentId: string,
  input: { amount: number; mode: PaymentMode; notes?: string },
): Promise<ActionResult> {
  return run(async (user) => {
    const student = await findStudent(studentId);
    if (!student || !canUseClass(user, student.class_id)) return NOT_ALLOWED;
    if (!isValidMode(input.mode)) return 'Choose UPI or cash.';
    if (!isValidAmount(input.amount, Number(student.amount_due)) || round2(input.amount) < 1) {
      return 'Enter the amount being paid now, at least ₹1.';
    }

    const { error } = await db().rpc('record_payment', {
      p_student: student.id,
      p_amount: round2(input.amount),
      p_mode: input.mode,
      p_notes: cleanNotes(input.notes),
      p_actor: user.id,
      p_actor_name: user.full_name,
      p_actor_role: roleLabel(user),
    });
    return ruleMessage(error);
  });
}

export async function addStudent(
  classId: string,
  input: { name: string; phone?: string; amount: number; mode: PaymentMode; notes?: string },
): Promise<ActionResult> {
  return run(async (user) => {
    if (!canUseClass(user, classId)) return NOT_ALLOWED;

    const name = typeof input.name === 'string' ? input.name.trim().slice(0, 120) : '';
    if (!name) return 'Enter the student’s name.';
    if (!isValidMode(input.mode)) return 'Choose UPI or cash.';

    const { data: target, error: classError } = await db()
      .from('classes')
      .select('target_per_student')
      .eq('id', classId)
      .maybeSingle();
    if (classError) throw classError;
    if (!target) return NOT_ALLOWED;

    const due = Number(target.target_per_student);
    if (!isValidAmount(input.amount, due) || (input.amount > 0 && round2(input.amount) < 1)) {
      return `Enter an amount between ₹0 and ₹${due.toLocaleString('en-IN')}.`;
    }

    const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) return 'Enter a valid 10-digit mobile number, or leave it empty.';

    const { data: created, error } = await db()
      .from('students')
      .insert({
        class_id: classId,
        name,
        phone,
        amount_due: due,
        amount_paid: 0,
        payment_mode: input.mode,
        created_by: user.id,
        ...stampedBy(user),
      })
      .select('id')
      .single();
    if (error) throw error;
    if (input.amount <= 0) return;

    const { error: paymentError } = await db().rpc('record_payment', {
      p_student: created.id,
      p_amount: round2(input.amount),
      p_mode: input.mode,
      p_notes: cleanNotes(input.notes),
      p_actor: user.id,
      p_actor_name: user.full_name,
      p_actor_role: roleLabel(user),
    });
    let problem: string | undefined;
    try {
      problem = ruleMessage(paymentError);
    } catch (cause) {
      problem = 'Try again.';
      console.error('First payment failed:', cause);
    }
    if (problem) {
      // Undo the student so a retry does not leave a duplicate.
      await db().from('students').delete().eq('id', created.id);
      return `${name} was not added, because the payment was not saved. ${problem}`;
    }
  });
}

/**
 * A coordinator hands money to the treasurer: the typed amount, and whose payments it covers.
 * When an admin records it, it is saved as already confirmed.
 */
export async function createHandover(classId: string, paymentIds: string[], amount: number): Promise<ActionResult> {
  return run(async (user) => {
    if (!canUseClass(user, classId)) return NOT_ALLOWED;
    if (!Array.isArray(paymentIds) || paymentIds.length === 0 || paymentIds.length > 500) {
      return 'Choose whose money is being handed over.';
    }
    if (!paymentIds.every((id) => typeof id === 'string')) return NOT_ALLOWED;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 'Enter the amount handed over.';

    const { error } = await db().rpc('create_handover', {
      p_class: classId,
      p_payment_ids: paymentIds,
      p_actor: user.id,
      p_actor_name: user.full_name,
      p_amount: Math.round(amount * 100) / 100,
      p_confirm: user.role === 'admin',
    });
    return ruleMessage(error);
  });
}

/** Admin confirms the cash arrived, or rejects the handover so it can be redone. */
export async function reviewHandover(handoverId: string, confirm: boolean, note?: string): Promise<ActionResult> {
  return run(async (user) => {
    const rejection = cleanNotes(note);
    if (!confirm && !rejection) return 'Enter why this handover is rejected.';

    const { error } = await db().rpc('review_handover', {
      p_handover: handoverId,
      p_confirm: Boolean(confirm),
      p_actor: user.id,
      p_actor_name: user.full_name,
      p_note: rejection,
    });
    return ruleMessage(error);
  }, true);
}

export async function getStudentHistory(
  studentId: string,
): Promise<{ ok: true; entries: PaymentLedgerEntry[] } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_ENDED };

    const student = await findStudent(studentId);
    if (!student || !canUseClass(user, student.class_id)) return { ok: false, error: NOT_ALLOWED };

    const { data, error } = await db()
      .from('payment_ledger')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return { ok: true, entries: data.map((row) => mapLedgerEntry(row, user)) };
  } catch (cause) {
    console.error('History failed:', cause);
    return { ok: false, error: 'History could not be loaded. Try again.' };
  }
}

export async function addExpense(input: {
  title: string;
  vendor: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  receiptUrl?: string;
  notes?: string;
}): Promise<ActionResult> {
  return run(async (user) => {
    const title = input.title?.trim().slice(0, 160);
    const vendor = input.vendor?.trim().slice(0, 160);
    const receipt = input.receiptUrl?.trim() ?? '';

    if (!title || !vendor) return 'Enter what the expense was for and who was paid.';
    if (!CATEGORIES.includes(input.category)) return 'Choose a category.';
    if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount < 1 || input.amount > 10_000_000) {
      return 'Enter an amount from ₹1 to ₹1,00,00,000.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) return 'Enter the invoice date.';
    if (receipt && !/^https?:\/\//i.test(receipt)) return 'The receipt link must start with https://';

    const { error } = await db()
      .from('bills')
      .insert({
        title,
        vendor_name: vendor,
        category: input.category,
        amount: round2(input.amount),
        bill_date: input.date,
        receipt_url: receipt,
        description: cleanNotes(input.notes),
        status: 'pending',
        submitted_by: user.id,
        submitted_by_name: user.full_name,
      });
    if (error) throw error;
  }, true);
}

export async function reviewExpense(
  billId: string,
  status: 'approved' | 'rejected',
  reason?: string,
): Promise<ActionResult> {
  return run(async (user) => {
    if (status !== 'approved' && status !== 'rejected') return NOT_ALLOWED;
    const rejection = cleanNotes(reason);
    if (status === 'rejected' && !rejection) return 'Enter why this expense is rejected.';

    const { data, error } = await db()
      .from('bills')
      .update({
        status,
        rejection_reason: status === 'rejected' ? rejection : null,
        approved_by: status === 'approved' ? user.id : null,
        approved_by_name: status === 'approved' ? user.full_name : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', billId)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) return 'That expense was already reviewed or no longer exists.';
  }, true);
}

function checkPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return password.length > MAX_PASSWORD_LENGTH ? 'That password is too long.' : null;
}

export async function createLogin(input: {
  fullName: string;
  phone: string;
  password: string;
  role: 'admin' | 'class_rep';
  title?: string;
  classId?: string;
}): Promise<ActionResult> {
  return run(async () => {
    const fullName = input.fullName?.trim().slice(0, 120);
    const phone = normalizePhone(input.phone ?? '');
    if (!fullName) return 'Enter their name.';
    if (!phone) return 'Enter a valid 10-digit mobile number.';
    if (input.role !== 'admin' && input.role !== 'class_rep') return 'Choose a role.';
    if (input.role === 'class_rep' && !input.classId) return 'Choose the class they coordinate.';

    const title = typeof input.title === 'string' ? input.title.trim().slice(0, 60) : '';
    if (input.role === 'admin' && !title) return 'Enter their position, for example Treasurer.';

    const passwordProblem = checkPassword(input.password);
    if (passwordProblem) return passwordProblem;

    const { error } = await db()
      .from('profiles')
      .insert({
        full_name: fullName,
        phone,
        password_hash: await hashPassword(input.password),
        role: input.role,
        title: input.role === 'admin' ? title : null,
        assigned_class_id: input.role === 'class_rep' ? input.classId : null,
      });
    if (error?.code === '23505') return 'That phone number already has a login.';
    if (error) throw error;
  }, true);
}

export async function resetLoginPassword(profileId: string, password: string): Promise<ActionResult> {
  return run(async () => {
    const passwordProblem = checkPassword(password);
    if (passwordProblem) return passwordProblem;

    const { data, error } = await db()
      .from('profiles')
      .update({ password_hash: await hashPassword(password), failed_attempts: 0, locked_until: null })
      .eq('id', profileId)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) return 'That login no longer exists.';
    await endAllSessions(profileId);
  }, true);
}

export async function setLoginActive(profileId: string, active: boolean): Promise<ActionResult> {
  return run(async (user) => {
    if (profileId === user.id) return 'You cannot disable your own login.';

    if (!active) {
      const { data: others, error: adminError } = await db()
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)
        .neq('id', profileId);
      if (adminError) throw adminError;
      const { data: target } = await db().from('profiles').select('role').eq('id', profileId).maybeSingle();
      if (target?.role === 'admin' && (!others || others.length === 0)) return 'At least one admin login must stay active.';
    }

    const { data, error } = await db().from('profiles').update({ is_active: Boolean(active) }).eq('id', profileId).select('id');
    if (error) throw error;
    if (!data || data.length === 0) return 'That login no longer exists.';
    if (!active) await endAllSessions(profileId);
  }, true);
}

const MAX_CLASS_STRENGTH = 500;

/** Admin only. A null count clears the strength, so analytics falls back to students entered. */
export async function setClassStrengths(
  entries: { classId: string; count: number | null }[],
): Promise<ActionResult> {
  return run(async () => {
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 200) return 'Nothing to save.';
    for (const entry of entries) {
      const { count } = entry;
      if (typeof entry.classId !== 'string') return 'Nothing to save.';
      if (count !== null && (!Number.isInteger(count) || count < 0 || count > MAX_CLASS_STRENGTH)) {
        return `Enter a whole number from 0 to ${MAX_CLASS_STRENGTH}.`;
      }
    }

    const results = await Promise.all(
      entries.map((entry) =>
        db()
          .from('classes')
          .update({ total_students: entry.count, updated_at: new Date().toISOString() })
          .eq('id', entry.classId),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  }, true);
}
