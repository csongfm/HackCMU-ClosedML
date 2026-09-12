import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'briefly_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = { id: string; email: string; name: string };

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured.');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT(user)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.id || !payload.email || !payload.name) return null;
    return { id: String(payload.id), email: String(payload.email), name: String(payload.name) };
  } catch {
    return null;
  }
}

export function attachSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}
