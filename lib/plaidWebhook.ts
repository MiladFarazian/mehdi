import { createHash } from 'crypto';
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import { plaidClient } from './plaid';

// Verifies a Plaid webhook per Plaid's JWT (JWS) scheme:
//  1. read the kid from the Plaid-Verification JWT header
//  2. fetch that key via /webhook_verification_key/get (cached)
//  3. verify the ES256 signature and freshness (≤5 min)
//  4. confirm request_body_sha256 matches the raw body
// https://plaid.com/docs/api/webhooks/webhook-verification/

const keyCache = new Map<string, any>();

export async function verifyPlaidWebhook(
  rawBody: string,
  verificationHeader: string | null,
): Promise<boolean> {
  if (!verificationHeader) return false;
  try {
    const { kid, alg } = decodeProtectedHeader(verificationHeader);
    if (alg !== 'ES256' || !kid) return false;

    let jwk = keyCache.get(kid);
    if (!jwk) {
      const res = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
      jwk = res.data.key;
      keyCache.set(kid, jwk);
    }
    if (jwk.expired_at) return false;

    const key = await importJWK(jwk, 'ES256');
    const { payload } = await jwtVerify(verificationHeader, key, { maxTokenAge: '5 min' });

    const expected = createHash('sha256').update(rawBody, 'utf8').digest('hex');
    return (payload as any).request_body_sha256 === expected;
  } catch {
    return false;
  }
}
