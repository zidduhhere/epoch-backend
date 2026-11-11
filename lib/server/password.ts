import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scripts/create-admin.mjs writes this same format.
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 128 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

// scrypt uses about 32 MB per call, so cap how many run at once. Extra sign-ins wait their turn.
const MAX_CONCURRENT = 4;
let running = 0;
const waiting: (() => void)[] = [];

async function acquire() {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
}

function release() {
  running -= 1;
  waiting.shift()?.();
}

async function derive(password: string, salt: Buffer, n: number, r: number, p: number, length: number) {
  await acquire();
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, length, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) => {
        if (error) reject(error);
        else resolve(key);
      });
    });
  } finally {
    release();
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEY_LENGTH);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}

let decoy: Promise<string> | null = null;

/** A hash to verify against when a phone number has no login, so timing doesn't reveal which numbers do. */
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(32).toString('base64'));
  return decoy;
}
