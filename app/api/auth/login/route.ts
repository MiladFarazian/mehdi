import { NextResponse } from 'next/server';
import { AUTH_COOKIE, expectedToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
