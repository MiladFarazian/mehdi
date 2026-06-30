import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, authConfigured, verifyToken } from '@/lib/auth';

// Routes reachable without the app password.
const PUBLIC_PAGES = ['/login'];
const PUBLIC_API = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/plaid/webhook', // Plaid → us, server-to-server (verify its JWT in prod)
  '/api/cron', // protected by CRON_SECRET instead
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // No password set ⇒ gate disabled (local-dev convenience).
  if (!authConfigured()) return NextResponse.next();

  if (
    PUBLIC_PAGES.includes(pathname) ||
    PUBLIC_API.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const ok = await verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
