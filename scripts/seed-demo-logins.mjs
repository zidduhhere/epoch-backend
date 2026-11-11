// Creates DEMO logins: one admin and one class coordinator per existing class.
// For development only. Run after the phone-login schema changes are applied:
//   ALLOW_DEMO=1 node --env-file=.env.local scripts/seed-demo-logins.mjs
// Safe to re-run: existing phone numbers are skipped.

import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const scrypt = promisify(scryptCallback);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local first.');
  process.exit(1);
}

if (process.env.ALLOW_DEMO !== '1') {
  console.error('This creates logins with a publicly known password. Never run it on a real project.');
  console.error('If this is a throwaway dev project, re-run with ALLOW_DEMO=1 set.');
  process.exit(1);
}

const DEMO_PASSWORD = 'Demo@12345';

// Same format as lib/server/password.ts.
async function hash(password) {
  const N = 32768, R = 8, P = 1;
  const salt = randomBytes(16);
  const out = await scrypt(password, salt, 32, { N, r: R, p: P, maxmem: 128 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${out.toString('base64')}`;
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: classes, error } = await db
  .from('classes')
  .select('id, year, branch, section')
  .order('branch')
  .order('year');
if (error) {
  console.error(error.message);
  process.exit(1);
}

const passwordHash = await hash(DEMO_PASSWORD);
const accounts = [
  { full_name: 'Demo Admin', title: 'Main coordinator', phone: '9000000000', role: 'admin', assigned_class_id: null, label: 'Admin' },
  ...classes.map((c, i) => ({
    full_name: `Demo Coordinator ${c.branch} Y${c.year}`,
    title: null,
    phone: String(9000000001 + i),
    role: 'class_rep',
    assigned_class_id: c.id,
    label: `${c.branch} Year ${c.year}`,
  })),
];

for (const { label, ...account } of accounts) {
  const { error: insertError } = await db
    .from('profiles')
    .insert({ ...account, password_hash: passwordHash });
  const status = insertError ? (insertError.code === '23505' ? 'exists' : insertError.message) : 'created';
  console.log(`${account.phone}  ${account.role.padEnd(9)}  ${label.padEnd(16)}  ${status}`);
}
console.log(`\nPassword for all demo logins: ${DEMO_PASSWORD}`);
