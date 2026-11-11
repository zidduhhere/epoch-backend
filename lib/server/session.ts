import 'server-only';
import { cache } from 'react';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import type { AppRole, CurrentUser } from '../types';

export const SESSION_COOKIE = 'epoch_session';
const SESSION_DAYS = 7;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(profileId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db().from('app_sessions').delete().eq('profile_id', profileId).lt('expires_at', new Date().toISOString());

  const { error } = await db()
    .from('app_sessions')
    .insert({ token_hash: hashToken(token), profile_id: profileId, expires_at: expires.toISOString() });
  if (error) throw error;

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db().from('app_sessions').delete().eq('token_hash', hashToken(token));
  store.delete(SESSION_COOKIE);
}

export async function endAllSessions(profileId: string) {
  const { error } = await db().from('app_sessions').delete().eq('profile_id', profileId);
  if (error) throw error;
}

type SessionRow = {
  expires_at: string;
  profile: {
    id: string;
    phone: string;
    full_name: string;
    role: AppRole;
    title: string | null;
    is_active: boolean;
    assigned_class_id: string | null;
    class: { year: number; branch: string } | null;
  } | null;
};

/**
 * The signed-in user, checked against the database on every request so that
 * disabling a login takes effect immediately. Never add password_hash here.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await db()
    .from('app_sessions')
    .select('expires_at, profile:profiles(id, phone, full_name, role, title, is_active, assigned_class_id, class:classes(year, branch))')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw error;

  const row = data as unknown as SessionRow | null;
  const profile = row?.profile;
  if (!row || !profile || !profile.is_active) return null;
  if (new Date(row.expires_at) <= new Date()) return null;
  if (profile.role !== 'admin' && profile.role !== 'class_rep') return null;

  return {
    id: profile.id,
    phone: profile.phone,
    full_name: profile.full_name,
    role: profile.role,
    title: profile.title ?? undefined,
    assigned_class_id: profile.assigned_class_id ?? undefined,
    assigned_class_name: profile.class ? `${profile.class.branch} Year ${profile.class.year}` : undefined,
  };
});
