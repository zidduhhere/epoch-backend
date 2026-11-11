'use server';

import { redirect } from 'next/navigation';
import { normalizePhone } from '@/lib/phone';
import { db } from '@/lib/server/db';
import { decoyHash, MAX_PASSWORD_LENGTH, verifyPassword } from '@/lib/server/password';
import { createSession, destroySession } from '@/lib/server/session';

export type SignInState = { error?: string };

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// One message for every failure, so the form never reveals which numbers have a login.
const REJECTED = `Phone number or password is incorrect. After ${MAX_ATTEMPTS} failed attempts, sign-in pauses for ${LOCK_MINUTES} minutes.`;

export async function signIn(_previous: SignInState, form: FormData): Promise<SignInState> {
  const phone = normalizePhone(String(form.get('phone') ?? ''));
  const password = String(form.get('password') ?? '');
  if (!phone || !password || password.length > MAX_PASSWORD_LENGTH) return { error: REJECTED };

  try {
    const { data: profile, error } = await db()
      .from('profiles')
      .select('id, password_hash, is_active, failed_attempts, locked_until')
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;

    const locked = Boolean(profile?.locked_until && new Date(profile.locked_until) > new Date());
    const matches = await verifyPassword(password, profile?.password_hash ?? (await decoyHash()));

    if (!profile?.password_hash || !profile.is_active || locked || !matches) {
      if (profile?.password_hash && !locked) {
        const { error: lockError } = await db().rpc('register_failed_login', {
          p_profile: profile.id,
          p_max_attempts: MAX_ATTEMPTS,
          p_lock_minutes: LOCK_MINUTES,
        });
        if (lockError) throw lockError;
      }
      return { error: REJECTED };
    }

    await db().from('profiles').update({ failed_attempts: 0, locked_until: null }).eq('id', profile.id);
    await destroySession();
    await createSession(profile.id);
  } catch (cause) {
    console.error('Sign-in failed:', cause);
    return { error: 'Sign-in is unavailable right now. Try again in a few minutes.' };
  }

  redirect('/');
}

export async function signOut() {
  await destroySession();
  redirect('/login');
}
