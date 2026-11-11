export type AppRole = 'admin' | 'class_rep' | 'facilitator';

export type PaymentMode = 'upi' | 'cash';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type BillStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';

export type ExpenseCategory =
  | 'decorations'
  | 'sound_and_lights'
  | 'refreshments_food'
  | 'prizes_mementos'
  | 'logistics_transport'
  | 'printing_badges'
  | 'miscellaneous';

export interface ClassInfo {
  id: string;
  year: number; // 1, 2, 3, 4
  branch: string; // see lib/departments.ts
  section: string; // A, B
  name: string;
  target_per_student: number; // 2600
  total_students?: number;
  total_collected?: number;
  coordinator_1_name: string;
  coordinator_1_phone: string;
  coordinator_2_name: string;
  coordinator_2_phone: string;
}

export interface Student {
  id: string;
  class_id: string;
  name: string;
  roll_number?: string;
  phone?: string; // Optional
  amount_due: number;
  amount_paid: number;
  payment_mode: PaymentMode;
  reference_id?: string;
  notes?: string;
  status?: PaymentStatus;
  
  // Dual-custody Cash Handover Checkboxes:
  rep_handover_verified?: boolean;     // Checkbox 1: Class Rep signed off cash handed to committee
  treasurer_verified?: boolean;        // Checkbox 2: Treasurer / Committee signed off cash received
  
  updated_at?: string;
  updated_by_name?: string;
  updated_by_role?: string;
}

export interface PaymentLedgerEntry {
  id: string;
  student_id: string;
  class_id: string;
  student_name: string;
  student_roll?: string;
  old_amount: number;
  new_amount: number;
  delta: number;
  payment_mode: string;
  reference_id?: string;
  action: 'INITIAL_ENTRY' | 'EDIT' | 'FULL_PAYMENT' | 'PARTIAL_PAYMENT' | 'CORRECTION' | 'CASH_HANDOVER_CONFIRMED' | 'TREASURER_VERIFIED';
  reason?: string;
  rep_handover_verified?: boolean;
  treasurer_verified?: boolean;
  modified_by?: string;
  modifier_name: string;
  modifier_email: string;
  modifier_role: string;
  created_at: string;
}

export type HandoverStatus = 'pending' | 'confirmed' | 'rejected';

/** One payment a student made. A student can have several. */
export interface Payment {
  id: string;
  student_id: string;
  class_id: string;
  student_name: string;
  amount: number;
  mode: PaymentMode;
  notes?: string;
  paid_at: string;
  /** Calendar day in India, YYYY-MM-DD. */
  paid_on: string;
  created_by_name: string;
  handover_id?: string;
  /** Set when a cash payment is part of a handover. Missing means still with the coordinator. */
  handover_status?: HandoverStatus;
}

/** A coordinator giving cash to the treasurer. */
export interface Handover {
  id: string;
  class_id: string;
  amount: number;
  status: HandoverStatus;
  created_by_name: string;
  created_at: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_note?: string;
}

export interface Bill {
  id: string;
  title: string;
  description?: string;
  vendor_name: string;
  category: ExpenseCategory;
  amount: number;
  bill_date: string;
  receipt_url: string;
  status: BillStatus;
  submitted_by_name: string;
  submitted_at: string;
  approved_by_name?: string;
  rejection_reason?: string;
}

export interface CurrentUser {
  id: string;
  phone?: string;
  email?: string;
  full_name: string;
  role: AppRole;
  title?: string; // an admin's position, e.g. Treasurer
  assigned_class_id?: string;
  assigned_class_name?: string;
}

export interface Account {
  id: string;
  phone: string;
  full_name: string;
  role: AppRole;
  title?: string;
  assigned_class_id?: string;
  is_active: boolean;
}

export interface WorkspaceData {
  classes: ClassInfo[];
  students: Student[];
  ledger: PaymentLedgerEntry[];
  payments: Payment[];
  handovers: Handover[];
  bills: Bill[];
  accounts: Account[];
}

export type ActionResult = { ok: true } | { ok: false; error: string };
