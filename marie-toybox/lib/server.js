import { createClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'mari_session';
const ADMIN_COOKIE = 'mari_admin';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수를 설정해 주세요.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET은 32자 이상의 문자열이어야 합니다.');
  return new TextEncoder().encode(value);
}

export async function createUserSession(user) {
  const token = await new SignJWT({ sub: user.id, kind: 'user' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 });
}

export async function createAdminSession() {
  const token = await new SignJWT({ kind: 'admin' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('4h').sign(secret());
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 4 });
}

export async function clearUserSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
export async function clearAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getUserId() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.kind === 'user' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch { return null; }
}

export async function requireUser() {
  const id = await getUserId();
  if (!id) throw new Error('로그인이 필요합니다.');
  return id;
}

export async function requireAdmin() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) throw new Error('관리자 인증이 필요합니다.');
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== 'admin') throw new Error('관리자 인증이 필요합니다.');
  } catch { throw new Error('관리자 인증이 필요합니다.'); }
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ''));
  const right = Buffer.from(String(b ?? ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}
