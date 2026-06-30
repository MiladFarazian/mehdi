// Lightweight single-user auth: a password gate with an HMAC-derived cookie.
// Uses Web Crypto (available in both the Edge middleware and Node routes), so
// one implementation works everywhere. Proportional for a personal tool — not a
// multi-user identity system.

export const AUTH_COOKIE = 'mehdi_auth';
const MESSAGE = 'mehdi-auth-v1';

export function authConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

// Deterministic proof token = HMAC-SHA256(MESSAGE) keyed by APP_PASSWORD.
// Only obtainable by knowing the password (the server sets it after login).
export async function expectedToken(): Promise<string> {
  const pw = process.env.APP_PASSWORD || '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pw),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(MESSAGE));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyToken(token?: string): Promise<boolean> {
  if (!token) return false;
  return token === (await expectedToken());
}
