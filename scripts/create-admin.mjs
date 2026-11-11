// Creates the first admin login. Later logins are added inside the app.
// Run after the migration:  node --env-file=.env.local scripts/create-admin.mjs

import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const scrypt = promisify(scryptCallback);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local first.');
  process.exit(1);
}

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const fullName = (await prompt.question('Admin name: ')).trim();
const title = (await prompt.question('Position (for example Main coordinator): ')).trim();
const phone = (await prompt.question('10-digit mobile number: ')).replace(/\D/g, '').slice(-10);

process.stdout.write('Password (at least 8 characters, hidden): ');
const writeOutput = prompt._writeToOutput;
prompt._writeToOutput = () => {};
const password = await prompt.question('');
prompt._writeToOutput = writeOutput;
prompt.close();
console.log();

if (!fullName || !title || !/^[6-9]\d{9}$/.test(phone) || password.length < 8) {
  console.error('Enter a name, a position, a valid mobile number and a password of at least 8 characters.');
  process.exit(1);
}

// Same format as lib/server/password.ts.
const N = 32768;
const R = 8;
const P = 1;
const salt = randomBytes(16);
const hash = await scrypt(password, salt, 32, { N, r: R, p: P, maxmem: 128 * 1024 * 1024 });
const passwordHash = `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;

const db = createClient(url, key, { auth: { persistSession: false } });
const { error } = await db.from('profiles').insert({
  full_name: fullName,
  title,
  phone,
  password_hash: passwordHash,
  role: 'admin',
});

if (error) {
  console.error(error.code === '23505' ? 'That phone number already has a login.' : error.message);
  process.exit(1);
}
console.log(`Admin login created for ${phone}.`);
