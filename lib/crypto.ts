import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// AES-256-GCM encryption for secrets at rest (the Plaid access_token).
// Key = SHA-256 of TOKEN_ENC_KEY, so any sufficiently-random env string works.
// If TOKEN_ENC_KEY is unset, values are stored as-is (fine for sandbox dev);
// set it before connecting real accounts. Stored format: "enc:v1:<base64>".

const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) return null;
  return createHash('sha256').update(raw).digest(); // 32 bytes
}

export function encryptionEnabled(): boolean {
  return Boolean(process.env.TOKEN_ENC_KEY);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // encryption disabled — store plaintext (dev)
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // plaintext (dev/legacy)
  const key = getKey();
  if (!key) throw new Error('TOKEN_ENC_KEY is required to decrypt a stored secret.');
  const blob = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
